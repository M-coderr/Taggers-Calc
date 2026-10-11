// productionAnalyzer.js — Production Optimization Layer v1.0
// Analyzes a layout candidate from a production/printing operations perspective.
// Non-destructive: takes a candidate and returns a fresh `production` object.
// This module is the second stage of the two-stage optimization pipeline:
//   Stage 1: generateAllLayouts() — geometric nesting
//   Stage 2: analyzeProduction()  — production feasibility & cost scoring

/**
 * analyzeProduction
 * @param {Object} candidate  - candidate from generateAllLayouts()
 * @param {number} sheetL     - sheet length (inches)
 * @param {number} sheetW     - sheet width (inches)
 * @returns {Object}          - production analysis object
 */
function analyzeProduction(candidate, sheetL, sheetW) {
  var n          = Math.max(1, candidate.n || 1);   // piece columns along sheetW
  var m          = Math.max(1, candidate.m || 1);   // piece rows along sheetL
  var pL         = candidate.pieceL || 0;
  var pW         = candidate.pieceW || 0;
  var utilization = candidate.utilization || 0;
  var isMixed    = !!candidate.isMixed;
  var totalPieces = n * m;

  // ------------------------------------------------------------------
  // 1. PIECE TYPE DETECTION
  // ------------------------------------------------------------------
  // For uniform grids:  all n×m pieces are identical → 1 unique type.
  // For mixed-strip:    candidate.strips[] groups pieces by dimension.
  var pieceTypes = [];

  if (isMixed && Array.isArray(candidate.strips) && candidate.strips.length > 0) {
    var typeSeen = {};
    candidate.strips.forEach(function(s) {
      var key = s.L.toFixed(3) + 'x' + s.W.toFixed(3);
      if (!typeSeen[key]) {
        typeSeen[key] = {
          L: s.L, W: s.W,
          count: 0,
          tagsPerPiece: (s.rows || 0) * (s.cols || 0),
          rows: s.rows || 0,
          cols: s.cols || 0,
          isFullStrip: false,
        };
        pieceTypes.push(typeSeen[key]);
      }
      typeSeen[key].count += (s.count || 1);
    });
    // Mark the largest piece type as "full strip"
    if (pieceTypes.length > 1) {
      var biggest = pieceTypes.reduce(function(a, b) { return a.L * a.W >= b.L * b.W ? a : b; });
      biggest.isFullStrip = true;
    }
  } else {
    // Uniform grid: single piece type
    pieceTypes = [{
      L: pL, W: pW,
      count: totalPieces,
      tagsPerPiece: (candidate.tagsRows || 0) * (candidate.tagsCols || 0),
      rows: candidate.tagsRows || 0,
      cols: candidate.tagsCols || 0,
      isFullStrip: true,
    }];
  }
  var uniquePieceTypes = pieceTypes.length;

  // ------------------------------------------------------------------
  // 2. GUILLOTINE CUT COUNT
  // ------------------------------------------------------------------
  // For a uniform n×m grid:
  //   verticalCuts   = n - 1  (cuts parallel to sheet height, creating n columns)
  //   horizontalCuts = m - 1  (cuts parallel to sheet width, creating m rows)
  //
  // For a mixed-strip (2 horizontal strips, n columns each):
  //   verticalCuts   = n - 1
  //   horizontalCuts = 1       (one cut separating the two strips)
  //   Then each strip needs n-1 vertical cuts — but those are the SAME cuts.
  //   Total cuts = (n - 1) + 1 = n cuts.
  var verticalCuts   = n - 1;
  var horizontalCuts = isMixed ? 1 : m - 1;
  var guillotineCuts = verticalCuts + horizontalCuts;

  // ------------------------------------------------------------------
  // 3. PIECE REUSE SCORE  (0 – 100)
  // ------------------------------------------------------------------
  // Measures how many unique dies are needed. Fewer unique types = better.
  var pieceReuseScore;
  if (uniquePieceTypes === 1) {
    pieceReuseScore = 100;   // All pieces identical — single die, maximum reuse
  } else if (uniquePieceTypes === 2) {
    // Two sizes but possibly same die (same tag pitch in the common axis)
    var t0 = pieceTypes[0], t1 = pieceTypes[1];
    var sameCols = t0.cols === t1.cols && t0.cols > 0;
    pieceReuseScore = sameCols ? 82 : 60;
  } else if (uniquePieceTypes === 3) {
    pieceReuseScore = 38;
  } else {
    pieceReuseScore = 10;
  }

  // ------------------------------------------------------------------
  // 4. RECTANGULAR SCORE  (0 – 100)
  // ------------------------------------------------------------------
  // All current candidates produce rectangular pieces by construction.
  // Reserved for future non-rectangular strategies.
  var rectangularScore = 100;

  // ------------------------------------------------------------------
  // 5. HANDLING SCORE  (0 – 100)
  // ------------------------------------------------------------------
  // Measures ease of stacking, sorting, and handling during production.
  var handlingPts = 0;

  // Base: how uniform are the pieces?
  if (uniquePieceTypes === 1) {
    handlingPts += 50;   // All identical → trivial stacking, single stack
  } else if (uniquePieceTypes === 2) {
    handlingPts += 28;   // Two types → two stacks, manageable
  }

  // Strip geometry: strips cut in only one direction are easiest
  if (n === 1 && m === 1) handlingPts += 20;        // single piece, no cuts
  else if (n === 1 || m === 1) handlingPts += 18;   // only one axis cut
  else handlingPts += 8;                             // both axes cut

  // Total piece count
  if (totalPieces <= 3) handlingPts += 20;
  else if (totalPieces <= 6) handlingPts += 14;
  else if (totalPieces <= 12) handlingPts += 6;

  // Low cut count bonus
  if (guillotineCuts <= 2) handlingPts += 10;
  else if (guillotineCuts <= 4) handlingPts += 4;

  var handlingScore = Math.min(100, handlingPts);
  var handlingLabel = handlingScore >= 80 ? 'Excellent'
                    : handlingScore >= 60 ? 'Good'
                    : handlingScore >= 40 ? 'Fair'
                    : 'Poor';

  // ------------------------------------------------------------------
  // 6. PRODUCTION SCORE  (weighted composite, 0 – 100)
  // ------------------------------------------------------------------
  // Normalize guillotine cuts score: max realistic cuts ≈ 14 (7×3 grid).
  var MAX_CUTS = 14;
  var cutsScore = Math.max(0, (1 - guillotineCuts / MAX_CUTS)) * 100;

  var productionScore = Math.round(
    utilization      * 0.40 +
    pieceReuseScore  * 0.25 +
    cutsScore        * 0.20 +
    rectangularScore * 0.10 +
    handlingScore    * 0.05
  );
  productionScore = Math.max(0, Math.min(100, productionScore));

  // ------------------------------------------------------------------
  // 7. WHY SELECTED — human-readable bullet points
  // ------------------------------------------------------------------
  var whySelected = [];

  if (uniquePieceTypes === 1) {
    whySelected.push('Same die for all pieces');
    if (totalPieces > 1) whySelected.push('All ' + totalPieces + ' pieces identical — easy stacking');
  } else if (uniquePieceTypes === 2) {
    whySelected.push('Same die, 2 strip sizes');
  }

  if (guillotineCuts === 0) {
    whySelected.push('No cuts needed');
  } else if (guillotineCuts === 1) {
    whySelected.push('Only 1 guillotine cut');
  } else if (guillotineCuts <= 3) {
    whySelected.push('Only ' + guillotineCuts + ' guillotine cuts');
  } else {
    whySelected.push(guillotineCuts + ' guillotine cuts');
  }

  if (handlingLabel === 'Excellent') whySelected.push('Excellent stacking & handling');
  else if (handlingLabel === 'Good')  whySelected.push('Easy to handle');

  if (utilization >= 88) whySelected.push('Very high paper utilization (' + utilization.toFixed(1) + '%)');
  else if (utilization >= 78) whySelected.push('Good paper utilization (' + utilization.toFixed(1) + '%)');

  if (isMixed) whySelected.push('Mixed strips — recovers extra tags');
  if (n === 1 && m > 1) whySelected.push('Simple horizontal strips only');
  if (m === 1 && n > 1) whySelected.push('Simple vertical strips only');

  // ------------------------------------------------------------------
  // 8. PIECE TYPE LABELS  (for display)
  // ------------------------------------------------------------------
  function lpFmt(v) { return typeof v === 'number' ? v.toFixed(3) : '?'; }
  pieceTypes.forEach(function(pt, idx) {
    pt.sizeDesc = lpFmt(pt.L) + ' \u00d7 ' + lpFmt(pt.W) + '"';
    pt.label = pt.isFullStrip ? 'Full Piece' : 'Partial Piece';
    if (uniquePieceTypes === 1) pt.label = 'Full Piece';
    else if (idx === 0) pt.label = 'Piece A';
    else if (idx === 1) pt.label = 'Piece B';
    else pt.label = 'Piece ' + String.fromCharCode(65 + idx);
  });

  return {
    pieceTypes       : pieceTypes,
    uniquePieceTypes : uniquePieceTypes,
    verticalCuts     : verticalCuts,
    horizontalCuts   : horizontalCuts,
    guillotineCuts   : guillotineCuts,
    pieceReuseScore  : pieceReuseScore,
    rectangularScore : rectangularScore,
    handlingScore    : handlingScore,
    handlingLabel    : handlingLabel,
    cutsScore        : Math.round(cutsScore),
    productionScore  : productionScore,
    whySelected      : whySelected,
    isMixed          : isMixed,
  };
}
