function lpFmt(value) {
  var n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return n % 1 === 0 ? String(n) : n.toFixed(2);
}

function lpPunchPoint(x, y, w, h, pad) {
  pad = pad || 8;
  if (w <= h) {
    return { cx: x + w / 2, cy: y + pad, edge: "top" };
  }
  return { cx: x + pad, cy: y + h / 2, edge: "left" };
}

function lpFitBox(naturalW, naturalH, maxW, maxH) {
  var w = Math.max(1, Number(naturalW) || 1);
  var h = Math.max(1, Number(naturalH) || 1);
  var scale = Math.min(maxW / w, maxH / h);
  return { w: w * scale, h: h * scale };
}

function LpTab(props) {
  return (
    <button
      type="button"
      className={"lp-tab" + (props.active ? " lp-tab-active" : "")}
      onClick={props.onClick}
    >
      {props.children}
    </button>
  );
}

function LpSheetView(props) {
  var x = props.x, y = props.y, w = props.w, h = props.h;
  var sheet = props.sheet, totalSheets = props.totalSheets, wastePct = props.wastePct;
  var cols = Math.max(1, Number(props.piecesAcross) || 1);
  var rows = Math.max(1, Number(props.piecesDown) || 1);
  var cellW = w / cols;
  var cellH = h / rows;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#2a2a2a" strokeWidth="2" />
      {Array.from({ length: cols - 1 }).map(function(_, i) {
        return (
          <line key={"sv-" + i} x1={x + cellW * (i + 1)} y1={y} x2={x + cellW * (i + 1)} y2={y + h} stroke="#333" strokeWidth="2" />
        );
      })}
      {Array.from({ length: rows - 1 }).map(function(_, i) {
        return (
          <line key={"sh-" + i} x1={x} y1={y + cellH * (i + 1)} x2={x + w} y2={y + cellH * (i + 1)} stroke="#333" strokeWidth="2" />
        );
      })}
      <text x={x + w / 2} y={y - 16} textAnchor="middle" fontSize="18" fontWeight="700" fill="#2f5f93">
        {lpFmt(sheet.L)}"
      </text>
      <text x={x + w + 18} y={y + h / 2} transform={"rotate(90 " + (x + w + 18) + " " + (y + h / 2) + ")"} textAnchor="middle" fontSize="18" fontWeight="700" fill="#2f5f93">
        {lpFmt(sheet.W)}"
      </text>
      <rect x={x + w - 285} y={y + 28} width="255" height="120" rx="12" fill="rgba(180,74,42,0.06)" />
      <text x={x + w - 158} y={y + 73} textAnchor="middle" fontSize="30" fontWeight="800" fill="#111">
        {totalSheets ? totalSheets + " SHEETS" : "LAYOUT"}
      </text>
      <text x={x + 28} y={y + h + 40} fontSize="14" fill="#6b5c45">
        Waste: {wastePct.toFixed(1)}%
      </text>
      <text x={x + 28} y={y + h + 62} fontSize="14" fill="#6b5c45">
        Pieces: {cols * rows}
      </text>
    </g>
  );
}

