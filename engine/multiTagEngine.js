/**
 * Taggers Calc - Multi-Tag Die Engine (v2.4)
 * Supports multiple tag sizes and quantities on a single die (Gang / Combo Die).
 * The app automatically determines the optimal cavity (UP) ratio from the tags' quantities
 * (e.g. 3 tags of 5k + 1 tag of 10k -> 1 UP : 1 UP : 1 UP : 2 UP ratio).
 * It explores layout formations (vertical stack, horizontal stack, 2-column gang split),
 * calculates required sheets & machine pulls so all tags fulfill their orders with minimum waste,
 * and allocates costs and selling prices strictly proportional to physical die surface area.
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

function gcd(a, b) {
  while (b) { var t = b; b = a % b; a = t; }
  return a;
}

function _computeSlabsLocal(qty, base, grace) {
  if (typeof computeSlabs === "function") return computeSlabs(qty, base, grace);
  if (base === undefined) base = 1000;
  if (grace === undefined) grace = 200;
  if (qty <= 0) return 0;
  return Math.max(1, Math.ceil((qty - grace) / base));
}

function _pieceTierLocal(pieceL, pieceW) {
  if (typeof pieceTier === "function") return pieceTier(pieceL, pieceW);
  function fitsBox(a, b, boxA, boxB) { return (a <= boxA && b <= boxB) || (a <= boxB && b <= boxA); }
  if (fitsBox(pieceL, pieceW, 9, 12)) return { tier: "small", label: 'Up to 9" x 12"', dieCost: 1200, runRate: 500 };
  if (fitsBox(pieceL, pieceW, 14, 20)) return { tier: "medium", label: 'Up to 14" x 20"', dieCost: 1600, runRate: 500 };
  return { tier: "large", label: 'Bigger than 14" x 20"', dieCost: 2800, runRate: 750 };
}

var _DEFAULT_RATES = {
  printing: { offsetBase: 2000, offsetSlabIncrement: 350, handPerColor: 500 },
  lamination: { ratePerSqIn: 0.004 }
};

/**
 * Automatically determine the integer UP ratio from each tag's entered quantity.
 * e.g. [5000, 5000, 5000, 10000] -> [1, 1, 1, 2]
 */
