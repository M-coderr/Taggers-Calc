/**
 * Taggers Calc - Multi-Tag Die Engine (v2.3)
 * Supports multiple tag sizes on a single die,
 * strictly enforces EQUAL cavities (UPs) for all tags on the combo die,
 * treats Order Quantity as required tags per SKU/design (NOT as machine pulls),
 * optimizes block/grid layout nesting, and allocates costs & prices
 * strictly proportional to each tag's physical surface area.
 */

var MULTI_TAG_PALETTE = [
  { cut: "#1976d2", fill: "rgba(25, 118, 210, 0.09)", text: "#1565c0", badge: "#1976d2", name: "Tag 1", prefix: "A" },
  { cut: "#2e7d32", fill: "rgba(46, 125, 50, 0.09)", text: "#1b5e20", badge: "#2e7d32", name: "Tag 2", prefix: "B" },
  { cut: "#d35400", fill: "rgba(211, 84, 0, 0.09)", text: "#b93e00", badge: "#d35400", name: "Tag 3", prefix: "C" },
  { cut: "#7b1fa2", fill: "rgba(123, 31, 162, 0.09)", text: "#4a148c", badge: "#7b1fa2", name: "Tag 4", prefix: "D" },
  { cut: "#00796b", fill: "rgba(0, 121, 107, 0.09)", text: "#004d40", badge: "#00796b", name: "Tag 5", prefix: "E" },
  { cut: "#c2185b", fill: "rgba(194, 24, 91, 0.09)", text: "#880e4f", badge: "#c2185b", name: "Tag 6", prefix: "F" }
];

function getMultiTagColor(index) {
  return MULTI_TAG_PALETTE[index % MULTI_TAG_PALETTE.length];
}

/**
 * Returns all factor pairs [rows, cols] such that rows * cols == slots.
 */
function getSlotFactorPairs(slots) {
  var s = Math.max(1, Math.round(Number(slots) || 1));
  var pairs = [];
  for (var r = 1; r <= s; r++) {
    if (s % r === 0) {
      pairs.push([r, s / r]);
    }
  }
  return pairs;
}

/**
 * Generate all valid multi-tag layouts for a given sheet and list of tags.
 * All tags on the die share the same cavity count (upsPerTag).
 * orderQty is the required quantity of tags per design.
 */
