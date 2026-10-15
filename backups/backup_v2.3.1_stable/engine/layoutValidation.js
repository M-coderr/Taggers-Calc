// layoutValidation.js
// Geometry validation layer for layout calculations.
// All functions are global scope (no ES modules).

function validateLayoutGeometry(data) {
  var errors = [];
  var warnings = [];
  var EPSILON = 0.0001;

  if (data.tagsRows > 0) {
    var tagsSpanL = data.tagsRows * data.tagCutL;
    if (tagsSpanL > data.usableL + EPSILON) {
      errors.push("Tags overflow usable L: " + data.tagsRows + " rows x " + data.tagCutL.toFixed(4) + " = " + tagsSpanL.toFixed(4) + " > " + data.usableL.toFixed(4));
    }
    if (data.marginIn > EPSILON) {
      var firstTagStartL = data.marginIn;
      var lastTagEndL = data.marginIn + tagsSpanL;
      if (firstTagStartL - EPSILON < 0) {
        errors.push("First tag row starts before usable area at " + firstTagStartL.toFixed(4));
      }
      if (lastTagEndL > data.pieceL - data.marginIn + EPSILON) {
        errors.push("Last tag row ends outside usable area: " + lastTagEndL.toFixed(4) + " > " + (data.pieceL - data.marginIn).toFixed(4));
      }
    }
  }

  if (data.tagsCols > 0) {
    var tagsSpanW = data.tagsCols * data.tagCutW;
    if (tagsSpanW > data.usableW + EPSILON) {
      errors.push("Tags overflow usable W: " + data.tagsCols + " cols x " + data.tagCutW.toFixed(4) + " = " + tagsSpanW.toFixed(4) + " > " + data.usableW.toFixed(4));
    }
    if (data.marginIn > EPSILON) {
      var firstTagStartW = data.marginIn;
      var lastTagEndW = data.marginIn + tagsSpanW;
      if (firstTagStartW - EPSILON < 0) {
        errors.push("First tag column starts before usable area at " + firstTagStartW.toFixed(4));
      }
      if (lastTagEndW > data.pieceW - data.marginIn + EPSILON) {
        errors.push("Last tag column ends outside usable area: " + lastTagEndW.toFixed(4) + " > " + (data.pieceW - data.marginIn).toFixed(4));
      }
    }
  }

  var expectedTagsPerPiece = data.tagsRows * data.tagsCols;
  if (expectedTagsPerPiece !== data.tagsPerPieceNominal) {
    errors.push("Tags per piece mismatch: rows*cols=" + expectedTagsPerPiece + " vs reported=" + data.tagsPerPieceNominal);
  }

  var expectedTotalTags = data.tagsPerPieceNominal * data.autoPiecesPerSheet;
  if (expectedTotalTags !== data.totalTagsPerSheet) {
    errors.push("Tags per sheet mismatch: perPiece*pieces=" + expectedTotalTags + " vs reported=" + data.totalTagsPerSheet);
  }

  if (data.overlapIn < -EPSILON) {
    errors.push("Negative overlap: " + data.overlapIn.toFixed(4));
  }

  if (data.marginIn < -EPSILON) {
    errors.push("Negative margin: " + data.marginIn.toFixed(4));
  }

  if (data.tagCutL <= 0 && data.tagsRows > 0) {
    errors.push("Tag cut length non-positive with rows > 0");
  }

  if (data.tagCutW <= 0 && data.tagsCols > 0) {
    errors.push("Tag cut width non-positive with cols > 0");
  }

  if (data.tagsRows === 0 && data.tagsCols === 0 && data.tagsPerPieceNominal > 0) {
    errors.push("Tags per piece > 0 but rows and cols are both 0");
  }

  var devTestTable = [{
    "Piece Size": data.pieceL.toFixed(2) + " x " + data.pieceW.toFixed(2),
    "Usable Size": data.usableL.toFixed(3) + " x " + data.usableW.toFixed(3),
    "Margin Removed": (2 * data.marginIn).toFixed(4) + " x " + (2 * data.marginIn).toFixed(4),
    "Overlap": data.overlapIn.toFixed(4),
    "Rows": data.tagsRows,
    "Columns": data.tagsCols,
    "Tags/Piece": data.tagsPerPieceNominal,
    "Tags/Sheet": data.totalTagsPerSheet,
    "Utilization": data.pieceL * data.pieceW > 0
      ? ((data.tagsPerPieceNominal * data.tagCutL * data.tagCutW) / (data.pieceL * data.pieceW) * 100).toFixed(1) + "%"
      : "N/A",
    "Validation": errors.length === 0 ? "PASS" : "FAIL (" + errors.length + " error(s))",
  }];

  if (typeof console !== "undefined" && data.tagsPerPieceNominal > 0) {
    console.log("%c[LayoutValidation] " + (errors.length === 0 ? "PASS" : "FAIL"), errors.length === 0 ? "color:green" : "color:red;font-weight:bold");
    console.table(devTestTable);
    if (errors.length > 0) {
      errors.forEach(function(e) { console.error("[LayoutValidation] " + e); });
    }
    if (warnings.length > 0) {
      warnings.forEach(function(w) { console.warn("[LayoutValidation] " + w); });
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors,
    warnings: warnings,
    devTestTable: devTestTable,
  };
}
