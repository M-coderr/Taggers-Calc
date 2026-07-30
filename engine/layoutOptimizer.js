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

  function fitsFeed(pl, pw) {
    return (pl <= feedL + 0.01 && pw <= feedW + 0.01) || (pl <= feedW + 0.01 && pw <= feedL + 0.01);
  }

  function meetsMinHandSize(pl, pw) {
    if (!isHandFeed) return true;
    var short = Math.min(pl, pw);
    var long = Math.max(pl, pw);
    return short >= MIN_HAND_PIECE && long >= MIN_HAND_PIECE_LONG;
  }

  var tagCutL = tagL + 2 * overlapIn;
  var tagCutW = tagW + 2 * overlapIn;
  var rotCutL = tagW + 2 * overlapIn;
  var rotCutW = tagL + 2 * overlapIn;

  function lpFmt(v) { return v.toFixed(3); }
  function evalLayout(pieceL, pieceW, cutL, cutW) {
    var usableL = Math.max(0, pieceL - 2 * marginIn);
    var usableW = Math.max(0, pieceW - 2 * marginIn);
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
    var usableL = Math.max(0, pieceL - 2 * marginIn);
    var usableW = Math.max(0, pieceW - 2 * marginIn);
    var rows = cutL > 0 ? Math.floor((usableL + 2 * overlapIn) / cutL) : 0;
    var cols = cutW > 0 ? Math.floor((usableW + 2 * overlapIn) / cutW) : 0;
    var usableL_eff = usableL + 2 * overlapIn;
    var usableW_eff = usableW + 2 * overlapIn;
    var leftoverL = usableL_eff - rows * cutL;
    var leftoverW = usableW_eff - cols * cutW;
    var reclaimed = 0, rotAdditions = 0, rotColCount = 0, rotRowCount = 0;
    var addedRows = 0, addedCols = 0;
    var extensionL = 0, extensionW = 0;

    if (isHandFeed) {
      var pocketOK = false;
      if (leftoverL >= cutW && leftoverW >= cutL) {
        pocketOK = true;
      } else if (leftoverL >= cutL && leftoverW >= cutW) {
        pocketOK = true;
      }
      if (!pocketOK) {
        var needL4rot = Math.max(0, cutW - leftoverL);
        var needW4rot = Math.max(0, cutL - leftoverW);
        var needL4norm = Math.max(0, cutL - leftoverL);
        var needW4norm = Math.max(0, cutW - leftoverW);
        if (needL4rot <= marginIn && needW4rot <= marginIn) {
          extensionL = needL4rot;
          extensionW = needW4rot;
          pocketOK = true;
        } else if (needL4norm <= marginIn && needW4norm <= marginIn) {
          extensionL = needL4norm;
          extensionW = needW4norm;
          pocketOK = true;
        }
      }
      if (pocketOK) {
        reclaimed = 1;
        rotAdditions = 1;
        rotColCount = 1;
      }
    }
    try { console.log('[RECLAIM-CORNER] ' + (isHandFeed ? 'HAND' : 'OFFSET') + ' piece ' + lpFmt(pieceL) + 'x' + lpFmt(pieceW) + ' cut ' + lpFmt(cutL) + 'x' + lpFmt(cutW) + ' rows=' + rows + ' cols=' + cols + ' leftover ' + lpFmt(leftoverL) + 'x' + lpFmt(leftoverW) + ' extension ' + lpFmt(extensionL) + 'x' + lpFmt(extensionW) + ' reclaimed=' + reclaimed); } catch(e) {}
    return { rows: rows, cols: cols, total: rows * cols, reclaimed: reclaimed, addedRows: addedRows, addedCols: addedCols, rotAdditions: rotAdditions, rotColCount: rotColCount, rotRowCount: rotRowCount, leftoverL: leftoverL, leftoverW: leftoverW };
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

        if (pW < ori.cutW + 2 * marginIn - 2 * overlapIn) continue;
        if (pL < ori.cutL + 2 * marginIn - 2 * overlapIn) continue;

        if (!fitsFeed(pL, pW)) {
          rejectLog.push({ piece: lpFmt(pL) + 'x' + lpFmt(pW) + ' (' + ni + 'x' + mi + ')', reason: 'Exceeds feed' });
          continue;
        }
        if (!meetsMinHandSize(pL, pW)) {
          rejectLog.push({ piece: lpFmt(pL) + 'x' + lpFmt(pW) + ' (' + ni + 'x' + mi + ')', reason: 'Below min hand print size 6x9' });
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

          var usableL = Math.max(0, pL - 2 * marginIn);
          var usableW = Math.max(0, pW - 2 * marginIn);
          var gridL = evResult.rows > 0 ? evResult.rows * ori.cutL - 2 * overlapIn : 0;
          var gridW = evResult.cols > 0 ? evResult.cols * ori.cutW - 2 * overlapIn : 0;

          var isCornerFit = strategy === 'corner-fit';
          var recClaimL = (rotRowCount > 0) ? ori.cutW : 0;
          var recClaimW = (rotColCount > 0) ? ori.cutW : 0;
          var recClaimL_corner = isCornerFit ? ori.cutL : 0;

          var firstTagL = marginIn + Math.max(0, (usableL - gridL) / 2);
          var lastTagEndL = firstTagL + gridL;
          var extPL = Math.max(pL, lastTagEndL + Math.max(recClaimL, recClaimL_corner) + marginIn);

          var firstTagW = marginIn + Math.max(0, (usableW - gridW) / 2);
          var lastTagEndW = firstTagW + gridW;
          var extPW = Math.max(pW, lastTagEndW + recClaimW + marginIn);

          var validRotRowCount = 0;
          var totalL = 0;
          for (var c = 0; c < mi; c++) {
            var trialExtPL = (c < rotRowCount) ? extPL : pL;
            if (totalL + trialExtPL <= sheetL + 0.01) {
              totalL += trialExtPL;
              if (c < rotRowCount) validRotRowCount++;
            } else {
              totalL += pL;
            }
          }

          var validRotColCount = 0;
          var totalW = 0;
          for (var r = 0; r < ni; r++) {
            var trialExtPW = (r < rotColCount) ? extPW : pW;
            if (totalW + trialExtPW <= sheetW + 0.01) {
              totalW += trialExtPW;
              if (r < rotColCount) validRotColCount++;
            } else {
              totalW += pW;
            }
          }

          if (totalL > sheetL + 0.01 || totalW > sheetW + 0.01) {
            return;
          }

          var validatedReclaimed = validRotRowCount + validRotColCount;
          var finalStrategy = (validatedReclaimed > 0) ? strategy : 'none';
          var effectiveTagsPerPiece = tagsPerPiece + validatedReclaimed;
          var totalTags = effectiveTagsPerPiece * totalPieces;
          if (totalTags < 1) return;

          var sheetArea = sheetL * sheetW;
          var sheetsNeeded = Math.ceil(orderQty / totalTags);
          var totalTagArea = totalTags * ori.cutL * ori.cutW;
          var tagAreaUtil = sheetArea > 0 ? Math.min(100, totalTagArea / sheetArea * 100) : 0;
          var wastePct = Math.max(0, 100 - tagAreaUtil);

          var k = tagL + 'x' + tagW + '|' + ori.label + '|' + evResult.rows + 'x' + evResult.cols + '|' + ni + 'x' + mi + (finalStrategy === 'corner-fit' ? '_corner' : '');
          if (seen[k]) return;
          seen[k] = true;

          var balanceScore = Math.min(evResult.rows, evResult.cols) > 0
            ? Math.round((Math.min(evResult.rows, evResult.cols) / Math.max(evResult.rows, evResult.cols)) * 100)
            : 0;

          candidates.push({
            TL: tagL, TW: tagW,
            n: ni, m: mi,
            pieceL: pL, pieceW: pW,
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
              rotAdditions: validatedReclaimed, rotColCount: validRotColCount, rotRowCount: validRotRowCount,
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
          if (cf.reclaimed !== ev.reclaimed && cf.reclaimed > 0) {
            pushCandidate(cf, 'corner-fit');
          } else if (ev.reclaimed > 0) {
            // also try even when reclaimed matches — corner-fit may have different leftover display
            var isDiff = cf.rotAdditions !== ev.rotAdditions || cf.rotColCount !== ev.rotColCount || cf.rotRowCount !== ev.rotRowCount;
            if (isDiff) {
              pushCandidate(cf, 'corner-fit');
            }
          }
        }
      }
    }
  }

  if (candidates.length === 0) {
    var fallbackSizes = [[sheetL, sheetW], [sheetW, sheetL]];
    for (var fi = 0; fi < fallbackSizes.length; fi++) {
      var pL = fallbackSizes[fi][0], pW = fallbackSizes[fi][1];
      if (fitsFeed(pL, pW) && meetsMinHandSize(pL, pW)) {
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
    var dk = c.TL + '|' + c.TW + '|' + c.pieceL.toFixed(4) + '|' + c.pieceW.toFixed(4) + '|' + c.n + '|' + c.m + '|' + c.tagsRows + '|' + c.tagsCols;
    if (dedupSeen[dk]) continue;
    dedupSeen[dk] = true;
    deduped.push(c);
  }

  scoreCandidates(deduped);
  deduped.sort(function(a, b) {
    if (a.totalTagsPerSheet !== b.totalTagsPerSheet) return b.totalTagsPerSheet - a.totalTagsPerSheet;
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
  window.__LAYOUT_REJECT_LOG__ = rejectLog;

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

  function sortBy(fn, asc) {
    var sorted = candidates.slice(0);
    sorted.sort(function(a, b) { return asc ? fn(a) - fn(b) : fn(b) - fn(a); });
    return sorted[0];
  }

  var bestTags = sortBy(function(c) { return c.totalTagsPerSheet; }, false);
  var bestWaste = sortBy(function(c) { return c.wastePct; }, true);
  var bestSheets = sortBy(function(c) { return c.sheetsNeeded; }, true);
  var bestUtil = sortBy(function(c) { return c.utilization; }, false);
  var bestPiece = sortBy(function(c) { return c.pieceL * c.pieceW; }, false);
  var bestHandling = sortBy(function(c) { return c.totalPieces; }, true);

  var taken = {};

  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    var reasons = [];

    if (c === bestTags && !taken.tags) { reasons.push('Highest output'); taken.tags = true; }
    if (c === bestWaste && !taken.waste) { reasons.push('Best material usage'); taken.waste = true; }
    if (c === bestSheets && !taken.sheets) { reasons.push('Fewest sheets'); taken.sheets = true; }
    if (c === bestUtil && !taken.util) { reasons.push('Best utilization'); taken.util = true; }
    if (c === bestPiece && !taken.piece) { reasons.push('Largest piece'); taken.piece = true; }
    if (c === bestHandling && !taken.handling) { reasons.push('Fewest operations'); taken.handling = true; }

    if (reasons.length === 0 && i === 0) {
      var r = [];
      r.push('Highest output');
      if (c === bestPiece) r.push('Largest piece');
      if (c === bestHandling) r.push('Fewest operations');
      if (c.balanceScore >= 90) r.push('Balanced layout');
      if (r.length > 1) reasons = r;
      else reasons.push('Best overall');
    }
    if (reasons.length === 0) {
      if (c.tagsPerPieceNominal >= 8 && c.wastePct < 15) reasons.push('Good balance');
      else if (c.wastePct < 10) reasons.push('Low waste');
      else if (c.totalTagsPerSheet > 50) reasons.push('High output');
      else if (c.pieceL * c.pieceW > 300) reasons.push('Large piece');
      else reasons.push('Valid alternative');
    }

    c.reasons = reasons;
  }
}
