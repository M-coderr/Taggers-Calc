function validateLayout(layout) {
  var result = { valid: true, warnings: [], errors: [] };
  if (!layout.tagsPerPieceNominal || layout.tagsPerPieceNominal === 0) {
    result.valid = false;
    result.errors.push("No tags fit on this sheet.");
  }
  return result;
}

function fitsBox(a, b, boxA, boxB) {
  return (a <= boxA && b <= boxB) || (a <= boxB && b <= boxA);
}

function pieceTier(pieceL, pieceW) {
  if (fitsBox(pieceL, pieceW, 9, 12)) {
    return { tier: "small", label: 'Up to 9" x 12"', dieCost: 1200, runRate: 500 };
  }
  if (fitsBox(pieceL, pieceW, 14, 20)) {
    return { tier: "medium", label: 'Up to 14" x 20"', dieCost: 1600, runRate: 500 };
  }
  return { tier: "large", label: 'Bigger than 14" x 20"', dieCost: 2800, runRate: 750 };
}
