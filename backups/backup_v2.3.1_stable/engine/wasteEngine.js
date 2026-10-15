function computeWaste(sheetL, sheetW, pieceL, pieceW, piecesAcross, piecesDown) {
  var usedArea = pieceL * pieceW * piecesAcross * piecesDown;
  var sheetArea = sheetL * sheetW;
  if (!sheetArea) return 0;
  return Math.max(0, Math.min(100, ((sheetArea - usedArea) / sheetArea) * 100));
}
