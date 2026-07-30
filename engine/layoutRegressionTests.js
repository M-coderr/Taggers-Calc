// layoutRegressionTests.js
// Reusable regression test suite for layout geometry.
// Run: call runLayoutTests() from the browser console.
// All tests use known inputs and expected outputs to catch silent geometry regressions.

var LayoutRegressionTests = [

  {
    name: "User test case: 25x36 sheet, 2x4 tag, 5mm margin, 2mm overlap",
    sheetL: 25, sheetW: 36,
    tagL: 2, tagW: 4,
    feed: [20, 30],
    overlapIn: 2 / 25.4,
    marginIn: 5 / 25.4,
    expected: {
      n: 2, m: 2,
      pieceL: 12.5, pieceW: 18,
      tagsRows: 5, tagsCols: 4,
      tagsPerPiece: 20,
      totalTagsPerSheet: 80,
    }
  },

  {
    name: "Simple: 10x10, 2x2 tag, no overlap, no margin",
    sheetL: 10, sheetW: 10,
    tagL: 2, tagW: 2,
    feed: [10, 10],
    overlapIn: 0,
    marginIn: 0,
    expected: {
      n: 1, m: 1,
      pieceL: 10, pieceW: 10,
      tagsRows: 5, tagsCols: 5,
      tagsPerPiece: 25,
      totalTagsPerSheet: 25,
    }
  },

  {
    name: "Large margin: 20x20, 3x3 tag, 1mm overlap, 2mm margin",
    sheetL: 20, sheetW: 20,
    tagL: 3, tagW: 3,
    feed: [20, 20],
    overlapIn: 1 / 25.4,
    marginIn: 2 / 25.4,
    expected: {
      n: 1, m: 1,
      pieceL: 20, pieceW: 20,
      tagsRows: 6, tagsCols: 6,
      tagsPerPiece: 36,
      totalTagsPerSheet: 36,
    }
  },

  {
    name: "No margin/overlap: 12x12, 3x4 tag",
    sheetL: 12, sheetW: 12,
    tagL: 3, tagW: 4,
    feed: [12, 12],
    overlapIn: 0,
    marginIn: 0,
    expected: {
      n: 1, m: 1,
      pieceL: 12, pieceW: 12,
      tagsRows: 4, tagsCols: 3,
      tagsPerPiece: 12,
      totalTagsPerSheet: 12,
    }
  },

  {
    name: "Tag barely fits: 10x10, 4.8x4.8 tag, no overlap/margin",
    sheetL: 10, sheetW: 10,
    tagL: 4.8, tagW: 4.8,
    feed: [10, 10],
    overlapIn: 0,
    marginIn: 0,
    expected: {
      n: 1, m: 1,
      pieceL: 10, pieceW: 10,
      tagsRows: 2, tagsCols: 2,
      tagsPerPiece: 4,
      totalTagsPerSheet: 4,
    }
  },

  {
    name: "Tag larger than piece: 10x10, 11x11 tag (should yield 0 tags)",
    sheetL: 10, sheetW: 10,
    tagL: 11, tagW: 11,
    feed: [10, 10],
    overlapIn: 0,
    marginIn: 0,
    expected: {
      n: 1, m: 1,
      pieceL: 10, pieceW: 10,
      tagsRows: 0, tagsCols: 0,
      tagsPerPiece: 0,
      totalTagsPerSheet: 0,
    }
  },

  {
    name: "Non-square sheet, feed splitting: 20x30, 2x3 tag, 1mm overlap, 2mm margin",
    sheetL: 20, sheetW: 30,
    tagL: 2, tagW: 3,
    feed: [10, 15],
    overlapIn: 1 / 25.4,
    marginIn: 2 / 25.4,
    expected: {
      n: 2, m: 2,
      pieceL: 10, pieceW: 15,
      tagsRows: 4, tagsCols: 4,
      tagsPerPiece: 16,
      totalTagsPerSheet: 64,
    }
  },

  {
    name: "Small tag, many fit: 10x10, 0.5x0.5 tag, no overlap/margin",
    sheetL: 10, sheetW: 10,
    tagL: 0.5, tagW: 0.5,
    feed: [10, 10],
    overlapIn: 0,
    marginIn: 0,
    expected: {
      n: 1, m: 1,
      pieceL: 10, pieceW: 10,
      tagsRows: 20, tagsCols: 20,
      tagsPerPiece: 400,
      totalTagsPerSheet: 400,
    }
  },

  {
    name: "Margin eats into space: 10x10, 1x1 tag, 1mm overlap, 1mm margin",
    sheetL: 10, sheetW: 10,
    tagL: 1, tagW: 1,
    feed: [10, 10],
    overlapIn: 1 / 25.4,
    marginIn: 1 / 25.4,
    expected: {
      n: 1, m: 1,
      pieceL: 10, pieceW: 10,
      tagsRows: 9, tagsCols: 9,
      tagsPerPiece: 81,
      totalTagsPerSheet: 81,
    }
  },

  {
    name: "Large overlap+margin: 12x12, 4x4 tag, 2mm overlap, 5mm margin",
    sheetL: 12, sheetW: 12,
    tagL: 4, tagW: 4,
    feed: [12, 12],
    overlapIn: 2 / 25.4,
    marginIn: 5 / 25.4,
    expected: {
      n: 1, m: 1,
      pieceL: 12, pieceW: 12,
      tagsRows: 2, tagsCols: 2,
      tagsPerPiece: 4,
      totalTagsPerSheet: 4,
    }
  },

  {
    name: "Rectangular tag: 25x36, 2x4 tag, default offset feed, 2mm overlap, 4mm margin",
    sheetL: 25, sheetW: 36,
    tagL: 2, tagW: 4,
    feed: [20, 30],
    overlapIn: 2 / 25.4,
    marginIn: 4 / 25.4,
    expected: {
      n: 2, m: 2,
      pieceL: 12.5, pieceW: 18,
      tagsRows: 5, tagsCols: 4,
      tagsPerPiece: 20,
      totalTagsPerSheet: 80,
    }
  },

  {
    name: "Tiny overlap with margin: 10x10, 3x3 tag, 0.5mm overlap, 5mm margin",
    sheetL: 10, sheetW: 10,
    tagL: 3, tagW: 3,
    feed: [10, 10],
    overlapIn: 0.5 / 25.4,
    marginIn: 5 / 25.4,
    expected: {
      n: 1, m: 1,
      pieceL: 10, pieceW: 10,
      tagsRows: 3, tagsCols: 3,
      tagsPerPiece: 9,
      totalTagsPerSheet: 9,
    }
  },

];