function LpPieceView(props) {
  var x = props.x, y = props.y, w = props.w, h = props.h;
  var piece = props.piece, overlap = props.overlap, margin = props.margin;
  var feedDirection = props.feedDirection;
  var cols = Math.max(1, Number(props.tagsAcross) || 1);
  var rows = Math.max(1, Number(props.tagsDown) || 1);

  var outerPad = 8, bleedPad = 14, safePad = 16, gridGap = 8;
  var sheetX = x + outerPad, sheetY = y + outerPad;
  var sheetW = w - outerPad * 2, sheetH = h - outerPad * 2;
  var bleedX = sheetX + bleedPad, bleedY = sheetY + bleedPad;
  var bleedW = sheetW - bleedPad * 2, bleedH = sheetH - bleedPad * 2;
  var safeX = bleedX + safePad, safeY = bleedY + safePad;
  var safeW = bleedW - safePad * 2, safeH = bleedH - safePad * 2;
  var cellW = (safeW - gridGap * (cols - 1)) / cols;
  var cellH = (safeH - gridGap * (rows - 1)) / rows;

  return (
    <g>
      <rect x={sheetX} y={sheetY} width={sheetW} height={sheetH} fill="#ff9b9b" stroke="#c56a6a" strokeWidth="1.6" />
      <rect x={bleedX} y={bleedY} width={bleedW} height={bleedH} fill="#fff2a8" stroke="#c7b56b" strokeWidth="1.2" />
      <rect x={safeX} y={safeY} width={safeW} height={safeH} fill="#fff8df" stroke="#b9aa89" strokeWidth="1.2" />
      <line x1={sheetX} y1={sheetY - 24} x2={sheetX + sheetW} y2={sheetY - 24} stroke="#2f5f93" strokeWidth="1.8" markerStart="url(#lp-arrow)" markerEnd="url(#lp-arrow)" />
      <text x={sheetX + sheetW / 2} y={sheetY - 30} textAnchor="middle" fontSize="18" fontWeight="800" fill="#2f5f93">
        {lpFmt(piece.L)}"
      </text>
      <line x1={sheetX + sheetW + 24} y1={sheetY} x2={sheetX + sheetW + 24} y2={sheetY + sheetH} stroke="#2f5f93" strokeWidth="1.8" markerStart="url(#lp-arrow)" markerEnd="url(#lp-arrow)" />
      <text x={sheetX + sheetW + 30} y={sheetY + sheetH / 2} transform={"rotate(90 " + (sheetX + sheetW + 30) + " " + (sheetY + sheetH / 2) + ")"} textAnchor="middle" fontSize="18" fontWeight="800" fill="#2f5f93">
        {lpFmt(piece.W)}"
      </text>
      {Array.from({ length: rows }).map(function(_, row) {
        return Array.from({ length: cols }).map(function(_, col) {
          var gx = safeX + col * (cellW + gridGap);
          var gy = safeY + row * (cellH + gridGap);
          var punch = lpPunchPoint(gx, gy, cellW, cellH, 8);
          return (
            <g key={"tag-" + row + "-" + col}>
              <rect x={gx} y={gy} width={cellW} height={cellH} rx="2" fill="#bcefb6" stroke="#516b48" strokeWidth="1.2" />
              <circle cx={punch.cx} cy={punch.cy} r="4.5" fill="#fff2a8" stroke="#516b48" strokeWidth="1.1" />
            </g>
          );
        });
      })}
      <text x={sheetX + 10} y={sheetY - 6} fontSize="16" fill="#2f5f93" fontWeight="700">
        Piece {lpFmt(piece.L)}" x {lpFmt(piece.W)}"
      </text>
      <text x={safeX + safeW / 2} y={safeY + safeH / 2 + 10} textAnchor="middle" fontSize="30" fontWeight="900" fill="#111">
        {cols * rows} TAGS
      </text>
      <text x={sheetX + 12} y={sheetY + sheetH + 26} fontSize="13" fill="#6b5c45">
        Tags/Piece: {cols * rows}
      </text>
      <text x={sheetX + 12} y={sheetY + sheetH + 46} fontSize="13" fill="#6b5c45">
        Overlap: {lpFmt(overlap)}" | Margin: {lpFmt(margin)}"
      </text>
      <text x={sheetX + 12} y={sheetY + sheetH + 66} fontSize="13" fill="#6b5c45">
        Feed: {feedDirection}
      </text>
    </g>
  );
}

