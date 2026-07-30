function analyzeWaste(layout) {
  var result = {
    extraRows: 0, extraCols: 0, recoverableTags: 0,
    suggestions: [], notes: [],
  };
  if (layout.leftoverW >= layout.cutWidth) {
    result.extraCols = 1;
    result.notes.push("Right strip can fit one additional column.");
  }
  if (layout.leftoverL >= layout.cutHeight) {
    result.extraRows = 1;
    result.notes.push("Bottom strip can fit one additional row.");
  }
  result.recoverableTags = result.extraRows * layout.tagsCols + result.extraCols * layout.tagsRows;
  return result;
}
