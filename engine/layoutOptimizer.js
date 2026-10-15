try { console.log("[LAYOUT-OPT] v2 loaded"); } catch(e) {}
function generateAllLayouts(sheetL, sheetW, tagL, tagW, overlapIn, marginIn, orderQty, feedOffset, feedHand) {
  if (!sheetL || !sheetW || !tagL || !tagW || sheetL <= 0 || sheetW <= 0 || tagL <= 0 || tagW <= 0) {
    return [];
  }

  var candidates = [];
  var seen = {};
  var rejectLog = [];

  var feedL = 0, feedW = 0, feedLabel = 'Default';
  var isHandFeed = false;
  if (feedOffset && feedOffset[0] > 0 && feedOffset[1] > 0) {
    feedL = feedOffset[0]; feedW = feedOffset[1]; feedLabel = 'Offset feed ' + feedOffset[0] + 'x' + feedOffset[1];
  } else if (feedHand && feedHand[0] > 0 && feedHand[1] > 0) {
    feedL = feedHand[0]; feedW = feedHand[1]; feedLabel = 'Hand feed ' + feedHand[0] + 'x' + feedHand[1];
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
    var short = Math.min(pl, pw);
    var long = Math.max(pl, pw);
    if (isHandFeed) {
      return short >= MIN_HAND_PIECE && long >= MIN_HAND_PIECE_LONG;
    } else {
      return short >= MIN_OFFSET_PIECE && long >= MIN_OFFSET_PIECE_LONG;
    }
  }

  var tagCutL = tagL + 2 * overlapIn;
  var tagCutW = tagW + 2 * overlapIn;
  var rotCutL = tagW + 2 * overlapIn;
  var rotCutW = tagL + 2 * overlapIn;

  function getUsablePiece(pl, pw) {
    if (!isHandFeed) {
      // Offset printing gripper & side margins:
      // For example: 15x20 -> 14.4x19.5 (0.6" off short side, 0.5" off long side)
      //              20x26 -> 19.4x25.5 (0.6" off short side, 0.5" off long side)
      var shortSide = Math.min(pl, pw);
      var longSide = Math.max(pl, pw);
      var usableShort = Math.max(0, shortSide - 0.6);
      var usableLong = Math.max(0, longSide - 0.5);
      var uL = (pl <= pw) ? usableShort : usableLong;
      var uW = (pl <= pw) ? usableLong : usableShort;
      var mSideL = (pl - uL) / 2;
      var mSideW = (pw - uW) / 2;
      return { usableL: uL, usableW: uW, mSideL: mSideL, mSideW: mSideW };
    }
    var uL = Math.max(0, pl - 2 * marginIn);
    var uW = Math.max(0, pw - 2 * marginIn);
    return { usableL: uL, usableW: uW, mSideL: marginIn, mSideW: marginIn };
  }

  function lpFmt(v) { return v.toFixed(3); }
  function evalLayout(pieceL, pieceW, cutL, cutW) {
    var uDims = getUsablePiece(pieceL, pieceW);
    var usableL = uDims.usableL;
    var usableW = uDims.usableW;
    var rows = cutL > 0 ? Math.floor((usableL + 2 * overlapIn) / cutL) : 0;
    var cols = cutW > 0 ? Math.floor((usableW + 2 * overlapIn) / cutW) : 0;
    var usableL_eff = usableL + 2 * overlapIn;
    var usableW_eff = usableW + 2 * overlapIn;
    var leftoverL = usableL_eff - rows * cutL;
    var leftoverW = usableW_eff - cols * cutW;
    var reclaimed = 0, rotAdditions = 0, rotColCount = 0, rotRowCount = 0;
    var addedRows = 0, addedCols = 0;
    if (isHandFeed) {
      if (leftoverL >= cutW) {
        rotColCount = Math.floor(usableW_eff / cutL);
        reclaimed += rotColCount;
        rotAdditions += rotColCount;
      }
      if (leftoverW >= cutL) {
        var availH = rotColCount > 0 ? rows * cutL : usableL_eff;
        if (availH >= cutW) {
          rotRowCount = Math.floor(availH / cutW);
          reclaimed += rotRowCount;
          rotAdditions += rotRowCount;
        }
      }
    }
    try { console.log('[RECLAIM-STRIP] ' + (isHandFeed ? 'HAND' : 'OFFSET') + ' piece ' + lpFmt(pieceL) + 'x' + lpFmt(pieceW) + ' cut ' + lpFmt(cutL) + 'x' + lpFmt(cutW) + ' rows=' + rows + ' cols=' + cols + ' usabEff ' + lpFmt(usableL_eff) + 'x' + lpFmt(usableW_eff) + ' leftover ' + lpFmt(leftoverL) + 'x' + lpFmt(leftoverW) + ' reclaimed=' + reclaimed + (reclaimed > 0 ? ' btmCols=' + rotColCount + ' rgtRows=' + rotRowCount : '')); } catch(e) {}
    return { rows: rows, cols: cols, total: rows * cols, reclaimed: reclaimed, addedRows: addedRows, addedCols: addedCols, rotAdditions: rotAdditions, rotColCount: rotColCount, rotRowCount: rotRowCount, leftoverL: leftoverL, leftoverW: leftoverW };
  }

  function evalCornerFitReclaim(pieceL, pieceW, cutL, cutW) {
    var uDims = getUsablePiece(pieceL, pieceW);
    var usableL = uDims.usableL;
    var usableW = uDims.usableW;
    var usableL_eff = usableL + 2 * overlapIn;
    var usableW_eff = usableW + 2 * overlapIn;
    var rows = cutL > 0 ? Math.floor(usableL_eff / cutL) : 0;
    var cols = cutW > 0 ? Math.floor(usableW_eff / cutW) : 0;
    var leftoverL = usableL_eff - rows * cutL;
    var leftoverW = usableW_eff - cols * cutW;
    var reclaimed = 0, rotAdditions = 0, rotColCount = 0, rotRowCount = 0;
    var addedRows = 0, addedCols = 0;
    var cornerTagL = 0, cornerTagW = 0;
    var extensionL = 0, extensionW = 0;

    if (isHandFeed) {
      // Check if 1 tag fits in the corner pocket (leftoverL × leftoverW) in either orientation.
      // Try rotated orientation first (tag placed as cutW × cutL — i.e. short side along L, long side along W).
      // Then try normal orientation (tag as cutL × cutW — same as main grid).
      var fitsRotated = leftoverL >= cutW - 0.001 && leftoverW >= cutL - 0.001;
      var fitsNormal  = leftoverL >= cutL - 0.001 && leftoverW >= cutW - 0.001;

      if (!fitsRotated && !fitsNormal) {
        // Check if a small piece extension (within marginIn slack) makes it fit
        var needL_rot  = Math.max(0, cutW - leftoverL);
        var needW_rot  = Math.max(0, cutL - leftoverW);
        var needL_norm = Math.max(0, cutL - leftoverL);
        var needW_norm = Math.max(0, cutW - leftoverW);

        if (needL_rot <= marginIn && needW_rot <= marginIn) {
          extensionL = needL_rot;
          extensionW = needW_rot;
          fitsRotated = true;
        } else if (needL_norm <= marginIn && needW_norm <= marginIn) {
          extensionL = needL_norm;
          extensionW = needW_norm;
          fitsNormal = true;
        }
      }

      if (fitsRotated || fitsNormal) {
        // Pick orientation with smaller extension; prefer rotated on a tie
        if (fitsRotated) {
          cornerTagL = cutW; // rotated: tag's W dimension placed along the piece's L axis
          cornerTagW = cutL; // rotated: tag's L dimension placed along the piece's W axis
        } else {
          cornerTagL = cutL;
          cornerTagW = cutW;
          extensionL = Math.max(0, cutL - leftoverL);
          extensionW = Math.max(0, cutW - leftoverW);
        }
        reclaimed = 1;
        rotAdditions = 1;
        rotColCount = 1; // use rotColCount=1 to signal 1 corner tag
      }
    }
    try { console.log('[RECLAIM-CORNER] ' + (isHandFeed ? 'HAND' : 'OFFSET') + ' piece ' + lpFmt(pieceL) + 'x' + lpFmt(pieceW) + ' cut ' + lpFmt(cutL) + 'x' + lpFmt(cutW) + ' rows=' + rows + ' cols=' + cols + ' leftover ' + lpFmt(leftoverL) + 'x' + lpFmt(leftoverW) + ' ext ' + lpFmt(extensionL) + 'x' + lpFmt(extensionW) + ' reclaimed=' + reclaimed + (reclaimed > 0 ? ' cornerTag=' + lpFmt(cornerTagL) + 'x' + lpFmt(cornerTagW) : '')); } catch(e) {}
    return { rows: rows, cols: cols, total: rows * cols, reclaimed: reclaimed, addedRows: addedRows, addedCols: addedCols, rotAdditions: rotAdditions, rotColCount: rotColCount, rotRowCount: rotRowCount, leftoverL: leftoverL, leftoverW: leftoverW, cornerTagL: cornerTagL, cornerTagW: cornerTagW, extensionL: extensionL, extensionW: extensionW };
  }

  var orientations = [
    { cutL: tagCutL, cutW: tagCutW, label: 'normal' },
    { cutL: rotCutL, cutW: rotCutW, label: 'rotated' }
  ];

  for (var oi = 0; oi < orientations.length; oi++) {
    var ori = orientations[oi];
    var maxN = Math.max(1, Math.min(50, Math.floor(sheetW / (ori.cutW + 2 * marginIn - 2 * overlapIn))));
    var maxM = Math.max(1, Math.min(50, Math.floor(sheetL / (ori.cutL + 2 * marginIn - 2 * overlapIn))));

    for (var ni = 1; ni <= maxN; ni++) {
      for (var mi = 1; mi <= maxM; mi++) {
        var pW = sheetW / ni;
        var pL = sheetL / mi;

        var uDims = getUsablePiece(pL, pW);
        if (uDims.usableW + 2 * overlapIn < ori.cutW) continue;
        if (uDims.usableL + 2 * overlapIn < ori.cutL) continue;

        if (!fitsFeed(pL, pW)) {
          rejectLog.push({ piece: lpFmt(pL) + 'x' + lpFmt(pW) + ' (' + ni + 'x' + mi + ')', reason: 'Exceeds feed' });
          continue;
        }
        if (!meetsMinSize(pL, pW)) {
          rejectLog.push({ piece: lpFmt(pL) + 'x' + lpFmt(pW) + ' (' + ni + 'x' + mi + ')', reason: 'Below min print size' });
          continue;
        }

        var ev = evalLayout(pL, pW, ori.cutL, ori.cutW);
        if (ev.rows < 1 || ev.cols < 1) continue;

        var totalPieces = ni * mi;
        var tagsPerPiece = ev.rows * ev.cols;
        if (tagsPerPiece !== ev.total) throw new Error('INVARIANT: tagsPerPiece(' + tagsPerPiece + ') !== ev.total(' + ev.total + ')');

        function pushCandidate(evResult, strategy) {
          var rotRowCount = evResult.rotRowCount || 0;
          var rotColCount = evResult.rotColCount || 0;

          var uDims = getUsablePiece(pL, pW);
          var usableL = uDims.usableL;
          var usableW = uDims.usableW;
          var effMarginL = uDims.mSideL;
          var effMarginW = uDims.mSideW;
          var gridL = evResult.rows > 0 ? evResult.rows * ori.cutL - 2 * overlapIn : 0;
          var gridW = evResult.cols > 0 ? evResult.cols * ori.cutW - 2 * overlapIn : 0;

          var isCornerFit = strategy === 'corner-fit';
          // Corner-fit: reclaim a single tag in the bottom-right pocket; extends BOTH L and W
          var cTagL = (isCornerFit && evResult.cornerTagL > 0) ? evResult.cornerTagL : 0;
          var cTagW = (isCornerFit && evResult.cornerTagW > 0) ? evResult.cornerTagW : 0;

          // Strip reclaim extension geometry (only one axis at a time)
          var recClaimL_strip = (rotRowCount > 0) ? ori.cutW : 0;   // right strip extends L
          var recClaimW_strip = (rotColCount > 0 && !isCornerFit) ? ori.cutW : 0; // bottom strip extends W

          var firstTagL = effMarginL + Math.max(0, (usableL - gridL) / 2);
          var lastTagEndL = firstTagL + gridL;
          var firstTagW = effMarginW + Math.max(0, (usableW - gridW) / 2);
          var lastTagEndW = firstTagW + gridW;

          // For corner-fit: piece must reach (lastTagEndL + cornerTagL + margin) in L and (lastTagEndW + cornerTagW + margin) in W
          var extPL = isCornerFit
            ? Math.max(pL, lastTagEndL + cTagL + effMarginL)
            : Math.max(pL, lastTagEndL + recClaimL_strip + effMarginL);
          var extPW = isCornerFit
            ? Math.max(pW, lastTagEndW + cTagW + effMarginW)
            : Math.max(pW, lastTagEndW + recClaimW_strip + effMarginW);

          // Incremental per-piece sheet-fit validation along L (columns of pieces)
          var validRotRowCount = 0;
          var totalL = 0;
          var cornerFitValidL = false;
          for (var c = 0; c < mi; c++) {
            var isCornerL = isCornerFit && c < 1 && cTagL > 0;
            var trialExtPL = (c < rotRowCount || isCornerL) ? extPL : pL;
            var spaceNeededL = (mi - c - 1) * pL;
            if (totalL + trialExtPL + spaceNeededL <= sheetL + 0.01) {
              totalL += trialExtPL;
              if (c < rotRowCount) validRotRowCount++;
              if (isCornerL) cornerFitValidL = true;
            } else {
              totalL += pL;
            }
          }

          // Incremental per-piece sheet-fit validation along W (rows of pieces)
          var validRotColCount = 0;
          var totalW = 0;
          var cornerFitValidW = false;
          for (var r = 0; r < ni; r++) {
            var isCornerW = isCornerFit && r < 1 && cTagW > 0;
            var trialExtPW = (r < rotColCount || isCornerW) ? extPW : pW;
            var spaceNeededW = (ni - r - 1) * pW;
            if (totalW + trialExtPW + spaceNeededW <= sheetW + 0.01) {
              totalW += trialExtPW;
              if (r < rotColCount) validRotColCount++;
              if (isCornerW) cornerFitValidW = true;
            } else {
              totalW += pW;
            }
          }

          // Hard sheet boundary check — reject if nominal total exceeds sheet in either axis
          if (totalL > sheetL + 0.01 || totalW > sheetW + 0.01) {
            try { console.log('[RECLAIM-REJECT] ' + strategy + ' piece ' + lpFmt(pL) + 'x' + lpFmt(pW) + ' totalL=' + lpFmt(totalL) + '/' + lpFmt(sheetL) + ' totalW=' + lpFmt(totalW) + '/' + lpFmt(sheetW)); } catch(e) {}
            return;
          }

          // For corner-fit: validatedReclaimed = 1 per piece if the pocket fits, else 0
          var cornerFitValid = isCornerFit && cTagL > 0 && cornerFitValidL && cornerFitValidW;

          var cornerReclaimed = cornerFitValid ? 1 : 0;
          var validatedReclaimed = isCornerFit ? cornerReclaimed : (validRotRowCount + validRotColCount);
          var finalStrategy = (validatedReclaimed > 0) ? strategy : 'none';
          var effectiveTagsPerPiece = tagsPerPiece + validatedReclaimed;
          var totalTags = effectiveTagsPerPiece * totalPieces;
          if (totalTags < 1) {
            console.log("REJECT: totalTags < 1", tagsPerPiece, validatedReclaimed);
            return;
          }

          var sheetArea = sheetL * sheetW;
          var sheetsNeeded = Math.ceil(orderQty / totalTags);
          var totalTagArea = totalTags * ori.cutL * ori.cutW;
          var tagAreaUtil = sheetArea > 0 ? Math.min(100, totalTagArea / sheetArea * 100) : 0;
          var wastePct = Math.max(0, 100 - tagAreaUtil);

          var k = tagL + 'x' + tagW + '|' + ori.label + '|' + evResult.rows + 'x' + evResult.cols + '|' + ni + 'x' + mi + (finalStrategy === 'corner-fit' ? '_corner' : '');
          if (seen[k]) {
             // duplicate
             return;
          }
          seen[k] = true;
          // console.log("PUSHING CANDIDATE", k);

          var balanceScore = Math.min(evResult.rows, evResult.cols) > 0
            ? Math.round((Math.min(evResult.rows, evResult.cols) / Math.max(evResult.rows, evResult.cols)) * 100)
            : 0;

          // For corner-fit, reclaimed count and strip counts stored separately
          var outRotColCount = isCornerFit ? 0 : validRotColCount;
          var outRotRowCount = isCornerFit ? 0 : validRotRowCount;
          var outCornerCount = cornerFitValid ? 1 : 0;

          var mainBlock = {
            dir: ori.label === 'rotated' ? 'H' : 'V',
            rows: evResult.rows,
            cols: evResult.cols,
            tagL: ori.label === 'rotated' ? tagW : tagL,
            tagW: ori.label === 'rotated' ? tagL : tagW,
            cutL: ori.cutL,
            cutW: ori.cutW,
            isRotated: ori.label === 'rotated',
            xOffset: 0,
            yOffset: 0,
            count: evResult.rows * evResult.cols
          };
          var candBlocks = [mainBlock];
          if (outRotColCount > 0) {
            candBlocks.push({
              dir: ori.label === 'rotated' ? 'V' : 'H',
              rows: 1,
              cols: outRotColCount,
              tagL: ori.label === 'rotated' ? tagL : tagW,
              tagW: ori.label === 'rotated' ? tagW : tagL,
              cutL: ori.cutW,
              cutW: ori.cutL,
              isRotated: ori.label !== 'rotated',
              xOffset: 0,
              yOffset: evResult.rows * ori.cutL,
              count: outRotColCount,
              isReclaim: true
            });
          }
          if (outRotRowCount > 0) {
            candBlocks.push({
              dir: ori.label === 'rotated' ? 'V' : 'H',
              rows: outRotRowCount,
              cols: 1,
              tagL: ori.label === 'rotated' ? tagL : tagW,
              tagW: ori.label === 'rotated' ? tagW : tagL,
              cutL: ori.cutW,
              cutW: ori.cutL,
              isRotated: ori.label !== 'rotated',
              xOffset: evResult.cols * ori.cutW,
              yOffset: 0,
              count: outRotRowCount,
              isReclaim: true
            });
          }

          candidates.push({
            TL: tagL, TW: tagW,
            n: ni, m: mi,
            pieceL: pL, pieceW: pW,
            blocks: candBlocks,
            tagsRows: evResult.rows, tagsCols: evResult.cols,
            tagsPerPieceNominal: tagsPerPiece,
            totalTagsPerSheet: totalTags,
            reclaimedTags: validatedReclaimed * totalPieces,
            leftoverL: evResult.leftoverL, leftoverW: evResult.leftoverW,
            totalPieces: totalPieces,
            sheetsNeeded: sheetsNeeded,
            wastePct: Math.min(100, wastePct),
            utilization: Math.min(100, tagAreaUtil),
            feedMode: feedLabel,
            tagDesc: ori.label + ' ' + ni + 'x' + mi + (finalStrategy === 'corner-fit' ? ' corner-fit' : ''),
            pieceDesc: lpFmt(pL) + 'x' + lpFmt(pW),
            balanceScore: balanceScore,
            optimization: {
              baseTags: tagsPerPiece,
              addedRows: evResult.addedRows, addedCols: evResult.addedCols,
              rotAdditions: validatedReclaimed, rotColCount: outRotColCount, rotRowCount: outRotRowCount,
              cornerCount: outCornerCount,
              cornerTagL: isCornerFit ? (evResult.cornerTagL || 0) : 0,
              cornerTagW: isCornerFit ? (evResult.cornerTagW || 0) : 0,
              finalTags: effectiveTagsPerPiece,
              mainRows: evResult.rows, mainCols: evResult.cols,
              renderRows: evResult.rows, renderCols: evResult.cols,
              balanceScore: balanceScore,
              hasExtra: validatedReclaimed > 0,
              isTagRotated: ori.label === 'rotated',
              reclaimedTags: validatedReclaimed,
              reclaimStrategy: finalStrategy,
            },
          });
        }

        pushCandidate(ev, 'strip');

        if (isHandFeed) {
          var cf = evalCornerFitReclaim(pL, pW, ori.cutL, ori.cutW);
          // Always generate a separate corner-fit candidate when the pocket fits
          if (cf.reclaimed > 0) {
            pushCandidate(cf, 'corner-fit');
          }
        }
        evalHybridDie(pL, pW, ni, mi);
      }
    }

    evalMixedOffcutStrips(ori);
  }

  function evalMixedOffcutStrips(ori) {
    if (!isHandFeed) return;
    var MIN_OFFCUT_SHORT = 3.0;
    var MIN_OFFCUT_LONG = 6.0;

    var axes = [
      { dimL: sheetL, dimW: sheetW, cutL: ori.cutL, cutW: ori.cutW, swap: false },
      { dimL: sheetW, dimW: sheetL, cutL: ori.cutW, cutW: ori.cutL, swap: true }
    ];

    axes.forEach(function(axis) {
      var sL = axis.dimL;
      var sW = axis.dimW;
      var cL = axis.cutL;
      var cW = axis.cutW;

      for (var n = 1; n <= 8; n++) {
        var pW = sW / n;
        if (pW < MIN_OFFCUT_SHORT) continue;

        for (var mMain = 2; mMain <= 6; mMain++) {
          var maxBaseRows = Math.floor((sL / mMain - 2 * marginIn + 2 * overlapIn) / cL);
          if (maxBaseRows < 1) continue;

          for (var rMain = maxBaseRows; rMain >= 1; rMain--) {
            var minMainL = rMain * cL - 2 * overlapIn + 2 * marginIn;
            if (minMainL * mMain >= sL) continue;

            var stripAL = Math.round((minMainL + 0.05) * 100) / 100;
            var stripBL = Math.round((sL - mMain * stripAL) * 100) / 100;

            if (stripBL < MIN_OFFCUT_SHORT - 0.01) continue;
            if (!fitsFeed(stripAL, pW) || !meetsMinSize(stripAL, pW)) continue;

            var offcutShort = Math.min(stripBL, pW);
            var offcutLong = Math.max(stripBL, pW);
            if (!fitsFeed(stripBL, pW) || offcutShort < MIN_OFFCUT_SHORT || offcutLong < MIN_OFFCUT_LONG) continue;

            var colsMain = Math.floor((pW - 2 * marginIn + 2 * overlapIn) / cW);
            if (colsMain < 1) continue;
            var mainTags = rMain * colsMain;

            var rOff = Math.floor((stripBL - 2 * marginIn + 2 * overlapIn) / cL);
            if (rOff < 1) continue;
            var offTags = rOff * colsMain;

            var totalTags = (mMain * mainTags + offTags) * n;
            var totalPieces = (mMain + 1) * n;
            var util = (totalTags * ori.cutL * ori.cutW) / (sheetL * sheetW) * 100;

            if (totalTags <= mMain * mainTags * n) continue;

            var strips = [];
            for (var si = 0; si < mMain; si++) {
              strips.push({
                L: axis.swap ? pW : stripAL,
                W: axis.swap ? stripAL : pW,
                rows: axis.swap ? colsMain : rMain,
                cols: axis.swap ? rMain : colsMain,
                count: n,
                tagsPerStrip: mainTags
              });
            }
            strips.push({
              L: axis.swap ? pW : stripBL,
              W: axis.swap ? stripBL : pW,
              rows: axis.swap ? colsMain : rOff,
              cols: axis.swap ? rOff : colsMain,
              count: n,
              tagsPerStrip: offTags,
              isOffcut: true
            });

            var primaryPieceL = axis.swap ? pW : stripAL;
            var primaryPieceW = axis.swap ? stripAL : pW;

            candidates.push({
              TL: tagL, TW: tagW,
              n: axis.swap ? (mMain + 1) : n,
              m: axis.swap ? n : (mMain + 1),
              pieceL: primaryPieceL, pieceW: primaryPieceW,
              isMixed: true,
              stripAxis: axis.swap ? 'W' : 'L',
              strips: strips,
              tagsRows: axis.swap ? colsMain : rMain,
              tagsCols: axis.swap ? rMain : colsMain,
              tagsPerPieceNominal: Math.round(totalTags / totalPieces),
              totalTagsPerSheet: totalTags,
              reclaimedTags: offTags * n,
              totalPieces: totalPieces,
              sheetsNeeded: orderQty > 0 ? Math.ceil(orderQty / totalTags) : 0,
              wastePct: Math.max(0, 100 - util),
              utilization: Math.min(100, util),
              feedMode: feedLabel,
              tagDesc: ori.label + ' mixed (' + (mMain * n) + 'x ' + stripAL.toFixed(1) + 'x' + pW.toFixed(1) + '" + ' + n + 'x ' + stripBL.toFixed(1) + 'x' + pW.toFixed(1) + '" offcut)',
              pieceDesc: 'Mixed (' + stripAL.toFixed(1) + 'x' + pW.toFixed(1) + '" & ' + stripBL.toFixed(1) + 'x' + pW.toFixed(1) + '")',
              balanceScore: 92,
              optimization: {
                baseTags: mainTags,
                rotAdditions: 0, rotColCount: 0, rotRowCount: 0,
                finalTags: mainTags,
                mainRows: axis.swap ? colsMain : rMain,
                mainCols: axis.swap ? rMain : colsMain,
                renderRows: axis.swap ? colsMain : rMain,
                renderCols: axis.swap ? rMain : colsMain,
                balanceScore: 92,
                hasExtra: true,
                isTagRotated: ori.label === 'rotated',
                reclaimedTags: offTags * n,
                reclaimStrategy: 'mixed-strips'
              }
            });
          }
        }
      }
    });
  }

  function evalHybridDie(pL, pW, ni, mi) {
    var uDims = getUsablePiece(pL, pW);
    var usableL = uDims.usableL;
    var usableW = uDims.usableW;
    var usableL_eff = usableL + 2 * overlapIn;
    var usableW_eff = usableW + 2 * overlapIn;
    
    var maxV_R = Math.floor(usableL_eff / tagCutL);
    var maxV_C = Math.floor(usableW_eff / tagCutW);
    var maxH_R = Math.floor(usableL_eff / rotCutL);
    var maxH_C = Math.floor(usableW_eff / rotCutW);
    
    if (maxV_R < 1 && maxH_R < 1) return;
    if (maxV_C < 1 && maxH_C < 1) return;
    
    var hybridList = [];
    
    // 1. Horizontal Split: Top H + Bottom V (Snap 1)
    if (maxH_R >= 1 && maxH_C >= 1 && maxV_C >= 1) {
      for (var r1 = 1; r1 <= maxH_R; r1++) {
        var remL = usableL_eff - r1 * rotCutL;
        var r2 = Math.floor(remL / tagCutL);
        if (r2 >= 1) {
          var c1 = maxH_C, c2 = maxV_C;
          var total = r1 * c1 + r2 * c2;
          hybridList.push({
            formation: 'split-h-topH-btmV',
            total: total,
            desc: 'Hybrid (' + r1 + 'x' + c1 + 'H top + ' + r2 + 'x' + c2 + 'V btm)',
            blocks: [
              { dir: 'H', rows: r1, cols: c1, tagL: tagW, tagW: tagL, cutL: rotCutL, cutW: rotCutW, isRotated: true, xOffset: 0, yOffset: 0, count: r1 * c1 },
              { dir: 'V', rows: r2, cols: c2, tagL: tagL, tagW: tagW, cutL: tagCutL, cutW: tagCutW, isRotated: false, xOffset: 0, yOffset: r1 * rotCutL, count: r2 * c2 }
            ]
          });
        }
      }
    }

    // 2. Horizontal Split: Top V + Bottom H (Snap 3)
    if (maxV_R >= 1 && maxV_C >= 1 && maxH_C >= 1) {
      for (var r1 = 1; r1 <= maxV_R; r1++) {
        var remL = usableL_eff - r1 * tagCutL;
        var r2 = Math.floor(remL / rotCutL);
        if (r2 >= 1) {
          var c1 = maxV_C, c2 = maxH_C;
          var total = r1 * c1 + r2 * c2;
          hybridList.push({
            formation: 'split-h-topV-btmH',
            total: total,
            desc: 'Hybrid (' + r1 + 'x' + c1 + 'V top + ' + r2 + 'x' + c2 + 'H btm)',
            blocks: [
              { dir: 'V', rows: r1, cols: c1, tagL: tagL, tagW: tagW, cutL: tagCutL, cutW: tagCutW, isRotated: false, xOffset: 0, yOffset: 0, count: r1 * c1 },
              { dir: 'H', rows: r2, cols: c2, tagL: tagW, tagW: tagL, cutL: rotCutL, cutW: rotCutW, isRotated: true, xOffset: 0, yOffset: r1 * tagCutL, count: r2 * c2 }
            ]
          });
        }
      }
    }

    // 3. Vertical Split: Left V + Right H (Snap 2)
    if (maxV_C >= 1 && maxV_R >= 1 && maxH_R >= 1) {
      for (var c1 = 1; c1 <= maxV_C; c1++) {
        var remW = usableW_eff - c1 * tagCutW;
        var c2 = Math.floor(remW / rotCutW);
        if (c2 >= 1) {
          var r1 = maxV_R, r2 = maxH_R;
          var total = r1 * c1 + r2 * c2;
          hybridList.push({
            formation: 'split-v-leftV-rightH',
            total: total,
            desc: 'Hybrid (' + r1 + 'x' + c1 + 'V left + ' + r2 + 'x' + c2 + 'H right)',
            blocks: [
              { dir: 'V', rows: r1, cols: c1, tagL: tagL, tagW: tagW, cutL: tagCutL, cutW: tagCutW, isRotated: false, xOffset: 0, yOffset: 0, count: r1 * c1 },
              { dir: 'H', rows: r2, cols: c2, tagL: tagW, tagW: tagL, cutL: rotCutL, cutW: rotCutW, isRotated: true, xOffset: c1 * tagCutW, yOffset: 0, count: r2 * c2 }
            ]
          });
        }
      }
    }

    // 4. Vertical Split: Left H + Right V
    if (maxH_C >= 1 && maxH_R >= 1 && maxV_R >= 1) {
      for (var c1 = 1; c1 <= maxH_C; c1++) {
        var remW = usableW_eff - c1 * rotCutW;
        var c2 = Math.floor(remW / tagCutW);
        if (c2 >= 1) {
          var r1 = maxH_R, r2 = maxV_R;
          var total = r1 * c1 + r2 * c2;
          hybridList.push({
            formation: 'split-v-leftH-rightV',
            total: total,
            desc: 'Hybrid (' + r1 + 'x' + c1 + 'H left + ' + r2 + 'x' + c2 + 'V right)',
            blocks: [
              { dir: 'H', rows: r1, cols: c1, tagL: tagW, tagW: tagL, cutL: rotCutL, cutW: rotCutW, isRotated: true, xOffset: 0, yOffset: 0, count: r1 * c1 },
              { dir: 'V', rows: r2, cols: c2, tagL: tagL, tagW: tagW, cutL: tagCutL, cutW: tagCutW, isRotated: false, xOffset: c1 * rotCutW, yOffset: 0, count: r2 * c2 }
            ]
          });
        }
      }
    }

    var maxPureTags = Math.max(maxV_R * maxV_C, maxH_R * maxH_C);

    var totalPieces = ni * mi;
    var sheetArea = sheetL * sheetW;

    for (var hi = 0; hi < hybridList.length; hi++) {
      var hItem = hybridList[hi];
      // Only consider hybrid die if it yields strictly MORE tags per piece than pure single orientation
      if (hItem.total <= maxPureTags) continue;
      var totalTags = hItem.total * totalPieces;
      if (totalTags < 1) continue;
      
      var sheetsNeeded = orderQty > 0 ? Math.ceil(orderQty / totalTags) : 0;
      var totalTagArea = totalTags * tagCutL * tagCutW;
      var tagAreaUtil = sheetArea > 0 ? Math.min(100, totalTagArea / sheetArea * 100) : 0;
      var wastePct = Math.max(0, 100 - tagAreaUtil);
      
      var hk = tagL + 'x' + tagW + '|hybrid|' + hItem.formation + '|' + hItem.desc + '|' + ni + 'x' + mi;
      if (seen[hk]) continue;
      seen[hk] = true;
      
      candidates.push({
        TL: tagL, TW: tagW,
        n: ni, m: mi,
        pieceL: pL, pieceW: pW,
        isHybrid: true,
        formation: hItem.formation,
        blocks: hItem.blocks,
        tagsRows: hItem.blocks[0].rows,
        tagsCols: hItem.blocks[0].cols,
        tagsPerPieceNominal: hItem.total,
        totalTagsPerSheet: totalTags,
        reclaimedTags: 0,
        leftoverL: 0, leftoverW: 0,
        totalPieces: totalPieces,
        sheetsNeeded: sheetsNeeded,
        wastePct: Math.min(100, wastePct),
        utilization: Math.min(100, tagAreaUtil),
        feedMode: feedLabel,
        tagDesc: hItem.desc,
        pieceDesc: lpFmt(pL) + 'x' + lpFmt(pW),
        balanceScore: 95,
        optimization: {
          baseTags: hItem.total,
          addedRows: 0, addedCols: 0,
          rotAdditions: 0, rotColCount: 0, rotRowCount: 0,
          finalTags: hItem.total,
          mainRows: hItem.blocks[0].rows, mainCols: hItem.blocks[0].cols,
          renderRows: hItem.blocks[0].rows, renderCols: hItem.blocks[0].cols,
          balanceScore: 95,
          hasExtra: false,
          isTagRotated: false,
          reclaimedTags: 0,
          reclaimStrategy: 'hybrid',
        }
      });
    }
  }


  if (candidates.length === 0) {
    var fallbackSizes = [[sheetL, sheetW], [sheetW, sheetL]];
    for (var fi = 0; fi < fallbackSizes.length; fi++) {
      var pL = fallbackSizes[fi][0], pW = fallbackSizes[fi][1];
      if (fitsFeed(pL, pW) && meetsMinSize(pL, pW)) {
        var ev = evalLayout(pL, pW, tagCutL, tagCutW);
        if (ev.rows >= 1 && ev.cols >= 1) {
          var fTags = ev.total + ev.reclaimed;
          candidates.push({
            TL: tagL, TW: tagW, n: 1, m: 1,
            pieceL: pL, pieceW: pW,
            tagsRows: ev.rows, tagsCols: ev.cols,
            tagsPerPieceNominal: ev.total,
            totalTagsPerSheet: fTags,
            reclaimedTags: ev.reclaimed,
            leftoverL: ev.leftoverL, leftoverW: ev.leftoverW, totalPieces: 1,
            sheetsNeeded: orderQty > 0 ? Math.ceil(orderQty / fTags) : 0,
            wastePct: Math.max(0, 100 - Math.min(100, fTags * tagCutL * tagCutW / (sheetL * sheetW) * 100)),
            utilization: Math.min(100, fTags * tagCutL * tagCutW / (sheetL * sheetW) * 100),
            feedMode: feedLabel,
            tagDesc: 'fallback',
            pieceDesc: lpFmt(pL) + 'x' + lpFmt(pW),
            balanceScore: 100,
            optimization: {
              baseTags: ev.total, addedRows: ev.addedRows, addedCols: ev.addedCols,
              rotAdditions: ev.rotAdditions, rotColCount: ev.rotColCount, rotRowCount: ev.rotRowCount,
              finalTags: fTags, mainRows: ev.rows, mainCols: ev.cols,
              renderRows: ev.rows, renderCols: ev.cols,
              balanceScore: 100, hasExtra: ev.reclaimed > 0,
              isTagRotated: false,
              reclaimedTags: ev.reclaimed,
            },
          });
        }
      }
    }
  }

  var deduped = [];
  var dedupSeen = {};
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var dk = c.TL + '|' + c.TW + '|' + c.pieceL.toFixed(4) + '|' + c.pieceW.toFixed(4) + '|' + c.n + '|' + c.m + '|' + c.tagsRows + '|' + c.tagsCols + '|' + (c.tagDesc || '');
    if (dedupSeen[dk]) continue;
    dedupSeen[dk] = true;
    deduped.push(c);
  }

  scoreCandidates(deduped);
  if (typeof analyzeProduction === 'function') {
    try {
      for (var j = 0; j < deduped.length; j++) {
        deduped[j].production = analyzeProduction(deduped[j], sheetL, sheetW);
      }
    } catch (e) {
      console.error("ANALYZE PRODUCTION ERROR:", e);
    }
  }
  deduped.sort(function(a, b) {
    if (a.totalTagsPerSheet !== b.totalTagsPerSheet) return b.totalTagsPerSheet - a.totalTagsPerSheet;
    if (a.production && b.production) {
      if (Math.abs(a.production.productionScore - b.production.productionScore) > 3) {
        return b.production.productionScore - a.production.productionScore;
      }
    }
    // Prefer single-orientation uniform layout if tag count is the same
    var aIsComplex = !!(a.isHybrid || (a.optimization && (a.optimization.rotAdditions > 0 || a.optimization.cornerCount > 0)));
    var bIsComplex = !!(b.isHybrid || (b.optimization && (b.optimization.rotAdditions > 0 || b.optimization.cornerCount > 0)));
    if (aIsComplex !== bIsComplex) return aIsComplex ? 1 : -1;
    if (a.sheetsNeeded !== b.sheetsNeeded) return a.sheetsNeeded - b.sheetsNeeded;
    var aArea = a.pieceL * a.pieceW, bArea = b.pieceL * b.pieceW;
    if (aArea !== bArea) return bArea - aArea;
    if (a.totalPieces !== b.totalPieces) return a.totalPieces - b.totalPieces;
    if (a.balanceScore !== b.balanceScore) return b.balanceScore - a.balanceScore;
    if (a.wastePct !== b.wastePct) return a.wastePct - b.wastePct;
    if (a.utilization !== b.utilization) return b.utilization - a.utilization;
    var aCuts = a.n + a.m - 2, bCuts = b.n + b.m - 2;
    if (aCuts !== bCuts) return aCuts - bCuts;
    return b._score.total - a._score.total;
  });

  var top5 = deduped.slice(0, 5);

  assignReasons(top5, orderQty);

  try {
    if (top5.length > 0) {
      var best = top5[0];
      console.log('--- Layout Selection ---');
      console.log('Selected: ' + lpFmt(best.pieceL) + ' x ' + lpFmt(best.pieceW) + ' (' + best.n + 'x' + best.m + ')');
      console.log('Tags/Sheet: ' + best.totalTagsPerSheet + ' (' + best.tagsPerPieceNominal + '/piece)');
      console.log('Utilization: ' + best.utilization.toFixed(1) + '% | Waste: ' + best.wastePct.toFixed(1) + '%');
    }
    if (rejectLog.length > 0 && console.groupCollapsed) {
      console.groupCollapsed('Layout Optimizer: ' + rejectLog.length + ' rejected, ' + top5.length + ' accepted');
      rejectLog.forEach(function(r) { console.debug('Rejected: ' + r.piece + ' | ' + r.reason); });
      console.groupEnd();
    }
  } catch (e) { }
  if (typeof window !== 'undefined') {
    window.__LAYOUT_REJECT_LOG__ = rejectLog;
  }

  return top5;
}