function generateMultiTagLayouts(sheetL, sheetW, tagsList, upsPerTag, overlapIn, marginIn, orderQtyPerTag, feedOffset, feedHand) {
  if (!sheetL || !sheetW || sheetL <= 0 || sheetW <= 0) return [];
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) return [];

  // Parse arguments to support both new signature and legacy caller
  var actualUps = 1;
  var actualOverlap = 0;
  var actualMargin = 0;
  var actualOrderQty = 5000;
  var actualFeedOffset = feedOffset;
  var actualFeedHand = feedHand;

  if (typeof upsPerTag === "number" && upsPerTag >= 1 && Number.isInteger(upsPerTag)) {
    actualUps = Math.max(1, Math.round(upsPerTag));
    actualOverlap = Number(overlapIn) || 0;
    actualMargin = Number(marginIn) || 0;
    actualOrderQty = Math.max(1, Math.round(Number(orderQtyPerTag) || 5000));
  } else {
    // Legacy call: (sheetL, sheetW, tagsList, overlapIn, marginIn, orderQtyPerTag, feedOffset, feedHand)
    actualOverlap = Number(upsPerTag) || 0;
    actualMargin = Number(overlapIn) || 0;
    actualOrderQty = Math.max(1, Math.round(Number(marginIn) || 5000));
    actualFeedOffset = orderQtyPerTag;
    actualFeedHand = feedOffset;
    if (tagsList && tagsList[0] && Number(tagsList[0].slots) >= 1) {
      actualUps = Math.round(Number(tagsList[0].slots));
    }
  }

  // Filter valid tags (length and width > 0)
  var validTags = tagsList.filter(function(t) {
    return t && Number(t.l) > 0 && Number(t.w) > 0;
  });
  if (validTags.length === 0) return [];

  // Every tag on the die has exactly actualUps cavities
  var totalSlots = validTags.length * actualUps;
  if (totalSlots < 1) return [];

  var candidates = [];
  var seen = {};

  var feedL = 0, feedW = 0, feedLabel = "Default";
  var isHandFeed = false;
  if (actualFeedOffset && actualFeedOffset[0] > 0 && actualFeedOffset[1] > 0) {
    feedL = actualFeedOffset[0]; feedW = actualFeedOffset[1];
    feedLabel = "Offset feed " + actualFeedOffset[0] + "x" + actualFeedOffset[1];
  } else if (actualFeedHand && actualFeedHand[0] > 0 && actualFeedHand[1] > 0) {
    feedL = actualFeedHand[0]; feedW = actualFeedHand[1];
    feedLabel = "Hand feed " + actualFeedHand[0] + "x" + actualFeedHand[1];
    isHandFeed = true;
  }

  var MIN_HAND_PIECE = 6;
  var MIN_HAND_PIECE_LONG = 9;
  var MIN_OFFSET_PIECE = 12;
  var MIN_OFFSET_PIECE_LONG = 18;

  function fitsFeed(pl, pw) {
    return (pl <= feedL + 0.01 && pw <= feedW + 0.01) || (pl <= feedW + 0.01 && pw <= feedL + 0.01);
  }

  function meetsMinSize(pl, pw) {
    var shortSide = Math.min(pl, pw);
    var longSide = Math.max(pl, pw);
    if (isHandFeed) {
      return shortSide >= MIN_HAND_PIECE && longSide >= MIN_HAND_PIECE_LONG;
    } else {
      return shortSide >= MIN_OFFSET_PIECE && longSide >= MIN_OFFSET_PIECE_LONG;
    }
  }

  function getUsablePiece(pl, pw) {
    if (!isHandFeed) {
      var shortSide = Math.min(pl, pw);
      var longSide = Math.max(pl, pw);
      var usableShort = Math.max(0, shortSide - 0.6);
      var usableLong = Math.max(0, longSide - 0.5);
      var uL = (pl <= pw) ? usableShort : usableLong;
      var uW = (pl <= pw) ? usableLong : usableShort;
      return { usableL: uL, usableW: uW, mL: (pl - uL) / 2, mW: (pw - uW) / 2 };
    }
    return {
      usableL: Math.max(0, pl - 2 * actualMargin),
      usableW: Math.max(0, pw - 2 * actualMargin),
      mL: actualMargin,
      mW: actualMargin
    };
  }

  // Pre-generate factor options for each tag with equal actualUps
  var tagBlockOptions = validTags.map(function(t, tIdx) {
    var tL = Number(t.l);
    var tW = Number(t.w);
    var color = getMultiTagColor(tIdx);
    var prefix = String.fromCharCode(65 + (tIdx % 26)); // A, B, C...

    var factorPairs = getSlotFactorPairs(actualUps);
    var blockVariations = [];

    factorPairs.forEach(function(pair) {
      var rows = pair[0];
      var cols = pair[1];

      // Option 1: Normal orientation (tag L along rows, tag W along cols)
      var cutL_norm = tL + 2 * actualOverlap;
      var cutW_norm = tW + 2 * actualOverlap;
      var spanL_norm = rows * cutL_norm;
      var spanW_norm = cols * cutW_norm;

      blockVariations.push({
        tagIndex: tIdx,
        tagName: t.name || ("Tag " + (tIdx + 1)),
        tagPrefix: prefix,
        tagColor: color,
        tagL: tL,
        tagW: tW,
        slots: actualUps,
        rows: rows,
        cols: cols,
        cutL: cutL_norm,
        cutW: cutW_norm,
        isRotated: false,
        spanL: spanL_norm,
        spanW: spanW_norm,
        count: rows * cols,
        dir: "V"
      });

      // Option 2: Rotated 90° (tag W along rows, tag L along cols)
      var cutL_rot = tW + 2 * actualOverlap;
      var cutW_rot = tL + 2 * actualOverlap;
      var spanL_rot = rows * cutL_rot;
      var spanW_rot = cols * cutW_rot;

      blockVariations.push({
        tagIndex: tIdx,
        tagName: t.name || ("Tag " + (tIdx + 1)),
        tagPrefix: prefix,
        tagColor: color,
        tagL: tW,
        tagW: tL,
        slots: actualUps,
        rows: rows,
        cols: cols,
        cutL: cutL_rot,
        cutW: cutW_rot,
        isRotated: true,
        spanL: spanL_rot,
        spanW: spanW_rot,
        count: rows * cols,
        dir: "H"
      });
    });

    return blockVariations;
  });

  // Helper to generate Cartesian product of block options across all tags
  function getBlockCombinations(optionsArr, idx) {
    if (idx === undefined) idx = 0;
    if (idx >= optionsArr.length) return [[]];
    var tail = getBlockCombinations(optionsArr, idx + 1);
    var res = [];
    for (var i = 0; i < optionsArr[idx].length; i++) {
      var current = optionsArr[idx][i];
      for (var j = 0; j < tail.length; j++) {
        res.push([current].concat(tail[j]));
      }
    }
    return res;
  }

  var blockCombinations = getBlockCombinations(tagBlockOptions);
  var sheetArea = sheetL * sheetW;

  // Test sheet subdivisions (1 to 8 pieces across and down)
  for (var ni = 1; ni <= 8; ni++) {
    for (var mi = 1; mi <= 8; mi++) {
      var pL = sheetL / ni;
      var pW = sheetW / mi;
      var totalPieces = ni * mi;

      if (!fitsFeed(pL, pW) || !meetsMinSize(pL, pW)) continue;

      var uDims = getUsablePiece(pL, pW);
      var usableL = uDims.usableL;
      var usableW = uDims.usableW;
      var effL = usableL + 2 * actualOverlap;
      var effW = usableW + 2 * actualOverlap;

      for (var ci = 0; ci < blockCombinations.length; ci++) {
        var blocks = blockCombinations[ci];

        // Formation 1: Vertical Stack (placed one below the other along length)
        var totalStackL = 0;
        var maxStackW = 0;
        for (var bi = 0; bi < blocks.length; bi++) {
          totalStackL += blocks[bi].spanL;
          if (blocks[bi].spanW > maxStackW) maxStackW = blocks[bi].spanW;
        }

        if (totalStackL <= effL + 0.001 && maxStackW <= effW + 0.001) {
          var placedBlocks = [];
          var currY = 0;
          for (var bIdx = 0; bIdx < blocks.length; bIdx++) {
            var b = blocks[bIdx];
            placedBlocks.push(Object.assign({}, b, {
              xOffset: 0,
              yOffset: currY
            }));
            currY += b.spanL;
          }

          addMultiCandidate({
            formation: "stack-v",
            formationLabel: "Vertical Stack",
            pL: pL, pW: pW, ni: ni, mi: mi,
            totalPieces: totalPieces,
            blocks: placedBlocks,
            boundL: totalStackL, boundW: maxStackW
          });
        }

        // Formation 2: Horizontal Stack (placed side by side along width)
        var totalStackW = 0;
        var maxStackL = 0;
        for (var bi2 = 0; bi2 < blocks.length; bi2++) {
          totalStackW += blocks[bi2].spanW;
          if (blocks[bi2].spanL > maxStackL) maxStackL = blocks[bi2].spanL;
        }

        if (maxStackL <= effL + 0.001 && totalStackW <= effW + 0.001) {
          var placedBlocksH = [];
          var currX = 0;
          for (var bIdx2 = 0; bIdx2 < blocks.length; bIdx2++) {
            var b2 = blocks[bIdx2];
            placedBlocksH.push(Object.assign({}, b2, {
              xOffset: currX,
              yOffset: 0
            }));
            currX += b2.spanW;
          }

          addMultiCandidate({
            formation: "stack-h",
            formationLabel: "Horizontal Stack",
            pL: pL, pW: pW, ni: ni, mi: mi,
            totalPieces: totalPieces,
            blocks: placedBlocksH,
            boundL: maxStackL, boundW: totalStackW
          });
        }
      }
    }
  }

  function addMultiCandidate(cfg) {
    var totalTagArea = 0;
    for (var i = 0; i < cfg.blocks.length; i++) {
      var bk = cfg.blocks[i];
      // Area of tags on one die piece
      totalTagArea += (bk.count * bk.tagL * bk.tagW);
    }

    // 1 sheet produces (cfg.totalPieces * actualUps) tags of EACH design
    var tagsPerSheetPerTag = cfg.totalPieces * actualUps;
    var sheetsNeeded = actualOrderQty > 0 ? Math.ceil(actualOrderQty / tagsPerSheetPerTag) : 0;
    var totalPiecesRun = sheetsNeeded * cfg.totalPieces;
    var tagsProducedPerTag = totalPiecesRun * actualUps;
    var totalTagsAll = tagsProducedPerTag * validTags.length;

    var totalTagsPerSheet = totalSlots * cfg.totalPieces;
    var totalSheetTagArea = cfg.totalPieces * totalTagArea;
    var util = sheetArea > 0 ? Math.min(100, (totalSheetTagArea / sheetArea) * 100) : 0;
    var wastePct = Math.max(0, 100 - util);

    var descParts = cfg.blocks.map(function(b) {
      return b.tagName + " (" + b.rows + "x" + b.cols + (b.isRotated ? "R" : "") + ")";
    });
    var k = cfg.ni + "x" + cfg.mi + "|" + cfg.formation + "|" + descParts.join("+");
    if (seen[k]) return;
    seen[k] = true;

    candidates.push({
      isMultiTag: true,
      formation: cfg.formation,
      formationLabel: cfg.formationLabel,
      desc: "Combo Die: " + descParts.join(" + "),
      tagDesc: descParts.join(" + "),
      pieceDesc: cfg.ni + " x " + cfg.mi + " (" + cfg.pL.toFixed(2) + '" x ' + cfg.pW.toFixed(2) + '")',
      n: cfg.ni,
      m: cfg.mi,
      pieceL: cfg.pL,
      pieceW: cfg.pW,
      totalPieces: cfg.totalPieces,
      autoPiecesPerSheet: cfg.totalPieces,
      tagsRows: cfg.blocks[0] ? cfg.blocks[0].rows : 1,
      tagsCols: cfg.blocks[0] ? cfg.blocks[0].cols : 1,
      tagsPerPieceNominal: totalSlots,
      totalTagsPerSheet: totalTagsPerSheet,
      reclaimedTags: 0,
      reclaimedTagsPerPiece: 0,
      leftoverL: Math.max(0, cfg.pL - cfg.boundL),
      leftoverW: Math.max(0, cfg.pW - cfg.boundW),
      sheetsNeeded: sheetsNeeded,
      totalPiecesRun: totalPiecesRun,
      tagsProducedPerTag: tagsProducedPerTag,
      totalTags: totalTagsAll,
      utilization: util,
      wastePct: wastePct,
      blocks: cfg.blocks,
      tagsList: validTags,
      upsPerTag: actualUps,
      totalSlots: totalSlots,
      TL: validTags[0] ? Number(validTags[0].l) : 0,
      TW: validTags[0] ? Number(validTags[0].w) : 0,
      feedMode: feedLabel,
      balanceScore: 100
    });
  }

  // Sort candidates by highest sheet utilization, then smallest sheet waste
  candidates.sort(function(a, b) {
    if (Math.abs(b.utilization - a.utilization) > 0.1) return b.utilization - a.utilization;
    if (a.sheetsNeeded !== b.sheetsNeeded) return a.sheetsNeeded - b.sheetsNeeded;
    return (b.pieceL * b.pieceW) - (a.pieceL * a.pieceW);
  });

  return candidates;
}

