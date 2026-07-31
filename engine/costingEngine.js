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
  var effectiveTagsPerPiece = invariantTagsPerPiece + reclaimedTagsPerPiece;
  var tagsPerSheet = r.totalTagsPerSheet || 0;
  var expectedTagsPerSheet = effectiveTagsPerPiece * (r.totalPieces || piecesPerSheet || 1);
  if (tagsPerSheet > 0 && expectedTagsPerSheet > 0 && tagsPerSheet !== expectedTagsPerSheet) {
    try { console.warn('COST ENGINE INVARIANT: totalTagsPerSheet(' + tagsPerSheet + ') !== effectiveTagsPerPiece*totalPieces(' + invariantTagsPerPiece + '+' + reclaimedTagsPerPiece + '*' + (r.totalPieces || piecesPerSheet || 1) + ' = ' + expectedTagsPerSheet + ')'); } catch(e) {}
  }
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

  var tier = pieceTier(maxPieceL, maxPieceW);
  var dieSlabs = computeSlabs(totalPieces);
  var dieRunningCost = totalPieces > 0 ? tier.runRate * dieSlabs : 0;
  var dieMakingCost = totalPieces > 0 ? tier.dieCost : 0;
  var dieTotalCost = dieMakingCost + dieRunningCost;

  var transportCost = totalPieces > 0 ? transport : 0;

  var subtotal = materialCost + printingCost + laminationCost + dieTotalCost + transportCost;

  var sellingPrice;
  if (effectiveMarginMode === "markup") {
    sellingPrice = subtotal * (1 + effectiveMarginPct / 100);
  } else {
    var denom = 1 - effectiveMarginPct / 100;
    sellingPrice = denom > 0 ? subtotal / denom : NaN;
  }
  var profitAmount = sellingPrice - subtotal;
  var costPerTag = orderQty > 0 ? subtotal / orderQty : NaN;
  var pricePerTag = orderQty > 0 ? sellingPrice / orderQty : NaN;

  return {
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
    tier: tier, dieSlabs: dieSlabs,
    dieRunningCost: dieRunningCost, dieMakingCost: dieMakingCost,
    dieTotalCost: dieTotalCost,
    transportCost: transportCost, subtotal: subtotal,
    sellingPrice: sellingPrice, profitAmount: profitAmount,
    costPerTag: costPerTag, pricePerTag: pricePerTag,
    orderQty: orderQty, productionQty: productionQty,
  };
}
