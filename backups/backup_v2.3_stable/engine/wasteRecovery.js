function analyzeWaste(layout, isHandFeed) {
  var result = {
    extraRows: 0, extraCols: 0, recoverableTags: 0,
    rotAdditions: 0, rotRowCount: 0, rotColCount: 0,
    suggestions: [], notes: [],
  };
  var overlap = layout.overlapIn || 0;
  var pieceL = layout.pieceL, pieceW = layout.pieceW;
  var usableL_eff = pieceL - 2 * layout.marginIn + 2 * overlap;
  var usableW_eff = pieceW - 2 * layout.marginIn + 2 * overlap;
  var tagL = layout.tagL || layout.TL || 0;
  var tagW = layout.tagW || layout.TW || 0;
  var cutL = layout.cutHeight || tagL + 2 * overlap;
  var cutW = layout.cutWidth || tagW + 2 * overlap;
  if (layout.isRotated) { var tmp = cutL; cutL = cutW; cutW = tmp; }
  var rows = layout.tagsRows || 0;
  var cols = layout.tagsCols || 0;
  var leftoverL = Math.max(0, usableL_eff - rows * cutL);
  var leftoverW = Math.max(0, usableW_eff - cols * cutW);
  if (isHandFeed !== false) {
    if (leftoverW >= cutW) {
      result.extraCols = 1;
      result.notes.push("Right strip can fit one additional regular column.");
    }
    if (leftoverL >= cutL) {
      result.extraRows = 1;
      result.notes.push("Bottom strip can fit one additional regular row.");
    }
    if (leftoverL >= cutW) {
      var btmRotCols = Math.floor(usableW_eff / cutL);
      result.rotAdditions += btmRotCols;
      result.rotColCount = btmRotCols;
      result.notes.push("Bottom strip can fit " + btmRotCols + " rotated tags.");
    }
    if (leftoverW >= cutL) {
      var availH = result.rotColCount > 0 ? rows * cutL : usableL_eff;
      if (availH >= cutW) {
        var rgtRotRows = Math.floor(availH / cutW);
        result.rotAdditions += rgtRotRows;
        result.rotRowCount = rgtRotRows;
        result.notes.push("Right strip can fit " + rgtRotRows + " rotated tags.");
      }
    }
    result.recoverableTags = result.extraRows * cols + result.extraCols * rows + result.rotAdditions;
  }
  return result;
}
