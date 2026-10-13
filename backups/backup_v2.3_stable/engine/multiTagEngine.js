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

  if (exactSum <= 28 && exactMax <= 16) {
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
    var tooDistorted = false;
    var roundedQtys = rawQtys.map(function(q) {
      var rq = Math.max(step, Math.round(q / step) * step);
      if (Math.abs(q - rq) / q > 0.05) tooDistorted = true;
      return rq;
    });
    if (tooDistorted) continue;
    var stepGcd = roundedQtys[0];
    for (var j = 1; j < roundedQtys.length; j++) {
      stepGcd = gcd(stepGcd, roundedQtys[j]);
    }
    var stepUps = roundedQtys.map(function(q) { return Math.round(q / stepGcd); });
    var stepSum = stepUps.reduce(function(a, b) { return a + b; }, 0);
    var stepMax = Math.max.apply(null, stepUps);
    if (stepSum <= 28 && stepMax <= 16) {
      return valid.map(function(t, idx) {
        return Object.assign({}, t, {
          ratioUp: stepUps[idx],
          baseSlots: stepUps[idx]
        });
      });
    }
  }

  // 3. Fallback: Search small multiplier D in 1..4 for closest integer ratio
  var minQ = Math.min.apply(null, rawQtys);
  var floatRatios = rawQtys.map(function(q) { return q / minQ; });
  var maxRatio = Math.max.apply(null, floatRatios);
  var maxAllowedUp = 16;
  if (maxRatio > maxAllowedUp) {
    var scaleDown = maxAllowedUp / maxRatio;
    floatRatios = floatRatios.map(function(r) { return Math.max(1, Math.round(r * scaleDown)); });
  }

  var bestD = 1;
  var minErr = Infinity;

  for (var D = 1; D <= 4; D++) {
    var err = 0;
    var candUps = [];
    for (var k = 0; k < floatRatios.length; k++) {
      var target = floatRatios[k] * D;
      var r = Math.round(target);
      err += Math.abs(target - r);
      candUps.push(r);
    }
    var cSum = candUps.reduce(function(a, b) { return a + b; }, 0);
    var cMax = Math.max.apply(null, candUps);
    if (cSum <= 28 && cMax <= 16 && err < minErr) {
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

  var sumFinal = finalUps.reduce(function(a, b) { return a + b; }, 0);
  if (sumFinal > 28 || Math.max.apply(null, finalUps) > 16) {
    var maxU = Math.max.apply(null, finalUps);
    finalUps = finalUps.map(function(u) {
      return Math.max(1, Math.min(16, Math.round((u / maxU) * 16)));
    });
  }

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
function generateMultiTagLayouts(sheetL, sheetW, tagsList, overlapIn, marginIn, feedOffset, feedHand, options) {
  if (!sheetL || !sheetW || sheetL <= 0 || sheetW <= 0) return [];
  if (!tagsList || !Array.isArray(tagsList) || tagsList.length === 0) return [];

  var removeSameTagBleed = false;
  var overridePieces = false;
  var manualPiecesPerSheet = 0;
  if (typeof options === "boolean") {
    removeSameTagBleed = options;
  } else if (options && typeof options === "object") {
    if (typeof options.removeSameTagBleed === "boolean") removeSameTagBleed = options.removeSameTagBleed;
    if (options.overridePieces) {
      overridePieces = true;
      manualPiecesPerSheet = Number(options.manualPiecesPerSheet) || 0;
    }
  }

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
  var gutter = 2 * actualOverlap;

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
    if (feedL <= 0 || feedW <= 0) return true;
    return (pl <= feedL + 0.01 && pw <= feedW + 0.01) || (pl <= feedW + 0.01 && pw <= feedL + 0.01);
  }

  function meetsMinSize(pl, pw) {
    if (feedL <= 0 && feedW <= 0) return true;
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

  function runSearchWithTags(activeTags) {
    var baseSlotsSum = activeTags.reduce(function(acc, t) { return acc + (t.baseSlots || 1); }, 0);
    if (baseSlotsSum <= 0) return;

    // Test multipliers: M = 1..maxM (keeping total cavities <= 30)
    var maxM = Math.min(10, Math.floor(30 / baseSlotsSum));
    var multipliers = [];
    for (var mVal = 1; mVal <= maxM; mVal++) {
      multipliers.push(mVal);
    }

    multipliers.forEach(function(M) {
      var totalSlotsThisM = baseSlotsSum * M;

      // Generate block options for each tag at multiplier M
      var tagBlockOptions = activeTags.map(function(t, tIdx) {
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
        var isShared = !!removeSameTagBleed;

        // Normal orientation
        var cutL_norm = isShared ? tL : (tL + 2 * actualOverlap);
        var cutW_norm = isShared ? tW : (tW + 2 * actualOverlap);
        var spanL_norm = isShared ? (rows * tL) : (rows * cutL_norm);
        var spanW_norm = isShared ? (cols * tW) : (cols * cutW_norm);

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
          count: rows * cols,
          sharedCut: isShared,
          crease: !!t.crease
        });

        // Rotated 90°
        var cutL_rot = isShared ? tW : (tW + 2 * actualOverlap);
        var cutW_rot = isShared ? tL : (tL + 2 * actualOverlap);
        var spanL_rot = isShared ? (rows * tW) : (rows * cutL_rot);
        var spanW_rot = isShared ? (cols * tL) : (cols * cutW_rot);

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
          count: rows * cols,
          sharedCut: isShared,
          crease: !!t.crease
        });
      });

      return blockVariations;
    });

    var blockCombinations = getBlockCombinations(tagBlockOptions);

    // Test sheet subdivisions (ni across sheetW, mi down sheetL)
    for (var ni = 1; ni <= 8; ni++) {
      for (var mi = 1; mi <= 8; mi++) {
        var pW = sheetW / ni;
        var pL = sheetL / mi;
        var totalPieces = ni * mi;
        if (overridePieces && manualPiecesPerSheet > 0 && totalPieces !== manualPiecesPerSheet) continue;

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

              var gangColGutter = (leftSpanW > 0 && rightSpanW > 0) ? gutter : 0;
              var gangTotalW = leftSpanW + gangColGutter + rightSpanW;
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
                  placedGang.push(Object.assign({}, b, { xOffset: leftSpanW + gangColGutter, yOffset: yR }));
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

              // Formation 4: 2-Row Split (Top Row + Bottom Row)
              var topBlocks = leftBlocks;
              var btmBlocks = rightBlocks;
              var topSpanW = leftSpanW, topSpanL = leftSpanL;
              var btmSpanW = rightSpanW, btmSpanL = rightSpanL;
              var gangRowGutter = (topSpanL > 0 && btmSpanL > 0) ? gutter : 0;
              var gangRowTotalL = topSpanL + gangRowGutter + btmSpanL;
              var gangRowMaxW = Math.max(topSpanW, btmSpanW);

              if (gangRowTotalL <= effL + 0.001 && gangRowMaxW <= effW + 0.001) {
                var placedGangRow = [];
                var xT = 0;
                topBlocks.forEach(function(b) {
                  placedGangRow.push(Object.assign({}, b, { xOffset: xT, yOffset: 0 }));
                  xT += b.spanW;
                });
                var xB = 0;
                btmBlocks.forEach(function(b) {
                  placedGangRow.push(Object.assign({}, b, { xOffset: xB, yOffset: topSpanL + gangRowGutter }));
                  xB += b.spanW;
                });

                addMultiCandidate({
                  multiplier: M,
                  formation: "gang-row",
                  formationLabel: "2-Row Gang (" + M + "x ratio)",
                  pL: pL, pW: pW, ni: ni, mi: mi,
                  totalPieces: totalPieces,
                  blocks: placedGangRow,
                  boundL: gangRowTotalL, boundW: gangRowMaxW,
                  totalSlotsThisM: totalSlotsThisM
                });
              }
            }
          }
        } // end ci

        // Formation 5: Compound Band Gang (Header Band + Multi-column Footer)
        if (activeTags.length >= 2) {
          runCompoundBandSearch(pL, pW, ni, mi, totalPieces, effL, effW, M, totalSlotsThisM);
        }
      }
    }
  });

  function runCompoundBandSearch(pL_cur, pW_cur, ni_cur, mi_cur, totalPieces_cur, maxL_box, maxW_box, mult_cur, totalSlots_cur) {
    if (activeTags.length < 2) return;

    var orientations = [
      { wLimit: maxW_box, lLimit: maxL_box, isSwapped: false },
      { wLimit: maxL_box, lLimit: maxW_box, isSwapped: true }
    ];

    orientations.forEach(function(box) {
      var boxW = box.wLimit;
      var boxL = box.lLimit;

      for (var aIdx = 0; aIdx < activeTags.length; aIdx++) {
        var tA = activeTags[aIdx];
        var slotsA = tA.baseSlots * mult_cur;

        var orientsA = [
          { w: Number(tA.w), l: Number(tA.l), isRot: false },
          { w: Number(tA.l), l: Number(tA.w), isRot: true }
        ];

        for (var oa = 0; oa < orientsA.length; oa++) {
          var oA = orientsA[oa];
          var wA = oA.w;
          var lA = oA.l;

          for (var rA = 1; rA <= slotsA; rA++) {
            if (slotsA % rA !== 0) continue;
            var numStripsA = slotsA / rA;
            var stripH_A = rA * lA;
            var stripW_A = wA;

            for (var k2 = 1; k2 < numStripsA; k2++) {
              var k1 = numStripsA - k2;
              var b1W = k1 * stripW_A + (k1 - 1) * gutter;
              var b1H = stripH_A;

              if (b1W > boxW + 0.001 || b1H > boxL + 0.001) continue;

              if (activeTags.length === 3) {
                for (var cIdx = 0; cIdx < activeTags.length; cIdx++) {
                  if (cIdx === aIdx) continue;
                  var tC = activeTags[cIdx];
                  var slotsC = tC.baseSlots * mult_cur;

                  var orientsC = [
                    { w: Number(tC.w), l: Number(tC.l), isRot: false },
                    { w: Number(tC.l), l: Number(tC.w), isRot: true }
                  ];

                  for (var oc = 0; oc < orientsC.length; oc++) {
                    var oC = orientsC[oc];
                    var wC = oC.w;
                    var lC = oC.l;

                    for (var rC = 1; rC <= slotsC; rC++) {
                      if (slotsC % rC !== 0) continue;
                      var numStripsC = slotsC / rC;
                      if (numStripsC !== k2) continue;
                      if (Math.abs(wA - wC) > 0.1) continue;

                      var stripH_C = rC * lC;
                      var stripW_C = wC;
                      var bIdx = 3 - aIdx - cIdx;
                      var tB = activeTags[bIdx];
                      var slotsB = tB.baseSlots * mult_cur;

                      var orientsB = [
                        { w: Number(tB.w), l: Number(tB.l), isRot: false },
                        { w: Number(tB.l), l: Number(tB.w), isRot: true }
                      ];

                      for (var ob = 0; ob < orientsB.length; ob++) {
                        var oB = orientsB[ob];
                        var wB = oB.w;
                        var lB = oB.l;

                        for (var rB = 1; rB <= slotsB; rB++) {
                          if (slotsB % rB !== 0) continue;
                          var numStripsB = slotsB / rB;
                          var stripH_B = rB * lB;
                          var stripW_B = wB;

                          var b2W = numStripsB * stripW_B + k2 * stripW_A + (numStripsB + k2 - 1) * gutter;
                          var colAC_H = stripH_A + gutter + stripH_C;
                          var b2H = Math.max(stripH_B, colAC_H);

                          var totalW = Math.max(b1W, b2W);
                          var totalH = b1H + gutter + b2H;

                          if (totalW <= boxW + 0.001 && totalH <= boxL + 0.001) {
                            var placedBlocks = [];

                            // Band 1: k1 strips of Tag A
                            for (var i1 = 0; i1 < k1; i1++) {
                              var x1 = i1 * (stripW_A + gutter);
                              var y1 = 0;
                              placedBlocks.push({
                                tagIndex: aIdx,
                                tagName: tA.name || ("Tag " + (aIdx + 1)),
                                tagPrefix: String.fromCharCode(65 + (aIdx % 26)),
                                tagColor: getMultiTagColor(aIdx),
                                tagL: lA, tagW: wA,
                                targetQty: Math.max(1, Math.round(Number(tA.qty) || 5000)),
                                ratioUp: tA.ratioUp,
                                slots: rA,
                                rows: rA, cols: 1,
                                cutL: lA, cutW: wA,
                                isRotated: oA.isRot,
                                spanL: stripH_A, spanW: stripW_A,
                                xOffset: box.isSwapped ? y1 : x1,
                                yOffset: box.isSwapped ? x1 : y1,
                                count: rA,
                                sharedCut: removeSameTagBleed,
                                crease: !!tA.crease
                              });
                            }

                            // Band 2: numStripsB strips of Tag B
                            var y_b2 = b1H + gutter;
                            for (var iB = 0; iB < numStripsB; iB++) {
                              var xB = iB * (stripW_B + gutter);
                              var yB = y_b2;
                              placedBlocks.push({
                                tagIndex: bIdx,
                                tagName: tB.name || ("Tag " + (bIdx + 1)),
                                tagPrefix: String.fromCharCode(65 + (bIdx % 26)),
                                tagColor: getMultiTagColor(bIdx),
                                tagL: lB, tagW: wB,
                                targetQty: Math.max(1, Math.round(Number(tB.qty) || 5000)),
                                ratioUp: tB.ratioUp,
                                slots: rB,
                                rows: rB, cols: 1,
                                cutL: lB, cutW: wB,
                                isRotated: oB.isRot,
                                spanL: stripH_B, spanW: stripW_B,
                                xOffset: box.isSwapped ? yB : xB,
                                yOffset: box.isSwapped ? xB : yB,
                                count: rB,
                                sharedCut: removeSameTagBleed,
                                crease: !!tB.crease
                              });
                            }

                            // Band 2: k2 composite columns (Tag A on top of Tag C)
                            var x_comp = Math.max(numStripsB * (stripW_B + gutter), b1W - (k2 * stripW_A + (k2 - 1) * gutter));
                            for (var i2 = 0; i2 < k2; i2++) {
                              var xCol = x_comp + i2 * (stripW_A + gutter);
                              placedBlocks.push({
                                tagIndex: aIdx,
                                tagName: tA.name || ("Tag " + (aIdx + 1)),
                                tagPrefix: String.fromCharCode(65 + (aIdx % 26)),
                                tagColor: getMultiTagColor(aIdx),
                                tagL: lA, tagW: wA,
                                targetQty: Math.max(1, Math.round(Number(tA.qty) || 5000)),
                                ratioUp: tA.ratioUp,
                                slots: rA,
                                rows: rA, cols: 1,
                                cutL: lA, cutW: wA,
                                isRotated: oA.isRot,
                                spanL: stripH_A, spanW: stripW_A,
                                xOffset: box.isSwapped ? y_b2 : xCol,
                                yOffset: box.isSwapped ? xCol : y_b2,
                                count: rA,
                                sharedCut: removeSameTagBleed,
                                crease: !!tA.crease
                              });

                              var y_c = y_b2 + stripH_A + gutter;
                              placedBlocks.push({
                                tagIndex: cIdx,
                                tagName: tC.name || ("Tag " + (cIdx + 1)),
                                tagPrefix: String.fromCharCode(65 + (cIdx % 26)),
                                tagColor: getMultiTagColor(cIdx),
                                tagL: lC, tagW: wC,
                                targetQty: Math.max(1, Math.round(Number(tC.qty) || 5000)),
                                ratioUp: tC.ratioUp,
                                slots: rC,
                                rows: rC, cols: 1,
                                cutL: lC, cutW: wC,
                                isRotated: oC.isRot,
                                spanL: stripH_C, spanW: stripW_C,
                                xOffset: box.isSwapped ? y_c : xCol,
                                yOffset: box.isSwapped ? xCol : y_c,
                                count: rC,
                                sharedCut: removeSameTagBleed,
                                crease: !!tC.crease
                              });
                            }

                            addMultiCandidate({
                              multiplier: mult_cur,
                              formation: "compound-band",
                              formationLabel: "Compound Gang (" + mult_cur + "x ratio)",
                              pL: pL_cur, pW: pW_cur, ni: ni_cur, mi: mi_cur,
                              totalPieces: totalPieces_cur,
                              blocks: placedBlocks,
                              boundL: box.isSwapped ? totalW : totalH,
                              boundW: box.isSwapped ? totalH : totalW,
                              totalSlotsThisM: totalSlots_cur
                            });
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
  }

  function addMultiCandidate(cfg) {
    var totalTagArea = 0;
    for (var i = 0; i < cfg.blocks.length; i++) {
      var bk = cfg.blocks[i];
      totalTagArea += (bk.count * bk.tagL * bk.tagW);
    }

    // Determine sheets needed so EVERY tag fulfills its entered order quantity
    var slotsByTag = {};
    var targetQtyByTag = {};
    var nameByTag = {};
    cfg.blocks.forEach(function(bk) {
      var tIdx = bk.tagIndex != null ? bk.tagIndex : 0;
      slotsByTag[tIdx] = (slotsByTag[tIdx] || 0) + bk.slots;
      targetQtyByTag[tIdx] = bk.targetQty;
      nameByTag[tIdx] = bk.tagName;
    });

    var sheetsNeeded = 0;
    Object.keys(slotsByTag).forEach(function(tIdx) {
      var totalSlotsForThisTag = slotsByTag[tIdx];
      var tagsPerSheetForThisTag = cfg.totalPieces * totalSlotsForThisTag;
      var target = targetQtyByTag[tIdx] || 5000;
      var sheetsForThis = Math.ceil(target / tagsPerSheetForThisTag);
      if (sheetsForThis > sheetsNeeded) {
        sheetsNeeded = sheetsForThis;
      }
    });

    var totalPiecesRun = sheetsNeeded * cfg.totalPieces;
    var totalTagsAll = 0;
    Object.keys(slotsByTag).forEach(function(tIdx) {
      totalTagsAll += (totalPiecesRun * slotsByTag[tIdx]);
    });

    var totalTagsPerSheet = cfg.totalSlotsThisM * cfg.totalPieces;
    var totalSheetTagArea = cfg.totalPieces * totalTagArea;
    var util = sheetArea > 0 ? Math.min(100, (totalSheetTagArea / sheetArea) * 100) : 0;
    var wastePct = Math.max(0, 100 - util);

    var descParts = Object.keys(slotsByTag).map(function(tIdx) {
      return nameByTag[tIdx] + " (" + slotsByTag[tIdx] + " UP)";
    });
    var k = cfg.ni + "x" + cfg.mi + "|" + cfg.formation + "|" + cfg.multiplier + "x|" + descParts.join("+");
    if (seen[k]) return;
    seen[k] = true;

    var guillotineCuts = (cfg.ni - 1) + (cfg.mi - 1);
    var MAX_CUTS = 14;
    var cutsScore = Math.max(0, (1 - guillotineCuts / MAX_CUTS)) * 100;
    var pieceReuseScore = 100;
    var handlingLabel = cfg.totalPieces === 1 ? 'Single Piece Full Sheet' : (cfg.totalPieces <= 2 ? 'Excellent' : (cfg.totalPieces <= 4 ? 'Good' : 'Moderate'));
    var handlingScore = cfg.totalPieces === 1 ? 100 : (cfg.totalPieces <= 2 ? 90 : (cfg.totalPieces <= 4 ? 75 : 60));
    var prodScore = Math.round(
      util * 0.40 +
      pieceReuseScore * 0.25 +
      cutsScore * 0.20 +
      handlingScore * 0.15
    );
    prodScore = Math.max(0, Math.min(100, prodScore));

    var whySelected = [];
    if (cfg.totalPieces === 1) {
      whySelected.push('Bigger Die (1 pc) — full sheet fed directly with zero guillotine cuts');
      whySelected.push('Minimum machine press impressions (' + totalPiecesRun.toLocaleString() + ' pulls)');
    } else {
      whySelected.push('Smaller Die (' + cfg.totalPieces + ' pcs: ' + cfg.pL.toFixed(2) + '" x ' + cfg.pW.toFixed(2) + '")');
      whySelected.push(guillotineCuts + ' guillotine slitting cut' + (guillotineCuts > 1 ? 's' : '') + ' required (' + totalPiecesRun.toLocaleString() + ' pulls)');
    }
    if (util >= 65) whySelected.push('Paper utilization: ' + util.toFixed(1) + '%');
    whySelected.push('Balanced ' + cfg.multiplier + 'x ratio across all tag SKUs');

    var dieCategory = cfg.totalPieces === 1 ? "Bigger Die (1 pc)" : ("Smaller Die (" + cfg.totalPieces + " pcs)");

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
      tagsList: activeTags,
      slotsByTag: slotsByTag,
      itemizedTags: Object.keys(slotsByTag).map(function(tIdx) {
        var tObj = activeTags[tIdx] || {};
        return {
          id: tObj.id || ("mt_" + tIdx),
          tagIndex: Number(tIdx),
          name: nameByTag[tIdx] || tObj.name || ("Tag " + (Number(tIdx) + 1)),
          slots: slotsByTag[tIdx],
          l: tObj.l,
          w: tObj.w,
          targetQty: targetQtyByTag[tIdx]
        };
      }),
      totalSlots: cfg.totalSlotsThisM,
      TL: activeTags[0] ? Number(activeTags[0].l) : 0,
      TW: activeTags[0] ? Number(activeTags[0].w) : 0,
      feedMode: feedLabel,
      balanceScore: 100,
      production: {
        pieceTypes: [{
          L: cfg.pL, W: cfg.pW,
          count: cfg.totalPieces,
          tagsPerPiece: cfg.totalSlotsThisM,
          rows: cfg.blocks[0] ? cfg.blocks[0].rows : 1,
          cols: cfg.blocks[0] ? cfg.blocks[0].cols : 1,
          sizeDesc: cfg.pL.toFixed(2) + ' \u00d7 ' + cfg.pW.toFixed(2) + '"',
          label: cfg.totalPieces === 1 ? 'Full Sheet Die' : 'Die Piece'
        }],
        uniquePieceTypes: 1,
        verticalCuts: cfg.ni - 1,
        horizontalCuts: cfg.mi - 1,
        guillotineCuts: guillotineCuts,
        pieceReuseScore: pieceReuseScore,
        rectangularScore: 100,
        handlingScore: handlingScore,
        handlingLabel: handlingLabel,
        cutsScore: Math.round(cutsScore),
        productionScore: prodScore,
        whySelected: whySelected,
        isMixed: false,
        dieCategory: dieCategory
      }
    });
  }
  } // end runSearchWithTags

  runSearchWithTags(tagsWithRatio);

  if (candidates.length === 0 && tagsWithRatio.some(function(t) { return t.baseSlots > 1; })) {
    var halfTags = tagsWithRatio.map(function(t) {
      var h = Math.max(1, Math.round(t.baseSlots / 2));
      return Object.assign({}, t, { ratioUp: h, baseSlots: h });
    });
    runSearchWithTags(halfTags);

    if (candidates.length === 0) {
      var eqTags = tagsWithRatio.map(function(t) {
        return Object.assign({}, t, { ratioUp: 1, baseSlots: 1 });
      });
      runSearchWithTags(eqTags);
    }
  }

  // Sort candidates:
  // 1. Highest total tags per sheet (yield)
  // 2. Paper utilization (within 1% tolerance)
  // 3. When yield is equal, prioritize fewer pieces (Bigger Die: 1 pc) over more pieces (Smaller Die)
  //    because fewer pieces require zero slitting cuts and half the machine impressions!
  candidates.sort(function(a, b) {
    if (b.totalTagsPerSheet !== a.totalTagsPerSheet) return b.totalTagsPerSheet - a.totalTagsPerSheet;
    if (Math.abs(b.utilization - a.utilization) > 1.0) return b.utilization - a.utilization;
    if (a.totalPieces !== b.totalPieces) return a.totalPieces - b.totalPieces;
    if (a.sheetsNeeded !== b.sheetsNeeded) return a.sheetsNeeded - b.sheetsNeeded;
    return (b.pieceL * b.pieceW) - (a.pieceL * a.pieceW);
  });

  // Diversify top candidates so the user has immediate access to:
  // - Best 1-piece Bigger Die layout
  // - Best 2-piece Smaller Die layout
  // - Best 3-piece / 4-piece layouts
  var primaryCandidates = [];
  var secondaryCandidates = [];
  var pieceKeySeen = {};

  for (var dIdx = 0; dIdx < candidates.length; dIdx++) {
    var cand = candidates[dIdx];
    var pKey = cand.n + "x" + cand.m + "|" + cand.totalTagsPerSheet;
    if (!pieceKeySeen[pKey]) {
      pieceKeySeen[pKey] = true;
      primaryCandidates.push(cand);
    } else {
      secondaryCandidates.push(cand);
    }
  }

  return primaryCandidates.concat(secondaryCandidates);
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
  // Group blocks by tagIndex so multiple strips of the same tag SKU form one itemized entry
  var tagAggregates = {};
  blocks.forEach(function(b) {
    var tIdx = b.tagIndex != null ? b.tagIndex : 0;
    if (!tagAggregates[tIdx]) {
      tagAggregates[tIdx] = {
        tagIndex: tIdx,
        name: b.tagName,
        prefix: b.tagPrefix,
        color: b.tagColor,
        l: b.tagL,
        w: b.tagW,
        targetQty: b.targetQty,
        ratioUp: b.ratioUp,
        slots: 0,
        crease: !!b.crease
      };
    }
    tagAggregates[tIdx].slots += b.slots;
  });

  var totalDieSurfaceArea = 0;
  Object.keys(tagAggregates).forEach(function(tIdx) {
    var agg = tagAggregates[tIdx];
    totalDieSurfaceArea += (agg.slots * agg.l * agg.w);
  });
  if (totalDieSurfaceArea <= 0) totalDieSurfaceArea = 1;

  var itemizedTags = Object.keys(tagAggregates).map(function(tIdx) {
    var agg = tagAggregates[tIdx];
    var tagArea = agg.l * agg.w;
    var tagTotalDieArea = agg.slots * tagArea;
    var areaShare = tagTotalDieArea / totalDieSurfaceArea;

    var qtyProduced = totalPieces * agg.slots;
    var tagAllocatedCost = subtotal * areaShare;
    var tagAllocatedPrice = sellingPrice * areaShare;

    var costPerTag = qtyProduced > 0 ? tagAllocatedCost / qtyProduced : 0;
    var pricePerTag = qtyProduced > 0 ? tagAllocatedPrice / qtyProduced : 0;

    return {
      id: (tagsList && tagsList[tIdx] && tagsList[tIdx].id) ? tagsList[tIdx].id : ("mt_" + tIdx),
      tagIndex: Number(tIdx),
      name: agg.name,
      prefix: agg.prefix,
      color: agg.color,
      l: agg.l,
      w: agg.w,
      targetQty: agg.targetQty,
      qtyRequired: agg.targetQty,
      ratioUp: agg.ratioUp,
      slots: agg.slots,
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
