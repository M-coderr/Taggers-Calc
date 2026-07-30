# Layout Engine Audit — COMPLETE

## Goal
Audit and correct the layout calculation algorithm in `engine/layoutEngine.js` and related files.
Only geometry calculations are modified. No costing formulas, UI, SVG renderer, or summary panel changes.

---

## Bugs Found & Fixed

### BUG 1: Margins not subtracted from piece before counting tags
**Before:** Tags counted from full piece dimensions. First tag row starts at piece edge, inside the margin.
**After:** `usableL = pieceL - 2*marginIn`, tags counted from usable area only.

### BUG 2: Cutting overlap disabled by gutter strategies
**Before:** NO_GUTTERS strategy forced overlap to 0, producing impossible layouts (24 instead of 20).
**After:** Overlap always applied. Gutter strategies disabled (retained for future use).

### BUG 3: Leftover computed from piece, not usable area
**Before:** Leftover included margin area, inflating reported waste.
**After:** `leftoverL = usableL - tagsRows * tagCutL`.

### BUG 4: Invalid gutter strategies
**Before:** NO_HORIZONTAL/VERTICAL_GUTTER and NO_GUTTERS enabled.
**After:** Disabled with `enabled: false` and `disabledReason`. Architecture preserved for future re-enablement.

---

## Test Case: 24 tags per piece?

**Answer: NO.** 24 is NOT physically possible.

Fixed algorithm:
```
usableL = 12.5 - 2*0.197 = 12.106"
usableW = 18.0 - 2*0.197 = 17.606"
tagCutL = 2 + 2*0.079 = 2.157"
tagCutW = 4 + 2*0.079 = 4.157"
rows = floor(12.106 / 2.157) = 5
cols = floor(17.606 / 4.157) = 4
tags per piece = 5 x 4 = 20
```

---

## Files Modified

| File | Change |
|------|--------|
| `engine/layoutEngine.js` | Core fix: usable area, overlap always applied, geometry validation |
| `engine/layoutStrategies.js` | Added `enabled` flag, disabled 3 invalid strategies |
| `engine/optimizer.js` | Filter strategies by `enabled !== false` |
| `index.html` | Added `layoutValidation.js` and `layoutRegressionTests.js` script tags; dev debug panel |

## Files Created

| File | Purpose |
|------|---------|
| `engine/layoutValidation.js` | Geometry validation layer — verifies tags fit in usable area, margins respected, counts correct |
| `engine/layoutRegressionTests.js` | 12 regression tests covering edge cases. Run via `runLayoutTests()` in console |
| `plans/layout-engine-audit.md` | This plan document |

## Files NOT Modified

| File | Reason |
|------|--------|
| `engine/costingEngine.js` | Costing formulas — out of scope |
| `engine/wasteEngine.js` | Piece-level waste — unaffected |
| `engine/layoutScore.js` | Scoring — fields still present, logic unchanged |
| `engine/wasteRecovery.js` | Waste analysis — fields still present |
| `engine/rulesEngine.js` | Validation rules — still present |
| `styles.css` | Only debug panel CSS added (hidden by default) |
| SVG renderer (LayoutPreview JSX) | Out of scope per constraints |

---

## Self-Review Checklist

- [x] Every tag fits inside the usable area (margin subtracted first, floor division)
- [x] Margins are respected (usableL/usableW = piece - 2*marginIn)
- [x] SVG count matches calculated values (dTR*dTC = tagsRows*tagsCols)
- [x] Counts are mathematically correct (test case: 5x4=20, not 24)
- [x] No existing costing logic changed
- [x] Overlap applied exactly once (always tagL + 2*overlapIn, never 0)
- [x] Geometry validation layer runs on every createLayout call
- [x] 12 regression tests verify multiple known layouts
- [x] Dev debug panel hidden by default (enable: `window.__LAYOUT_DEBUG__ = true`)
- [x] Disabled strategies retained for future re-enablement
