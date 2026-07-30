function optimizeOrientation(sheetL, sheetW, tagL, tagW, feed, overlapIn, marginIn, isHandFeed) {
  var layouts = [];

  var MIN_HAND_PIECE = 6;
  var MIN_HAND_PIECE_LONG = 9;

  LayoutStrategies.filter(function(s) { return s.enabled !== false; }).forEach(function(strategy) {
    var tl = strategy.rotate ? tagW : tagL;
    var tw = strategy.rotate ? tagL : tagW;
    var layout = createLayout(sheetL, sheetW, tl, tw, feed, overlapIn, marginIn, strategy);
    layout.score = scoreLayout(layout);
    layout.validation = validateLayout(layout);
    if (layout.validation.valid) {
      if (!isHandFeed || (Math.min(layout.pieceL, layout.pieceW) >= MIN_HAND_PIECE && Math.max(layout.pieceL, layout.pieceW) >= MIN_HAND_PIECE_LONG)) {
        layout.wasteRecovery = analyzeWaste(layout);
        layouts.push(layout);
      }
    }
  });

  layouts.sort(function(a, b) { return b.score - a.score; });

  if (layouts.length === 0) {
    var fallback = createLayout(sheetL, sheetW, tagL, tagW, feed, overlapIn, marginIn, null);
    layouts.push(fallback);
  }

  var best = layouts[0];
  var isRotated = best.TL !== tagL || best.TW !== tagW;

  return {
    TL: best.TL, TW: best.TW,
    n: best.n, m: best.m,
    pieceL: best.pieceL, pieceW: best.pieceW,
    autoPiecesPerSheet: best.autoPiecesPerSheet,
    tagsRows: best.tagsRows, tagsCols: best.tagsCols,
    tagsPerPieceNominal: best.tagsPerPieceNominal,
    leftoverL: best.leftoverL, leftoverW: best.leftoverW,
    totalTagsPerSheet: best.totalTagsPerSheet,
    isRotated: isRotated,
    strategyAnalysis: { best: best, allValid: layouts },
  };
}
