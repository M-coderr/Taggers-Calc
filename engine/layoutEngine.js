function mm2in(mm) {
  return mm / 25.4;
}

function createLayout(sheetL, sheetW, tagL, tagW, feed, overlapIn, marginIn, strategy) {
  var n = feed[0] > 0 ? Math.max(1, Math.ceil(sheetL / feed[0])) : 1;
  var m = feed[1] > 0 ? Math.max(1, Math.ceil(sheetW / feed[1])) : 1;
  var pieceL = sheetL / n;
  var pieceW = sheetW / m;
  var autoPiecesPerSheet = n * m;

  var tagCutL = tagL + 2 * overlapIn;
  var tagCutW = tagW + 2 * overlapIn;

  var usableL = Math.max(0, pieceL - 2 * marginIn);
  var usableW = Math.max(0, pieceW - 2 * marginIn);

  var tagsRows = tagCutL > 0 ? Math.floor(usableL / tagCutL) : 0;
  var tagsCols = tagCutW > 0 ? Math.floor(usableW / tagCutW) : 0;

  var leftoverL = tagsRows > 0 ? usableL - tagsRows * tagCutL : usableL;
  var leftoverW = tagsCols > 0 ? usableW - tagsCols * tagCutW : usableW;

  var tagsPerPieceNominal = tagsRows * tagsCols;
  var totalTagsPerSheet = tagsPerPieceNominal * autoPiecesPerSheet;

  var validation = validateLayoutGeometry({
    pieceL: pieceL, pieceW: pieceW,
    usableL: usableL, usableW: usableW,
    tagCutL: tagCutL, tagCutW: tagCutW,
    tagL: tagL, tagW: tagW,
    overlapIn: overlapIn, marginIn: marginIn,
    tagsRows: tagsRows, tagsCols: tagsCols,
    tagsPerPieceNominal: tagsPerPieceNominal,
    autoPiecesPerSheet: autoPiecesPerSheet,
    totalTagsPerSheet: totalTagsPerSheet,
  });

  if (!validation.valid) {
    console.error("LAYOUT GEOMETRY ERROR:", validation.errors);
  }

  return {
    TL: tagL, TW: tagW, n: n, m: m,
    pieceL: pieceL, pieceW: pieceW,
    usableL: usableL, usableW: usableW,
    autoPiecesPerSheet: autoPiecesPerSheet,
    tagsRows: tagsRows, tagsCols: tagsCols,
    tagsPerPieceNominal: tagsPerPieceNominal,
    leftoverL: leftoverL, leftoverW: leftoverW,
    totalTagsPerSheet: totalTagsPerSheet,
    utilization: (pieceL * pieceW > 0) ? (tagsPerPieceNominal * tagCutL * tagCutW) / (pieceL * pieceW) * 100 : 0,
    cutWidth: tagCutW, cutHeight: tagCutL,
    strategy: strategy || null,
    geometryValidation: validation,
  };
}

function computeLayout(sheetL, sheetW, tagL, tagW, feed, overlapIn, marginIn, strategy) {
  return createLayout(sheetL, sheetW, tagL, tagW, feed, overlapIn, marginIn, strategy);
}