function calculateTagUpRatio(tagsList) {
  if (!tagsList || tagsList.length === 0) return [];
  var valid = tagsList.filter(function(t) {
    return t && Number(t.l) > 0 && Number(t.w) > 0;
  });
  if (valid.length === 0) return [];

  var rawQtys = valid.map(function(t) {
    return Math.max(1, Math.round(Number(t.qty) || 5000));
  });

  // 1. Try exact GCD on raw quantities
  var rawGcd = rawQtys[0];
  for (var i = 1; i < rawQtys.length; i++) {
    rawGcd = gcd(rawGcd, rawQtys[i]);
  }
  var exactUps = rawQtys.map(function(q) { return Math.round(q / rawGcd); });
  var exactSum = exactUps.reduce(function(a, b) { return a + b; }, 0);
  var exactMax = Math.max.apply(null, exactUps);

  if (exactSum <= 20 && exactMax <= 10) {
    return valid.map(function(t, idx) {
      return Object.assign({}, t, {
        ratioUp: exactUps[idx],
        baseSlots: exactUps[idx]
      });
    });
  }

  // 2. Try rounding to nearest steps (500, 250, 100) and checking GCD
  var roundSteps = [500, 250, 100];
  for (var s = 0; s < roundSteps.length; s++) {
    var step = roundSteps[s];
    var roundedQtys = rawQtys.map(function(q) {
      return Math.max(step, Math.round(q / step) * step);
    });
    var stepGcd = roundedQtys[0];
    for (var j = 1; j < roundedQtys.length; j++) {
      stepGcd = gcd(stepGcd, roundedQtys[j]);
    }
    var stepUps = roundedQtys.map(function(q) { return Math.round(q / stepGcd); });
    var stepSum = stepUps.reduce(function(a, b) { return a + b; }, 0);
    var stepMax = Math.max.apply(null, stepUps);
    if (stepSum <= 20 && stepMax <= 10) {
      return valid.map(function(t, idx) {
        return Object.assign({}, t, {
          ratioUp: stepUps[idx],
          baseSlots: stepUps[idx]
        });
      });
    }
  }

  // 3. Fallback: Search small multiplier D in 1..6 for closest integer ratio
  var minQ = Math.min.apply(null, rawQtys);
  var floatRatios = rawQtys.map(function(q) { return q / minQ; });
  var bestD = 1;
  var minErr = Infinity;

  for (var D = 1; D <= 6; D++) {
    var err = 0;
    var candUps = [];
    for (var k = 0; k < floatRatios.length; k++) {
      var target = floatRatios[k] * D;
      var r = Math.round(target);
      err += Math.abs(target - r);
      candUps.push(r);
    }
    var cSum = candUps.reduce(function(a, b) { return a + b; }, 0);
    if (cSum <= 20 && err < minErr) {
      minErr = err;
      bestD = D;
      if (err < 0.01) break;
    }
  }

  var finalUps = floatRatios.map(function(r) { return Math.max(1, Math.round(r * bestD)); });
  var gFinal = finalUps[0];
  for (var m = 1; m < finalUps.length; m++) {
    gFinal = gcd(gFinal, finalUps[m]);
  }
  finalUps = finalUps.map(function(u) { return Math.max(1, Math.round(u / gFinal)); });

  return valid.map(function(t, idx) {
    return Object.assign({}, t, {
      ratioUp: finalUps[idx],
      baseSlots: finalUps[idx]
    });
  });
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
 * User specifies tag dimensions and quantity for each tag.
 * The engine calculates the cavity ratio, tests multipliers (1x, 2x...),
 * packs blocks onto pieces, and evaluates complete job nesting.
 */
function generateMultiTagLayouts(sheetL, sheetW, tagsList, overlapIn, marginIn, feedOffset, feedHand) {
  if (!sheetL || !sheetW || sheetL <= 0 || sheetW <= 0) return [];
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) return [];

  // Filter valid tags
  var validTags = tagsList.filter(function(t) {
    return t && Number(t.l) > 0 && Number(t.w) > 0;
  });
  if (validTags.length === 0) return [];

  // Calculate base UP ratio from entered quantities
  var tagsWithRatio = calculateTagUpRatio(validTags);
  var baseSlotsSum = tagsWithRatio.reduce(function(a, t) { return a + t.baseSlots; }, 0);
  if (baseSlotsSum < 1) return [];

  var actualOverlap = Number(overlapIn) || 0;
  var actualMargin = Number(marginIn) || 0;

  var candidates = [];
  var seen = {};

  var feedL = 0, feedW = 0, feedLabel = "Default";
  var isHandFeed = false;
  if (feedOffset && feedOffset[0] > 0 && feedOffset[1] > 0) {
    feedL = feedOffset[0]; feedW = feedOffset[1];
    feedLabel = "Offset feed " + feedOffset[0] + "x" + feedOffset[1];
  } else if (feedHand && feedHand[0] > 0 && feedHand[1] > 0) {
    feedL = feedHand[0]; feedW = feedHand[1];
    feedLabel = "Hand feed " + feedHand[0] + "x" + feedHand[1];
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

  var sheetArea = sheetL * sheetW;

  // Test multipliers: M = 1, 2, 3, 4 (keeping total cavities <= 28)
  var multipliers = [1];
  if (baseSlotsSum * 2 <= 28) multipliers.push(2);
  if (baseSlotsSum * 3 <= 28) multipliers.push(3);
  if (baseSlotsSum * 4 <= 28) multipliers.push(4);

  multipliers.forEach(function(M) {
    var totalSlotsThisM = baseSlotsSum * M;

    // Generate block options for each tag at multiplier M
    var tagBlockOptions = tagsWithRatio.map(function(t, tIdx) {
      var slots = t.baseSlots * M;
      var tL = Number(t.l);
      var tW = Number(t.w);
      var color = getMultiTagColor(tIdx);
      var prefix = String.fromCharCode(65 + (tIdx % 26));

      var factorPairs = getSlotFactorPairs(slots);
      var blockVariations = [];

      factorPairs.forEach(function(pair) {
        var rows = pair[0];
        var cols = pair[1];

        // Normal orientation
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
          targetQty: Math.max(1, Math.round(Number(t.qty) || 5000)),
          ratioUp: t.ratioUp,
          slots: slots,
          rows: rows,
          cols: cols,
          cutL: cutL_norm,
          cutW: cutW_norm,
          isRotated: false,
          spanL: spanL_norm,
          spanW: spanW_norm,
          count: rows * cols
        });

        // Rotated 90°
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
          targetQty: Math.max(1, Math.round(Number(t.qty) || 5000)),
          ratioUp: t.ratioUp,
          slots: slots,
          rows: rows,
          cols: cols,
          cutL: cutL_rot,
          cutW: cutW_rot,
          isRotated: true,
          spanL: spanL_rot,
          spanW: spanW_rot,
          count: rows * cols
        });
      });

      return blockVariations;
    });

    var blockCombinations = getBlockCombinations(tagBlockOptions);

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

          // Formation 1: Vertical Stack
          var totalStackL = 0;
          var maxStackW = 0;
          for (var bi = 0; bi < blocks.length; bi++) {
            totalStackL += blocks[bi].spanL;
            if (blocks[bi].spanW > maxStackW) maxStackW = blocks[bi].spanW;
          }

          if (totalStackL <= effL + 0.001 && maxStackW <= effW + 0.001) {
            var placedBlocksV = [];
            var currY = 0;
            for (var bIdx = 0; bIdx < blocks.length; bIdx++) {
              placedBlocksV.push(Object.assign({}, blocks[bIdx], {
                xOffset: 0,
                yOffset: currY
              }));
              currY += blocks[bIdx].spanL;
            }

            addMultiCandidate({
              multiplier: M,
              formation: "stack-v",
              formationLabel: "Vertical Stack (" + M + "x ratio)",
              pL: pL, pW: pW, ni: ni, mi: mi,
              totalPieces: totalPieces,
              blocks: placedBlocksV,
              boundL: totalStackL, boundW: maxStackW,
              totalSlotsThisM: totalSlotsThisM
            });
          }

          // Formation 2: Horizontal Stack
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
              placedBlocksH.push(Object.assign({}, blocks[bIdx2], {
                xOffset: currX,
                yOffset: 0
              }));
              currX += blocks[bIdx2].spanW;
            }

            addMultiCandidate({
              multiplier: M,
              formation: "stack-h",
              formationLabel: "Horizontal Stack (" + M + "x ratio)",
              pL: pL, pW: pW, ni: ni, mi: mi,
              totalPieces: totalPieces,
              blocks: placedBlocksH,
              boundL: maxStackL, boundW: totalStackW,
              totalSlotsThisM: totalSlotsThisM
            });
          }

          // Formation 3: 2-Column Split (Gang Layout matching photo)
          if (blocks.length >= 2) {
            for (var splitIdx = 1; splitIdx < blocks.length; splitIdx++) {
              var leftBlocks = blocks.slice(0, splitIdx);
              var rightBlocks = blocks.slice(splitIdx);

              var leftSpanW = 0, leftSpanL = 0;
              leftBlocks.forEach(function(b) {
                leftSpanL += b.spanL;
                if (b.spanW > leftSpanW) leftSpanW = b.spanW;
              });

              var rightSpanW = 0, rightSpanL = 0;
              rightBlocks.forEach(function(b) {
                rightSpanL += b.spanL;
                if (b.spanW > rightSpanW) rightSpanW = b.spanW;
              });

              var gangTotalW = leftSpanW + rightSpanW;
              var gangMaxL = Math.max(leftSpanL, rightSpanL);

              if (gangMaxL <= effL + 0.001 && gangTotalW <= effW + 0.001) {
                var placedGang = [];
                var yL = 0;
                leftBlocks.forEach(function(b) {
                  placedGang.push(Object.assign({}, b, { xOffset: 0, yOffset: yL }));
                  yL += b.spanL;
                });
                var yR = 0;
                rightBlocks.forEach(function(b) {
                  placedGang.push(Object.assign({}, b, { xOffset: leftSpanW, yOffset: yR }));
                  yR += b.spanL;
                });

                addMultiCandidate({
                  multiplier: M,
                  formation: "gang-col",
                  formationLabel: "2-Column Gang (" + M + "x ratio)",
                  pL: pL, pW: pW, ni: ni, mi: mi,
                  totalPieces: totalPieces,
                  blocks: placedGang,
                  boundL: gangMaxL, boundW: gangTotalW,
                  totalSlotsThisM: totalSlotsThisM
                });
              }
            }
          }
        }
      }
    }
  });

  function addMultiCandidate(cfg) {
    var totalTagArea = 0;
    for (var i = 0; i < cfg.blocks.length; i++) {
      var bk = cfg.blocks[i];
      totalTagArea += (bk.count * bk.tagL * bk.tagW);
    }

    // Determine sheets needed so EVERY tag fulfills its entered order quantity
    var sheetsNeeded = 0;
    cfg.blocks.forEach(function(bk) {
      var tagsPerSheetForThisTag = cfg.totalPieces * bk.slots;
      var sheetsForThis = Math.ceil(bk.targetQty / tagsPerSheetForThisTag);
      if (sheetsForThis > sheetsNeeded) {
        sheetsNeeded = sheetsForThis;
      }
    });

    var totalPiecesRun = sheetsNeeded * cfg.totalPieces;
    var totalTagsAll = 0;
    cfg.blocks.forEach(function(bk) {
      totalTagsAll += (totalPiecesRun * bk.slots);
    });

    var totalTagsPerSheet = cfg.totalSlotsThisM * cfg.totalPieces;
    var totalSheetTagArea = cfg.totalPieces * totalTagArea;
    var util = sheetArea > 0 ? Math.min(100, (totalSheetTagArea / sheetArea) * 100) : 0;
    var wastePct = Math.max(0, 100 - util);

    var descParts = cfg.blocks.map(function(b) {
      return b.tagName + " (" + b.slots + " UP)";
    });
    var k = cfg.ni + "x" + cfg.mi + "|" + cfg.formation + "|" + cfg.multiplier + "x|" + descParts.join("+");
    if (seen[k]) return;
    seen[k] = true;

    candidates.push({
      isMultiTag: true,
      multiplier: cfg.multiplier,
      formation: cfg.formation,
      formationLabel: cfg.formationLabel,
      desc: "Combo Die: " + descParts.join(" + ") + " [" + cfg.formationLabel + "]",
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
      tagsPerPieceNominal: cfg.totalSlotsThisM,
      totalTagsPerSheet: totalTagsPerSheet,
      reclaimedTags: 0,
      reclaimedTagsPerPiece: 0,
      leftoverL: Math.max(0, cfg.pL - cfg.boundL),
      leftoverW: Math.max(0, cfg.pW - cfg.boundW),
      sheetsNeeded: sheetsNeeded,
      totalPiecesRun: totalPiecesRun,
      totalTags: totalTagsAll,
      utilization: util,
      wastePct: wastePct,
      blocks: cfg.blocks,
      tagsList: tagsWithRatio,
      totalSlots: cfg.totalSlotsThisM,
      TL: tagsWithRatio[0] ? Number(tagsWithRatio[0].l) : 0,
      TW: tagsWithRatio[0] ? Number(tagsWithRatio[0].w) : 0,
      feedMode: feedLabel,
      balanceScore: 100
    });
  }

  // Sort candidates by highest sheet utilization, then smallest sheet count
  candidates.sort(function(a, b) {
    if (Math.abs(b.utilization - a.utilization) > 0.1) return b.utilization - a.utilization;
    if (a.sheetsNeeded !== b.sheetsNeeded) return a.sheetsNeeded - b.sheetsNeeded;
    return (b.pieceL * b.pieceW) - (a.pieceL * a.pieceW);
  });

  return candidates;
}