function scoreCandidates(candidates) {
  if (candidates.length === 0) return;

  var maxTags = 0, maxBalance = 0, maxPieceArea = 0;
  var minPieces = Infinity, minWaste = Infinity;

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (c.totalTagsPerSheet > maxTags) maxTags = c.totalTagsPerSheet;
    if (c.balanceScore > maxBalance) maxBalance = c.balanceScore;
    var pa = c.pieceL * c.pieceW;
    if (pa > maxPieceArea) maxPieceArea = pa;
    if (c.totalPieces < minPieces) minPieces = c.totalPieces;
    if (c.wastePct < minWaste) minWaste = c.wastePct;
  }

  var rangeTags = Math.max(1, maxTags);
  var rangeBalance = Math.max(1, maxBalance);
  var rangePiece = Math.max(1, maxPieceArea);
  var rangePieces = Math.max(1, minPieces);
  var rangeWaste = Math.max(1, minWaste);

  for (var j = 0; j < candidates.length; j++) {
    var cc = candidates[j];
    var s = {};

    s.tagsPerSheet = (cc.totalTagsPerSheet / rangeTags) * 100;
    s.balance = (cc.balanceScore / rangeBalance) * 100;
    s.pieceArea = ((cc.pieceL * cc.pieceW) / rangePiece) * 100;
    s.piecesCount = minPieces > 0 ? ((minPieces + rangePieces - cc.totalPieces) / rangePieces) * 100 : 50;
    s.waste = ((minWaste + rangeWaste - cc.wastePct) / rangeWaste) * 100;

    var total = s.tagsPerSheet * 0.30 + s.pieceArea * 0.20 + s.piecesCount * 0.15 + s.balance * 0.15 + s.waste * 0.10;
    cc._score = { total: total, breakdown: s };
  }
}

