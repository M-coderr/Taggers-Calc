function inr(n) {
  if (!isFinite(n)) return "\u2014";
  return "\u20B9" + n.toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}

function num(n, d) {
  if (d === undefined) d = 2;
  if (!isFinite(n)) return "\u2014";
  return n.toLocaleString("en-IN", { maximumFractionDigits: d });
}

function computeSlabs(qty, base, grace) {
  if (base === undefined) base = 1000;
  if (grace === undefined) grace = 200;
  if (qty <= 0) return 0;
  return Math.max(1, Math.ceil((qty - grace) / base));
}

function computeCosts(layout, params) {
  var sheetRate = params.sheetRate;
  var orderQty = params.orderQty;
  var productionQty = params.productionQty || orderQty;
  var printMethod = params.printMethod;
  var colors = params.colors;
  var lamination = params.lamination;
  var transport = params.transport;
  var overridePieces = params.overridePieces;
  var manualPiecesPerSheet = params.manualPiecesPerSheet;
  var effectiveMarginPct = params.effectiveMarginPct;
  var effectiveMarginMode = params.effectiveMarginMode;
  var repeatDie = params.repeatDie;

  var r = layout && layout.result ? layout.result : layout;
  var piecesPerSheet = overridePieces
    ? Math.max(0, Math.floor(manualPiecesPerSheet) || 0)
    : r.autoPiecesPerSheet;

  var invariantTagsPerPiece = (r.tagsRows || 0) * (r.tagsCols || 0);
  var reclaimedTagsPerPiece = (r.optimization && r.optimization.reclaimedTags) || (r.reclaimedTagsPerPiece) || 0;
  if (printMethod === "offset") {
    reclaimedTagsPerPiece = 0;
  }
  if (r.tagsRows <= 0 || r.tagsCols <= 0) {
    invariantTagsPerPiece = 0;
  }
  var tagsPerSheet = r.totalTagsPerSheet || 0;
  var effectiveTagsPerPiece = (r.totalPieces && r.totalPieces > 0) ? (tagsPerSheet / r.totalPieces) : (r.tagsPerPieceNominal || 0);
  if (invariantTagsPerPiece === 0) {
    tagsPerSheet = 0;
  }
  var sheetsNeeded = tagsPerSheet > 0 ? Math.ceil(productionQty / tagsPerSheet) : 0;
  var totalPieces = piecesPerSheet * sheetsNeeded;
  var totalTags = tagsPerSheet * sheetsNeeded;
  var overage = totalTags - productionQty;

  var materialCost = sheetsNeeded * sheetRate;

  var printSlabs = computeSlabs(totalPieces);
  var printingCost = 0;
  if (totalPieces > 0) {
    if (printMethod === "offset") {
      printingCost = PROCESS_RATES.printing.offsetBase + (printSlabs - 1) * PROCESS_RATES.printing.offsetSlabIncrement;
    } else {
      printingCost = colors * PROCESS_RATES.printing.handPerColor * printSlabs;
    }
  }

  var laminationAreaSqIn = 0;
  var maxPieceL = r.pieceL;
  var maxPieceW = r.pieceW;

  if (r.isMixed && r.strips && r.strips.length > 0) {
    maxPieceL = 0;
    maxPieceW = r.pieceW;
    for (var i = 0; i < r.strips.length; i++) {
      var st = r.strips[i];
      laminationAreaSqIn += (st.L * st.W * st.count * sheetsNeeded);
      if (st.L > maxPieceL) maxPieceL = st.L;
      if (st.W > maxPieceW) maxPieceW = st.W;
    }
  } else {
    laminationAreaSqIn = r.pieceL * r.pieceW * totalPieces;
  }

  var pieceAreaSqIn = r.pieceL * r.pieceW; // keep for return value backwards-compatibility
  var laminationCost = lamination ? laminationAreaSqIn * PROCESS_RATES.lamination.ratePerSqIn : 0;

  // Foil calculation (per tag)
  var foil = params.foil;
  var foilL = Number(params.foilL) || 0;
  var foilW = Number(params.foilW) || 0;
  var foilArea = foilL * foilW;
  var foilPieceRate = foilArea <= 4 ? 0.20 : (foilArea <= 8 ? 0.25 : 0.30);
  var foilBlockCost = (foil && orderQty > 0) ? 250 : 0;
  var foilRunningCost = (foil && orderQty > 0) ? orderQty * foilPieceRate : 0;
  var foilCost = foilBlockCost + foilRunningCost;

  // Emboss calculation (per tag)
  var emboss = params.emboss;
  var embossL = Number(params.embossL) || 0;
  var embossW = Number(params.embossW) || 0;
  var embossArea = embossL * embossW;
  var embossPieceRate = embossArea <= 6 ? 0.25 : 0.30;
  var embossBlockCost = (emboss && orderQty > 0) ? (embossArea <= 6 ? 500 : 1000) : 0;
  var embossRunningCost = (emboss && orderQty > 0) ? orderQty * embossPieceRate : 0;
  var embossCost = embossBlockCost + embossRunningCost;

  var tier = pieceTier(maxPieceL, maxPieceW);
  var dieSlabs = computeSlabs(totalPieces);
  var dieRunningCost = totalPieces > 0 ? tier.runRate * dieSlabs : 0;
  var dieMakingCost = (totalPieces > 0 && !repeatDie) ? tier.dieCost : 0;
  var dieTotalCost = dieMakingCost + dieRunningCost;

  var transportCost = totalPieces > 0 ? transport : 0;

  var tagSubtotal = materialCost + printingCost + laminationCost + dieTotalCost + transportCost + foilBlockCost + embossBlockCost;
  var subtotal = materialCost + printingCost + laminationCost + dieTotalCost + transportCost + foilCost + embossCost;

  var tagSellingPrice, sellingPrice;

  if (effectiveMarginMode === "markup") {
    var factor = 1 + effectiveMarginPct / 100;
    tagSellingPrice = tagSubtotal * factor;
  } else {
    var denom = 1 - effectiveMarginPct / 100;
    tagSellingPrice = denom > 0 ? tagSubtotal / denom : NaN;
  }

  var foilSellingPrice = foilRunningCost;
  var embossSellingPrice = embossRunningCost;

  // 1st Cost: Actual raw cost for entered orderQty
  var rawCostPerTag = orderQty > 0 ? subtotal / orderQty : NaN;
  var rawSubtotal = subtotal;

  // 2nd Cost: Cost + entered margin for exact entered orderQty (without slab adjustment)
  var exactSellingPrice = tagSellingPrice + foilSellingPrice + embossSellingPrice;
  var exactPricePerTag = orderQty > 0 ? exactSellingPrice / orderQty : NaN;

  // 3rd Cost: Selling cost showed to Agent (Quantity Slab Rate applied)
  var pricePerTag = exactPricePerTag;
  var sellingPrice = exactSellingPrice;
  var slabQty = orderQty;
  var isSlabApplied = false;

  if (orderQty > 10000 && !params._isSlabCalc) {
    slabQty = Math.floor(orderQty / 10000) * 10000;
    isSlabApplied = orderQty !== slabQty;
    try {
      var slabParams = Object.assign({}, params, {
        orderQty: slabQty,
        productionQty: slabQty + Math.floor(slabQty / 5000) * 200,
        _isSlabCalc: true
      });
      var slabRes = computeCosts(layout, slabParams);
      if (slabRes && slabRes.pricePerTag > 0) {
        pricePerTag = slabRes.pricePerTag;
        sellingPrice = orderQty * pricePerTag;
        var tagRatePerTag = slabRes.tagSellingPrice / slabQty;
        tagSellingPrice = orderQty * tagRatePerTag;
      }
    } catch (e) {}
  }

  var profitAmount = sellingPrice - subtotal;

  return {
    tagSubtotal: tagSubtotal, tagSellingPrice: tagSellingPrice,
    foilSellingPrice: foilSellingPrice, embossSellingPrice: embossSellingPrice,
    TL: r.TL, TW: r.TW, pieceL: r.pieceL, pieceW: r.pieceW,
    n: r.n, m: r.m, isRotated: layout.isRotated,
    overlapIn: params.overlapIn, marginIn: params.marginIn,
    tagsRows: r.tagsRows, tagsCols: r.tagsCols,
    tagsPerPieceNominal: r.tagsPerPieceNominal,
    reclaimedTagsPerPiece: reclaimedTagsPerPiece,
    leftoverL: r.leftoverL, leftoverW: r.leftoverW,
    totalTagsPerSheet: tagsPerSheet,
    autoPiecesPerSheet: r.autoPiecesPerSheet,
    piecesPerSheet: piecesPerSheet, tagsPerSheet: tagsPerSheet,
    sheetsNeeded: sheetsNeeded, totalPieces: totalPieces,
    totalTags: totalTags, overage: overage,
    materialCost: materialCost, printSlabs: printSlabs,
    printingCost: printingCost,
    pieceAreaSqIn: pieceAreaSqIn, laminationCost: laminationCost,
    foil: foil, foilL: foilL, foilW: foilW, foilArea: foilArea,
    foilPieceRate: foilPieceRate, foilBlockCost: foilBlockCost, foilRunningCost: foilRunningCost, foilCost: foilCost,
    emboss: emboss, embossL: embossL, embossW: embossW, embossArea: embossArea,
    embossPieceRate: embossPieceRate, embossBlockCost: embossBlockCost, embossRunningCost: embossRunningCost, embossCost: embossCost,
    tier: tier, dieSlabs: dieSlabs,
    dieRunningCost: dieRunningCost, dieMakingCost: dieMakingCost,
    dieTotalCost: dieTotalCost,
    transportCost: transportCost,
    // 1st Cost (Actual Cost):
    rawCostPerTag: rawCostPerTag, rawSubtotal: rawSubtotal, costPerTag: rawCostPerTag, subtotal: rawSubtotal,
    // 2nd Cost (Cost + Margin for exact Qty):
    exactPricePerTag: exactPricePerTag, exactSellingPrice: exactSellingPrice,
    // 3rd Cost (Selling Price Shown to Agent - Slab Rate):
    pricePerTag: pricePerTag, sellingPrice: sellingPrice,
    profitAmount: profitAmount,
    slabQty: slabQty, isSlabApplied: isSlabApplied,
    orderQty: orderQty, productionQty: productionQty,
  };
}
