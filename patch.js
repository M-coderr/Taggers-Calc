const fs = require('fs');
let code = fs.readFileSync('engine/layoutOptimizer.js', 'utf8');

// 1. Insert evalMixedStrips
const mixedStripsCode = `
  function evalMixedStrips(ori) {
    if (!isHandFeed) return;
    for (var n = 1; n <= 8; n++) {
      var pW = sheetW / n;
      if (!fitsFeed(sheetL, pW) || !meetsMinHandSize(sheetL, pW)) continue;
      
      var maxK = Math.floor((sheetL - 2 * marginIn) / ori.cutL);
      for (var k = 1; k < maxK; k++) {
        var stripAL = k * ori.cutL + 2 * marginIn;
        var stripBL = sheetL - stripAL;
        
        if (!fitsFeed(stripAL, pW) || !meetsMinHandSize(stripAL, pW)) continue;
        if (!fitsFeed(stripBL, pW) || !meetsMinHandSize(stripBL, pW)) continue;
        
        var tagsA = evalLayout(stripAL, pW, ori.cutL, ori.cutW);
        var tagsB = evalLayout(stripBL, pW, ori.cutL, ori.cutW);
        
        if (tagsA.total > 0 && tagsB.total > 0) {
          var fTagsA = tagsA.total + tagsA.reclaimed;
          var fTagsB = tagsB.total + tagsB.reclaimed;
          var totalTags = (fTagsA + fTagsB) * n;
          var util = ((fTagsA + fTagsB) * tagCutL * tagCutW) / (sheetL * pW) * 100;
          
          candidates.push({
            TL: tagL, TW: tagW, n: n, m: 2,
            pieceL: sheetL, pieceW: pW,
            isMixed: true,
            strips: [
              { L: stripAL, W: pW, rows: tagsA.rows, cols: tagsA.cols, count: n, tagsPerStrip: fTagsA },
              { L: stripBL, W: pW, rows: tagsB.rows, cols: tagsB.cols, count: n, tagsPerStrip: fTagsB }
            ],
            tagsRows: tagsA.rows, tagsCols: tagsA.cols,
            tagsPerPieceNominal: (tagsA.total + tagsB.total) / 2, // average
            totalTagsPerSheet: totalTags,
            reclaimedTags: (tagsA.reclaimed + tagsB.reclaimed) * n,
            leftoverL: Math.max(tagsA.leftoverL, tagsB.leftoverL),
            leftoverW: Math.max(tagsA.leftoverW, tagsB.leftoverW),
            totalPieces: n * 2,
            sheetsNeeded: orderQty > 0 ? Math.ceil(orderQty / totalTags) : 0,
            wastePct: Math.max(0, 100 - util),
            utilization: Math.min(100, util),
            feedMode: feedLabel,
            tagDesc: ori.label + ' mixed strips',
            pieceDesc: 'Mixed',
            balanceScore: Math.min(tagsA.balanceScore || 100, tagsB.balanceScore || 100),
            optimization: {
              baseTags: (tagsA.total + tagsB.total) / 2,
              addedRows: 0, addedCols: 0,
              rotAdditions: (tagsA.rotAdditions + tagsB.rotAdditions) / 2,
              rotColCount: (tagsA.rotColCount + tagsB.rotColCount) / 2,
              rotRowCount: (tagsA.rotRowCount + tagsB.rotRowCount) / 2,
              finalTags: (fTagsA + fTagsB) / 2,
              mainRows: tagsA.rows, mainCols: tagsA.cols,
              renderRows: tagsA.rows, renderCols: tagsA.cols,
              balanceScore: 100, hasExtra: false,
              isTagRotated: ori.label === 'rotated',
              reclaimedTags: (tagsA.reclaimed + tagsB.reclaimed) / 2,
              reclaimStrategy: 'strip',
            }
          });
        }
      }
    }
  }
`;

code = code.replace('if (candidates.length === 0) {', mixedStripsCode + '\n\n  if (candidates.length === 0) {');

code = code.replace(/pushCandidate\(cf, 'corner-fit'\);\s*\}\s*\}/, `pushCandidate(cf, 'corner-fit');
          }
        }
      }
    }
    
    // Evaluate mixed strips for this orientation
    evalMixedStrips({ label: ori.label, cutL: ori.cutL, cutW: ori.cutW });`);

// 2. Attach production analysis
code = code.replace('scoreCandidates(deduped);', `scoreCandidates(deduped);
  if (typeof analyzeProduction === 'function') {
    for (var j = 0; j < deduped.length; j++) {
      deduped[j].production = analyzeProduction(deduped[j], sheetL, sheetW);
    }
  }`);

// 3. Change sort
code = code.replace(/deduped\.sort\(function\(a, b\) \{[\s\S]*?return b\._score\.total - a\._score\.total;\s*\}\);/, `deduped.sort(function(a, b) {
    if (a.production && b.production) {
      if (Math.abs(a.production.productionScore - b.production.productionScore) > 3) {
        return b.production.productionScore - a.production.productionScore;
      }
    }
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
  });`);

// 4. Update assignReasons
code = code.replace(/function assignReasons\(candidates, orderQty\) \{[\s\S]*?c\.reasons = reasons;\s*\}/, `function assignReasons(candidates, orderQty) {
  if (candidates.length === 0) return;
  for (var i = 0; i < candidates.length; i++) {
    var c = candidates[i];
    if (c.production && c.production.whySelected) {
      c.reasons = c.production.whySelected;
    } else {
      c.reasons = ['Best overall'];
    }
  }
}`);

fs.writeFileSync('engine/layoutOptimizer.js', code);
console.log('layoutOptimizer.js patched.');