function assignReasons(candidates, orderQty) {
  if (candidates.length === 0) return;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (c.production && c.production.whySelected) {
      c.reasons = c.production.whySelected;
    } else {
      c.reasons = ['Best overall'];
    }
  }
}

function generateSuggestions(sheetL, sheetW, origTagL, origTagW, overlapIn, marginIn, orderQty, feedOffset, feedHand, currentBestCandidate) {
  if (!currentBestCandidate || currentBestCandidate.totalTagsPerSheet === 0) return null;
  
  var origTags = currentBestCandidate.totalTagsPerSheet;
  var bestSuggestion = null;
  
  // Test variations: decrement size by 0.025" up to 0.250"
  var variations = [0.025, 0.05, 0.075, 0.10, 0.125, 0.15, 0.175, 0.20, 0.225, 0.25];
  
  // Suppress logs for the background variations
  var originalLog = console.log;
  var originalWarn = console.warn;
  var originalDebug = console.debug;
  var originalGroup = console.groupCollapsed;
  var originalGroupEnd = console.groupEnd;
  console.log = function() {};
  console.warn = function() {};
  console.debug = function() {};
  console.groupCollapsed = function() {};
  console.groupEnd = function() {};
  
  try {
    for (var i = 0; i < variations.length; i++) {
      var dec = variations[i];
      var testL = Math.max(0.5, origTagL - dec);
      var testW = Math.max(0.5, origTagW - dec);
      
      var cands = generateAllLayouts(sheetL, sheetW, testL, testW, overlapIn, marginIn, orderQty, feedOffset, feedHand);
      
      if (cands && cands.length > 0) {
        var top = cands[0];
        if (top.totalTagsPerSheet > origTags) {
          if (!bestSuggestion || top.totalTagsPerSheet > bestSuggestion.tagsPerSheet || (top.totalTagsPerSheet === bestSuggestion.tagsPerSheet && dec < bestSuggestion.dec)) {
            bestSuggestion = {
              tagL: testL,
              tagW: testW,
              dec: dec,
              tagsPerSheet: top.totalTagsPerSheet,
              wastePct: top.wastePct,
              utilization: top.utilization,
              pieceL: top.pieceL,
              pieceW: top.pieceW,
              pieces: top.totalPieces
            };
          }
        }
      }
    }
  } catch (e) {
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.debug = originalDebug;
    console.groupCollapsed = originalGroup;
    console.groupEnd = originalGroupEnd;
  }
  
  return bestSuggestion;
}