/**
 * Compute detailed job costing and per-tag selling prices for a Multi-Tag Die run.
 * Order quantity is strictly treated as required tags per SKU/design.
 * All tags have identical UPs (upsPerTag).
 * Selling prices and costs are allocated strictly proportional to physical tag surface area.
 */
function computeMultiTagCosts(layout, tagsList, params, upsPerTag) {
  var sheetRate = Number(params.sheetRate) || 0;
  var orderQty = Math.max(1, Math.round(Number(params.orderQty) || 5000));
  var actualUps = Math.max(1, Math.round(Number(params.upsPerTag || upsPerTag || (layout && layout.upsPerTag) || (tagsList && tagsList[0] && tagsList[0].slots) || 1)));
  var printMethod = params.printMethod || "offset";
  var colors = Number(params.colors) || 1;
  var lamination = !!params.lamination;
  var transport = Number(params.transport) || 0;
  var effectiveMarginPct = Number(params.effectiveMarginPct) || 0;
  var effectiveMarginMode = params.effectiveMarginMode || "markup";
  var repeatDie = !!params.repeatDie;
  var foil = !!params.foil;
  var foilL = Number(params.foilL) || 0;
  var foilW = Number(params.foilW) || 0;
  var emboss = !!params.emboss;
  var embossL = Number(params.embossL) || 0;
  var embossW = Number(params.embossW) || 0;

  var r = layout && layout.result ? layout.result : layout;
  var piecesPerSheet = (r && r.totalPieces) ? r.totalPieces : 1;

  var validTags = (r.tagsList && r.tagsList.length > 0) ? r.tagsList : tagsList;
  if (!validTags || validTags.length === 0) validTags = [{ name: "Tag 1", l: 2, w: 3 }];
  var totalSlots = validTags.length * actualUps;

  // Order quantity is required tags per design.
  // 1 sheet produces (piecesPerSheet * actualUps) tags of EACH design.
  var tagsPerSheetPerTag = piecesPerSheet * actualUps;
  var sheetsNeeded = Math.ceil(orderQty / tagsPerSheetPerTag);
  var totalPieces = sheetsNeeded * piecesPerSheet; // Total machine pulls/impressions
  var tagsProducedPerTag = totalPieces * actualUps;
  var totalTagsAll = tagsProducedPerTag * validTags.length;

  var materialCost = sheetsNeeded * sheetRate;

  // Printing cost based on total machine pieces (pulls) run
  var printSlabs = computeSlabs(totalPieces);
  var printingCost = 0;
  if (totalPieces > 0) {
    if (printMethod === "offset") {
      printingCost = PROCESS_RATES.printing.offsetBase + (printSlabs - 1) * PROCESS_RATES.printing.offsetSlabIncrement;
    } else {
      printingCost = colors * PROCESS_RATES.printing.handPerColor * printSlabs;
    }
  }

  // Lamination cost based on piece area
  var pieceAreaSqIn = (r.pieceL || 0) * (r.pieceW || 0);
  var laminationAreaSqIn = pieceAreaSqIn * totalPieces;
  var laminationCost = lamination ? laminationAreaSqIn * PROCESS_RATES.lamination.ratePerSqIn : 0;

  // Foil calculation based on total tags run
  var foilArea = foilL * foilW;
  var foilPieceRate = foilArea <= 4 ? 0.20 : (foilArea <= 8 ? 0.25 : 0.30);
  var foilBlockCost = (foil && totalTagsAll > 0) ? 250 : 0;
  var foilRunningCost = (foil && totalTagsAll > 0) ? totalTagsAll * foilPieceRate : 0;
  var foilCost = foilBlockCost + foilRunningCost;

  // Emboss calculation based on total tags run
  var embossArea = embossL * embossW;
  var embossPieceRate = embossArea <= 6 ? 0.25 : 0.30;
  var embossBlockCost = (emboss && totalTagsAll > 0) ? (embossArea <= 6 ? 500 : 1000) : 0;
  var embossRunningCost = (emboss && totalTagsAll > 0) ? totalTagsAll * embossPieceRate : 0;
  var embossCost = embossBlockCost + embossRunningCost;

  // Die Making and Running
  var tier = pieceTier(r.pieceL, r.pieceW);
  var dieSlabs = computeSlabs(totalPieces);
  var dieRunningCost = totalPieces > 0 ? tier.runRate * dieSlabs : 0;
  var dieMakingCost = (totalPieces > 0 && !repeatDie) ? tier.dieCost : 0;
  var dieTotalCost = dieMakingCost + dieRunningCost;

  var transportCost = totalPieces > 0 ? transport : 0;

  var subtotal = materialCost + printingCost + laminationCost + dieTotalCost + transportCost + foilCost + embossCost;

  var sellingPrice = 0;
  if (effectiveMarginMode === "markup") {
    var factor = 1 + effectiveMarginPct / 100;
    sellingPrice = subtotal * factor;
  } else {
    var denom = 1 - effectiveMarginPct / 100;
    sellingPrice = denom > 0 ? subtotal / denom : NaN;
  }

  var profitAmount = sellingPrice - subtotal;

  // Proportional itemized breakdown per tag based on physical surface area.
  // Since all tags have the same upsPerTag, each tag's share of total die surface area
  // is directly (l_i * w_i) / sum(l_j * w_j).
  var totalSingleTagArea = validTags.reduce(function(acc, t) {
    return acc + (Number(t.l) * Number(t.w));
  }, 0);
  if (totalSingleTagArea <= 0) totalSingleTagArea = 1;

  var itemizedTags = validTags.map(function(t, idx) {
    var tL = Number(t.l);
    var tW = Number(t.w);
    var tagArea = tL * tW;
    var areaShare = tagArea / totalSingleTagArea;

    var tagAllocatedCost = subtotal * areaShare;
    var tagAllocatedPrice = sellingPrice * areaShare;

    var costPerTag = tagsProducedPerTag > 0 ? tagAllocatedCost / tagsProducedPerTag : 0;
    var pricePerTag = tagsProducedPerTag > 0 ? tagAllocatedPrice / tagsProducedPerTag : 0;

    return {
      id: t.id || ("t_" + idx),
      name: t.name || ("Tag " + (idx + 1)),
      prefix: String.fromCharCode(65 + (idx % 26)),
      color: getMultiTagColor(idx),
      l: tL,
      w: tW,
      slots: actualUps,
      tagArea: tagArea,
      areaSharePct: (areaShare * 100),
      qtyProduced: tagsProducedPerTag,
      allocatedCost: tagAllocatedCost,
      allocatedPrice: tagAllocatedPrice,
      costPerTag: costPerTag,
      pricePerTag: pricePerTag
    };
  });

  return {
    isMultiTag: true,
    orderQty: orderQty,
    upsPerTag: actualUps,
    tagsProducedPerTag: tagsProducedPerTag,
    totalTags: totalTagsAll,
    totalSlots: totalSlots,
    sheetsNeeded: sheetsNeeded,
    totalPieces: totalPieces,
    materialCost: materialCost,
    printingCost: printingCost,
    laminationCost: laminationCost,
    dieTotalCost: dieTotalCost,
    dieMakingCost: dieMakingCost,
    dieRunningCost: dieRunningCost,
    transportCost: transportCost,
    foilCost: foilCost,
    foilBlockCost: foilBlockCost,
    foilRunningCost: foilRunningCost,
    foilPieceRate: foilPieceRate,
    foilArea: foilArea,
    embossCost: embossCost,
    embossBlockCost: embossBlockCost,
    embossRunningCost: embossRunningCost,
    embossPieceRate: embossPieceRate,
    embossArea: embossArea,
    subtotal: subtotal,
    rawSubtotal: subtotal,
    rawCostPerTag: totalTagsAll > 0 ? subtotal / totalTagsAll : 0,
    exactSellingPrice: sellingPrice,
    exactPricePerTag: totalTagsAll > 0 ? sellingPrice / totalTagsAll : 0,
    pricePerTag: totalTagsAll > 0 ? sellingPrice / totalTagsAll : 0,
    sellingPrice: sellingPrice,
    profitAmount: profitAmount,
    overage: totalTagsAll - (orderQty * validTags.length),
    itemizedTags: itemizedTags,
    tier: tier,
    printSlabs: printSlabs,
    dieSlabs: dieSlabs,
    pieceAreaSqIn: pieceAreaSqIn,
    lamination: lamination,
    foil: foil,
    foilL: foilL,
    foilW: foilW,
    emboss: emboss,
    embossL: embossL,
    embossW: embossW,
    n: r.n,
    m: r.m,
    pieceL: r.pieceL,
    pieceW: r.pieceW,
    autoPiecesPerSheet: piecesPerSheet,
    tagsRows: r.tagsRows,
    tagsCols: r.tagsCols,
    tagsPerPieceNominal: totalSlots,
    totalTagsPerSheet: r.totalTagsPerSheet,
    leftoverL: r.leftoverL,
    leftoverW: r.leftoverW,
    utilization: r.utilization,
    wastePct: r.wastePct,
    formation: r.formation,
    formationLabel: r.formationLabel,
    TL: r.TL || validTags[0].l,
    TW: r.TW || validTags[0].w,
    blocks: r.blocks
  };
}