function LpTagView(props) {
  var x = props.x, y = props.y, w = props.w, h = props.h;
  var tag = props.tag, overlap = props.overlap, margin = props.margin;
  var punch = lpPunchPoint(x, y, w, h, 10);

  return (
    <g>
      <rect x={x} y={y} width={w} height={h} fill="#fff" stroke="#2a2a2a" strokeWidth="2.2" />
      <rect x={x + 14} y={y + 14} width={w - 28} height={h - 28} fill="none" stroke="#b44a2a" strokeDasharray="8 6" strokeWidth="2" opacity="0.85" />
      <circle cx={punch.cx} cy={punch.cy} r="6.5" fill="#fff" stroke="#2a2a2a" strokeWidth="1.5" />
      <text x={x + 18} y={y - 12} fontSize="16" fill="#2f5f93" fontWeight="700">
        Tag {lpFmt(tag.L)}" x {lpFmt(tag.W)}"
      </text>
      <text x={x + w / 2} y={y + h / 2 - 20} textAnchor="middle" fontSize="22" fontWeight="800" fill="#111">
        FINISHED LOOK
      </text>
      <text x={x + w / 2} y={y + h / 2 + 10} textAnchor="middle" fontSize="14" fill="#6b5c45">
        Cut: {lpFmt(tag.L + overlap * 2)}" x {lpFmt(tag.W + overlap * 2)}"
      </text>
      <text x={x + w / 2} y={y + h / 2 + 34} textAnchor="middle" fontSize="14" fill="#6b5c45">
        Safe margin: {lpFmt(margin)}"
      </text>
      <line x1={x + 24} y1={y + h - 38} x2={x + w - 24} y2={y + h - 38} stroke="#b44a2a" strokeWidth="2" />
      <text x={x + w / 2} y={y + h - 14} textAnchor="middle" fontSize="13" fill="#6b5c45">
        Punch / Short side reference
      </text>
    </g>
  );
}