function runLayoutTests() {
  var passed = 0;
  var failed = 0;
  var results = [];

  LayoutRegressionTests.forEach(function(test, idx) {
    var layout = createLayout(
      test.sheetL, test.sheetW,
      test.tagL, test.tagW,
      test.feed,
      test.overlapIn, test.marginIn,
      null
    );

    var e = test.expected;
    var errors = [];

    if (layout.n !== e.n) errors.push("n: got " + layout.n + ", expected " + e.n);
    if (layout.m !== e.m) errors.push("m: got " + layout.m + ", expected " + e.m);
    if (Math.abs(layout.pieceL - e.pieceL) > 0.001) errors.push("pieceL: got " + layout.pieceL + ", expected " + e.pieceL);
    if (Math.abs(layout.pieceW - e.pieceW) > 0.001) errors.push("pieceW: got " + layout.pieceW + ", expected " + e.pieceW);
    if (layout.tagsRows !== e.tagsRows) errors.push("tagsRows: got " + layout.tagsRows + ", expected " + e.tagsRows);
    if (layout.tagsCols !== e.tagsCols) errors.push("tagsCols: got " + layout.tagsCols + ", expected " + e.tagsCols);
    if (layout.tagsPerPieceNominal !== e.tagsPerPiece) errors.push("tagsPerPiece: got " + layout.tagsPerPieceNominal + ", expected " + e.tagsPerPiece);
    if (layout.totalTagsPerSheet !== e.totalTagsPerSheet) errors.push("totalTagsPerSheet: got " + layout.totalTagsPerSheet + ", expected " + e.totalTagsPerSheet);

    if (!layout.geometryValidation.valid) {
      errors.push("Geometry validation FAILED: " + layout.geometryValidation.errors.join("; "));
    }

    var status = errors.length === 0 ? "PASS" : "FAIL";
    if (errors.length === 0) { passed++; } else { failed++; }

    results.push({
      "#": idx + 1,
      "Test": test.name,
      "Status": status,
      "Errors": errors.length === 0 ? "-" : errors.join("; "),
    });
  });

  console.log("%c=== Layout Regression Tests ===", "font-size:14px;font-weight:bold");
  console.log("%c" + passed + " passed, " + failed + " failed out of " + (passed + failed),
    failed === 0 ? "color:green;font-weight:bold" : "color:red;font-weight:bold");
  console.table(results);

  return { passed: passed, failed: failed, total: passed + failed, results: results };
}