/**
 * Compute detailed job costing and per-tag selling prices for a Multi-Tag Die run.
 * Quantities are specified per tag SKU.
 * Selling prices and costs are allocated strictly proportional to each tag's physical die surface area.
 */
function computeMultiTagCosts(layout, tagsList, params) {
  var sheetRate = Number(params.sheetRate) || 0;
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
  var actualOverlap = Number(params.overlapIn) || 0;
  var actualMargin = Number(params.marginIn) || 0;

  var r = layout && layout.result ? layout.result : layout;
  var piecesPerSheet = (r && r.totalPieces) ? r.totalPieces : 1;

  var blocks = (r && r.blocks) ? r.blocks : [];
  var sheetsNeeded = r ? (r.sheetsNeeded || 1) : 1;
  var totalPieces = sheetsNeeded * piecesPerSheet; // Total machine pulls/impressions

  var materialCost = sheetsNeeded * sheetRate;

  var rates = (typeof PROCESS_RATES !== "undefined" && PROCESS_RATES) ? PROCESS_RATES : _DEFAULT_RATES;

  // Printing cost based on total machine pieces (pulls) run
  var printSlabs = _computeSlabsLocal(totalPieces);
  var printingCost = 0;
  if (totalPieces > 0) {
    if (printMethod === "offset") {
      printingCost = rates.printing.offsetBase + (printSlabs - 1) * rates.printing.offsetSlabIncrement;
    } else {
      printingCost = colors * rates.printing.handPerColor * printSlabs;
    }
  }

  // Lamination cost based on piece area
  var pieceAreaSqIn = (r.pieceL || 0) * (r.pieceW || 0);
  var laminationAreaSqIn = pieceAreaSqIn * totalPieces;
  var laminationCost = lamination ? laminationAreaSqIn * rates.lamination.ratePerSqIn : 0;

  // Calculate produced quantities and total tags
  var totalTagsAll = 0;
  blocks.forEach(function(b) {
    totalTagsAll += (totalPieces * b.slots);
  });
  if (totalTagsAll <= 0) totalTagsAll = totalPieces * (r.totalSlots || 1);

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
  var tier = _pieceTierLocal(r.pieceL, r.pieceW);
  var dieSlabs = _computeSlabsLocal(totalPieces);
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

  // Proportional itemized breakdown per tag based on total die slot surface area
  // Area on die for tag i = slots_i * L_i * W_i
  var totalDieSurfaceArea = blocks.reduce(function(acc, b) {
    return acc + (b.slots * b.tagL * b.tagW);
  }, 0);
  if (totalDieSurfaceArea <= 0) totalDieSurfaceArea = 1;

  var itemizedTags = blocks.map(function(b, idx) {
    var tagArea = b.tagL * b.tagW;
    var tagTotalDieArea = b.slots * tagArea;
    var areaShare = tagTotalDieArea / totalDieSurfaceArea;

    var qtyProduced = totalPieces * b.slots;
    var tagAllocatedCost = subtotal * areaShare;
    var tagAllocatedPrice = sellingPrice * areaShare;

    var costPerTag = qtyProduced > 0 ? tagAllocatedCost / qtyProduced : 0;
    var pricePerTag = qtyProduced > 0 ? tagAllocatedPrice / qtyProduced : 0;

    return {
      id: "mt_" + idx,
      name: b.tagName,
      prefix: b.tagPrefix,
      color: b.tagColor,
      l: b.tagL,
      w: b.tagW,
      targetQty: b.targetQty,
      qtyRequired: b.targetQty,
      ratioUp: b.ratioUp,
      slots: b.slots,
      tagArea: tagArea,
      areaSharePct: (areaShare * 100),
      qtyProduced: qtyProduced,
      allocatedCost: tagAllocatedCost,
      allocatedPrice: tagAllocatedPrice,
      costPerTag: costPerTag,
      pricePerTag: pricePerTag
    };
  });

  return {
    isMultiTag: true,
    totalSlots: r.totalSlots,
    multiplier: r.multiplier || 1,
    itemizedTags: itemizedTags,
    pieceL: r.pieceL, pieceW: r.pieceW,
    n: r.n, m: r.m,
    overlapIn: actualOverlap, marginIn: actualMargin,
    totalTagsPerSheet: r.totalTagsPerSheet,
    autoPiecesPerSheet: piecesPerSheet,
    piecesPerSheet: piecesPerSheet,
    sheetsNeeded: sheetsNeeded,
    totalPieces: totalPieces,
    totalTags: totalTagsAll,
    materialCost: materialCost,
    printSlabs: printSlabs,
    printingCost: printingCost,
    pieceAreaSqIn: pieceAreaSqIn,
    laminationCost: laminationCost,
    tier: tier,
    dieSlabs: dieSlabs,
    dieRunningCost: dieRunningCost,
    dieMakingCost: dieMakingCost,
    dieTotalCost: dieTotalCost,
    transportCost: transportCost,
    foilCost: foilCost, foilBlockCost: foilBlockCost, foilRunningCost: foilRunningCost,
    embossCost: embossCost, embossBlockCost: embossBlockCost, embossRunningCost: embossRunningCost,
    subtotal: subtotal,
    rawSubtotal: subtotal,
    costPerTag: totalTagsAll > 0 ? subtotal / totalTagsAll : 0,
    pricePerTag: totalTagsAll > 0 ? sellingPrice / totalTagsAll : 0,
    exactSellingPrice: sellingPrice,
    sellingPrice: sellingPrice,
    profitAmount: profitAmount,
    utilization: r.utilization,
    wastePct: r.wastePct,
    formation: r.formation,
    formationLabel: r.formationLabel,
    TL: r.TL,
    TW: r.TW,
    blocks: r.blocks
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    MULTI_TAG_PALETTE: MULTI_TAG_PALETTE,
    getMultiTagColor: getMultiTagColor,
    calculateTagUpRatio: calculateTagUpRatio,
    generateMultiTagLayouts: generateMultiTagLayouts,
    computeMultiTagCosts: computeMultiTagCosts
  };
}