function LayoutPreview(props) {
  var sheetLength = props.sheetLength, sheetWidth = props.sheetWidth;
  var pieceLength = props.pieceLength, pieceWidth = props.pieceWidth;
  var tagLength = props.tagLength, tagWidth = props.tagWidth;
  var overlap = props.overlap || 0, margin = props.margin || 0;
  var orientation = props.orientation || "portrait";
  var totalSheets = props.totalSheets, quantity = props.quantity;
  var feedDirection = props.feedDirection || "left-to-right";
  var title = props.title || "Layout Preview";

  var lpView_state = React.useState("piece");
  var lpView = lpView_state[0], setLpView = lpView_state[1];

  var lpSheet = React.useMemo(function() {
    return { L: Number(sheetLength) || 0, W: Number(sheetWidth) || 0 };
  }, [sheetLength, sheetWidth]);

  var lpPiece = React.useMemo(function() {
    return { L: Number(pieceLength) || 0, W: Number(pieceWidth) || 0 };
  }, [pieceLength, pieceWidth]);

  var lpTag = React.useMemo(function() {
    return { L: Number(tagLength) || 0, W: Number(tagWidth) || 0 };
  }, [tagLength, tagWidth]);

  var lpPAcross = Math.max(1, Number(props.piecesAcross) || 1);
  var lpPDown = Math.max(1, Number(props.piecesDown) || 1);
  var lpTAcross = Math.max(1, Number(props.tagsAcross) || 1);
  var lpTDown = Math.max(1, Number(props.tagsDown) || 1);

  var lpWastePct = React.useMemo(function() {
    return computeWaste(lpSheet.L, lpSheet.W, lpPiece.L, lpPiece.W, lpPAcross, lpPDown);
  }, [lpSheet.L, lpSheet.W, lpPiece.L, lpPiece.W, lpPAcross, lpPDown]);

  var lpStats = React.useMemo(function() {
    return [
      { label: "Sheet", value: lpFmt(lpSheet.L) + " x " + lpFmt(lpSheet.W) + "\"" },
      { label: "Piece", value: lpFmt(lpPiece.L) + " x " + lpFmt(lpPiece.W) + "\"" },
      { label: "Tag", value: lpFmt(lpTag.L) + " x " + lpFmt(lpTag.W) + "\"" },
      { label: "Pieces/Sheet", value: String(lpPAcross * lpPDown) },
      { label: "Tags/Piece", value: String(lpTAcross * lpTDown) },
      { label: "Waste", value: lpWastePct.toFixed(1) + "%" },
      { label: "Orientation", value: orientation },
      { label: "Feed", value: feedDirection },
      { label: "Quantity", value: quantity ? String(quantity) : "\u2014" },
      { label: "Total Sheets", value: totalSheets ? String(totalSheets) : "\u2014" },
    ];
  }, [lpSheet.L, lpSheet.W, lpPiece.L, lpPiece.W, lpTag.L, lpTag.W, lpPAcross, lpPDown, lpTAcross, lpTDown, lpWastePct, orientation, feedDirection, quantity, totalSheets]);

  var lpSheetBox = lpFitBox(lpSheet.L || 1, lpSheet.W || 1, 760, 700);
  var lpPieceBox = lpFitBox(lpPiece.L || 1, lpPiece.W || 1, 760, 650);
  var lpTagBox = lpFitBox(lpTag.L || 1, lpTag.W || 1, 520, 340);

  return (
    <div className="lp-shell">
      <div className="lp-topbar">
        <div>
          <div className="lp-eyebrow">{title}</div>
          <div className="lp-sub">
            {quantity ? quantity + " tags" : "Live layout visualization"}
          </div>
        </div>
        <div className="lp-tabs">
          <LpTab active={lpView === "sheet"} onClick={function() { setLpView("sheet"); }}>Sheet</LpTab>
          <LpTab active={lpView === "piece"} onClick={function() { setLpView("piece"); }}>Piece</LpTab>
          <LpTab active={lpView === "tag"} onClick={function() { setLpView("tag"); }}>Tag</LpTab>
        </div>
      </div>
      <div className="lp-grid">
        <div className="lp-preview-card">
          <svg viewBox="0 0 1200 820" className="lp-svg" role="img" aria-label="Layout preview">
            <defs>
              <marker id="lp-arrow" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">
                <path d="M0,0 L8,4 L0,8 z" fill="currentColor" />
              </marker>
              <pattern id="lp-dots" width="12" height="12" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="rgba(0,0,0,0.06)" />
              </pattern>
            </defs>
            <rect x="0" y="0" width="1200" height="820" fill="#fbf7ef" />
            <rect x="0" y="0" width="1200" height="820" fill="url(#lp-dots)" opacity="0.35" />
            {lpView === "sheet" && (
              <LpSheetView x={40 + (760 - lpSheetBox.w) / 2} y={70 + (700 - lpSheetBox.h) / 2} w={lpSheetBox.w} h={lpSheetBox.h} sheet={lpSheet} piecesAcross={lpPAcross} piecesDown={lpPDown} totalSheets={totalSheets} wastePct={lpWastePct} />
            )}
            {lpView === "piece" && (
              <LpPieceView x={52 + (760 - lpPieceBox.w) / 2} y={92 + (650 - lpPieceBox.h) / 2} w={lpPieceBox.w} h={lpPieceBox.h} piece={lpPiece} tagsAcross={lpTAcross} tagsDown={lpTDown} tag={lpTag} overlap={overlap} margin={margin} feedDirection={feedDirection} />
            )}
            {lpView === "tag" && (
              <LpTagView x={180 + (520 - lpTagBox.w) / 2} y={130 + (340 - lpTagBox.h) / 2} w={lpTagBox.w} h={lpTagBox.h} tag={lpTag} overlap={overlap} margin={margin} />
            )}
            <text x="40" y="30" fontSize="16" fill="#b44a2a" fontWeight="700" letterSpacing="2">
              PRODUCTION LAYOUT
            </text>
          </svg>
        </div>
        <div className="lp-info-card">
          <div className="lp-info-title">Layout details</div>
          <div className="lp-info-list">
            {lpStats.map(function(item) {
              return (
                <div className="lp-info-row" key={item.label}>
                  <div className="lp-info-label">{item.label}</div>
                  <div className="lp-info-value">{item.value}</div>
                </div>
              );
            })}
          </div>
          <div className="lp-note">
            Use the tabs to switch between the full sheet, a single piece, and an individual tag.
          </div>
        </div>
      </div>
    </div>
  );
}
