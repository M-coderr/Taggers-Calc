var CONFIG_KEY = "tag-costing-config";
var AGENTS_KEY = "tag-costing-agents";
var USERS_KEY = "tag-costing-users";
var SHEETS_KEY = "tag-costing-sheets";

var API_URL = "https://script.google.com/macros/s/AKfycbyQhMT5jnm0SgiCVD_PMpgX48N_owZGqMX7cW_9M__npBDCVDjwuT5e1WhlYgj_pfFd/exec";

function jsonpRequest(params) {
  return new Promise(function (resolve, reject) {
    if (!API_URL || API_URL.indexOf("PASTE_YOUR") === 0) {
      reject(new Error("API_URL not configured yet"));
      return;
    }
    var cbName = "tcCb_" + Date.now() + "_" + Math.floor(Math.random() * 1e6);
    var script = null;
    var timeout = null;
    function cleanup() {
      delete window[cbName];
      if (script && script.parentNode) script.parentNode.removeChild(script);
      clearTimeout(timeout);
    }
    timeout = setTimeout(function () { cleanup(); reject(new Error("Request timed out")); }, 15000);
    window[cbName] = function (data) { cleanup(); resolve(data); };
    var query = new URLSearchParams(Object.assign({}, params, { callback: cbName })).toString();
    script = document.createElement("script");
    script.src = API_URL + "?" + query;
    script.onerror = function () { cleanup(); reject(new Error("Network error reaching API")); };
    document.body.appendChild(script);
  });
}

var __tcCache = null;
var __tcCacheAt = 0;
async function fetchAllCached() {
  var now = Date.now();
  if (__tcCache && now - __tcCacheAt < 2000) return __tcCache;
  var result = await jsonpRequest({ action: "getAll" });
  if (!result.ok) throw new Error(result.error || "Failed to load data");
  __tcCache = result;
  __tcCacheAt = now;
  return result;
}

var KEY_TO_SAVE_ACTION = {};
KEY_TO_SAVE_ACTION[CONFIG_KEY] = "saveConfig";
KEY_TO_SAVE_ACTION[AGENTS_KEY] = "saveAgents";
KEY_TO_SAVE_ACTION[SHEETS_KEY] = "saveSheets";
KEY_TO_SAVE_ACTION[USERS_KEY] = "saveUsers";
var KEY_TO_RESULT_FIELD = {};
KEY_TO_RESULT_FIELD[CONFIG_KEY] = "config";
KEY_TO_RESULT_FIELD[AGENTS_KEY] = "agents";
KEY_TO_RESULT_FIELD[SHEETS_KEY] = "sheets";
KEY_TO_RESULT_FIELD[USERS_KEY] = "users";

window.storage = {
  get: async function (key) {
    var result = await fetchAllCached();
    var field = KEY_TO_RESULT_FIELD[key];
    if (!field) return null;
    return { key: key, value: JSON.stringify(result[field]), shared: true };
  },
  set: async function (key, value, shared, pin) {
    var action = KEY_TO_SAVE_ACTION[key];
    if (!action) return null;
    var result = await jsonpRequest({ action: action, payload: value, pin: pin || "" });
    if (!result.ok) throw new Error(result.error || "Save failed");
    __tcCache = null;
    return { key: key, value: value, shared: shared };
  },
};

var SESSION_KEY = "tagx-session";

function Icon(props) {
  return (
    <svg width={props.size || 18} height={props.size || 18} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: "inline-block", verticalAlign: "-3px" }}>
      {props.children}
    </svg>
  );
}

function LayoutPreview({ layout }) {

  if (!layout) return null;

  const scale = 20;

  const pieceWidth = layout.piece.width * scale;
  const pieceHeight = layout.piece.length * scale;

  return (

    <svg
      width={pieceWidth + 40}
      height={pieceHeight + 40}
    >

      <rect
        x="20"
        y="20"
        width={pieceWidth}
        height={pieceHeight}
        fill="#ffffff"
        stroke="#333"
        strokeWidth="2"
      />

    </svg>

  );

}

function LayoutSelector({ layouts, selectedIndex, onSelect }) {

  return (

    <div className="layout-selector">

      {layouts.map(function (layout, index) {

        return (

          <button

            key={layout.id}

            onClick={function () {

              onSelect(index);

            }}

          >

            {layout.strategy.name}

            {" - "}

            {layout.layout.total}

            {" Tags"}

          </button>

        );

      })}

    </div>

  );

}

function Scissors(p) { return <Icon {...p}><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><line x1="20" y1="4" x2="8.12" y2="15.88" /><line x1="14.47" y1="14.48" x2="20" y2="20" /><line x1="8.12" y1="8.12" x2="12" y2="12" /></Icon>; }
function Printer(p) { return <Icon {...p}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></Icon>; }
function Layers(p) { return <Icon {...p}><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></Icon>; }
function CircleDot(p) { return <Icon {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="1" /></Icon>; }
function Truck(p) { return <Icon {...p}><rect x="1" y="3" width="15" height="13" /><polygon points="16 8 20 8 23 11 23 16 16 16 16 8" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" /></Icon>; }
function Percent(p) { return <Icon {...p}><line x1="19" y1="5" x2="5" y2="19" /><circle cx="6.5" cy="6.5" r="2.5" /><circle cx="17.5" cy="17.5" r="2.5" /></Icon>; }
function ChevronDown(p) { return <Icon {...p}><polyline points="6 9 12 15 18 9" /></Icon>; }
function Info(p) { return <Icon {...p}><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></Icon>; }
function Lock(p) { return <Icon {...p}><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></Icon>; }
function Users(p) { return <Icon {...p}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>; }
function Plus(p) { return <Icon {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></Icon>; }
function Trash2(p) { return <Icon {...p}><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></Icon>; }
function Settings(p) { return <Icon {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>; }
function X(p) { return <Icon {...p}><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></Icon>; }

function Field(props) {
  return (
    <label className="tc-field">
      <span className="tc-field-label">{props.label}</span>
      {props.children}
      {props.hint && <span className="tc-field-hint">{props.hint}</span>}
    </label>
  );
}

function NumberInput(props) {
  return (
    <div className="tc-numwrap">
      <input type="number" className="tc-input" value={props.value} min={props.min || 0} step={props.step || "any"}
        onChange={function (e) { props.onChange(e.target.value === "" ? "" : Number(e.target.value)); }} />
      {props.suffix && <span className="tc-suffix">{props.suffix}</span>}
    </div>
  );
}

function Toggle(props) {
  return (
    <button type="button" className={"tc-toggle" + (props.checked ? " tc-toggle-on" : "")} onClick={function () { props.onChange(!props.checked); }}>
      <span className="tc-toggle-knob" />
      <span className="tc-toggle-text">{props.checked ? props.onLabel : props.offLabel}</span>
    </button>
  );
}

function LineItem(props) {
  return (
    <div className={"tc-line" + (props.muted ? " tc-line-muted" : "")}>
      <div className="tc-line-icon">{props.icon}</div>
      <div className="tc-line-text">
        <div className="tc-line-label">{props.label}</div>
        {props.sub && <div className="tc-line-sub">{props.sub}</div>}
      </div>
      <div className="tc-line-amount">{props.amount}</div>
    </div>
  );
}

function TagCostingCalculator() {
  var useState = React.useState, useMemo = React.useMemo, useEffect = React.useEffect, useRef = React.useRef;

  var session_state = useState(null);
  var session = session_state[0], setSession = session_state[1];
  var appPhase_state = useState("splash");
  var appPhase = appPhase_state[0], setAppPhase = appPhase_state[1];
  var storageReady_state = useState(false);
  var storageReady = storageReady_state[0], setStorageReady = storageReady_state[1];
  var storageAvailable_state = useState(true);
  var storageAvailable = storageAvailable_state[0], setStorageAvailable = storageAvailable_state[1];

  var loginUsername_state = useState("");
  var loginUsername = loginUsername_state[0], setLoginUsername = loginUsername_state[1];
  var loginPassword_state = useState("");
  var loginPassword = loginPassword_state[0], setLoginPassword = loginPassword_state[1];
  var loginError_state = useState("");
  var loginError = loginError_state[0], setLoginError = loginError_state[1];
  var loginLoading_state = useState(false);
  var loginLoading = loginLoading_state[0], setLoginLoading = loginLoading_state[1];

  var ownerPin_state = useState(DEFAULT_CONFIG.ownerPin);
  var ownerPin = ownerPin_state[0], setOwnerPin = ownerPin_state[1];
  var transport_state = useState(DEFAULT_CONFIG.transport);
  var transport = transport_state[0], setTransport = transport_state[1];
  var cuttingOverlapMM_state = useState(DEFAULT_CONFIG.cuttingOverlapMM);
  var cuttingOverlapMM = cuttingOverlapMM_state[0], setCuttingOverlapMM = cuttingOverlapMM_state[1];
  var insideMarginMM_state = useState(DEFAULT_CONFIG.insideMarginMM);
  var insideMarginMM = insideMarginMM_state[0], setInsideMarginMM = insideMarginMM_state[1];
  var feedOffsetL_state = useState(DEFAULT_CONFIG.feedOffsetL);
  var feedOffsetL = feedOffsetL_state[0], setFeedOffsetL = feedOffsetL_state[1];
  var feedOffsetW_state = useState(DEFAULT_CONFIG.feedOffsetW);
  var feedOffsetW = feedOffsetW_state[0], setFeedOffsetW = feedOffsetW_state[1];
  var feedHandL_state = useState(DEFAULT_CONFIG.feedHandL);
  var feedHandL = feedHandL_state[0], setFeedHandL = feedHandL_state[1];
  var feedHandW_state = useState(DEFAULT_CONFIG.feedHandW);
  var feedHandW = feedHandW_state[0], setFeedHandW = feedHandW_state[1];
  var overridePieces_state = useState(false);
  var overridePieces = overridePieces_state[0], setOverridePieces = overridePieces_state[1];
  var manualPiecesPerSheet_state = useState(1);
  var manualPiecesPerSheet = manualPiecesPerSheet_state[0], setManualPiecesPerSheet = manualPiecesPerSheet_state[1];
  var showAdvancedLayout_state = useState(false);
  var showAdvancedLayout = showAdvancedLayout_state[0], setShowAdvancedLayout = showAdvancedLayout_state[1];

  var marginPct_state = useState(45);
  var marginPct = marginPct_state[0], setMarginPct = marginPct_state[1];
  var marginMode_state = useState("markup");
  var marginMode = marginMode_state[0], setMarginMode = marginMode_state[1];

  var users_state = useState([]);
  var users = users_state[0], setUsers = users_state[1];
  var newAgentUsername_state = useState("");
  var newAgentUsername = newAgentUsername_state[0], setNewAgentUsername = newAgentUsername_state[1];
  var newAgentPassword_state = useState("");
  var newAgentPassword = newAgentPassword_state[0], setNewAgentPassword = newAgentPassword_state[1];
  var newAgentName_state = useState("");
  var newAgentName = newAgentName_state[0], setNewAgentName = newAgentName_state[1];
  var newAgentMargin_state = useState(30);
  var newAgentMargin = newAgentMargin_state[0], setNewAgentMargin = newAgentMargin_state[1];
  var agentFormError_state = useState("");
  var agentFormError = agentFormError_state[0], setAgentFormError = agentFormError_state[1];

  var sheetCatalogue_state = useState([]);
  var sheetCatalogue = sheetCatalogue_state[0], setSheetCatalogue = sheetCatalogue_state[1];
  var sheetsLoading_state = useState(true);
  var sheetsLoading = sheetsLoading_state[0], setSheetsLoading = sheetsLoading_state[1];
  var selectedSheetId_state = useState("");
  var selectedSheetId = selectedSheetId_state[0], setSelectedSheetId = selectedSheetId_state[1];
  var newSheetNumber_state = useState("");
  var newSheetNumber = newSheetNumber_state[0], setNewSheetNumber = newSheetNumber_state[1];
  var newSheetL_state = useState(PAPER_DEFAULTS.sheetL);
  var newSheetL = newSheetL_state[0], setNewSheetL = newSheetL_state[1];
  var newSheetW_state = useState(PAPER_DEFAULTS.sheetW);
  var newSheetW = newSheetW_state[0], setNewSheetW = newSheetW_state[1];
  var newSheetRate_state = useState(PAPER_DEFAULTS.sheetRate);
  var newSheetRate = newSheetRate_state[0], setNewSheetRate = newSheetRate_state[1];

  var sheetL_state = useState(PAPER_DEFAULTS.sheetL);
  var sheetL = sheetL_state[0], setSheetL = sheetL_state[1];
  var sheetW_state = useState(PAPER_DEFAULTS.sheetW);
  var sheetW = sheetW_state[0], setSheetW = sheetW_state[1];
  var sheetRate_state = useState(PAPER_DEFAULTS.sheetRate);
  var sheetRate = sheetRate_state[0], setSheetRate = sheetRate_state[1];
  var tagL_state = useState(2);
  var tagL = tagL_state[0], setTagL = tagL_state[1];
  var tagW_state = useState(4);
  var tagW = tagW_state[0], setTagW = tagW_state[1];
  var orderQty_state = useState(5000);
  var orderQty = orderQty_state[0], setOrderQty = orderQty_state[1];
  var printMethod_state = useState("offset");
  var printMethod = printMethod_state[0], setPrintMethod = printMethod_state[1];
  var colors_state = useState(1);
  var colors = colors_state[0], setColors = colors_state[1];
  var lamination_state = useState(true);
  var lamination = lamination_state[0], setLamination = lamination_state[1];

  var showAssumptions_state = useState(false);
  var showAssumptions = showAssumptions_state[0], setShowAssumptions = showAssumptions_state[1];
  var showLayoutPreview_state = useState(false);
  var showLayoutPreview = showLayoutPreview_state[0], setShowLayoutPreview = showLayoutPreview_state[1];
  var ownerView_state = useState("calculator");
  var ownerView = ownerView_state[0], setOwnerView = ownerView_state[1];

  const [layoutResult, setLayoutResult] = useState(null);
  const [selectedLayoutIndex, setSelectedLayoutIndex] = useState(0);

  var saveTimer = useRef(null);
  var isOwner = session && session.role === "OWNER";

  useEffect(function () {
    (async function () {
      try {
        var stored = localStorage.getItem(SESSION_KEY);
        if (stored) {
          var parsed = JSON.parse(stored);
          if (parsed && parsed.username && parsed.role) setSession(parsed);
        }
      } catch (e) { }
      try {
        var cfgRes = await window.storage.get(CONFIG_KEY, true);
        if (cfgRes && cfgRes.value) {
          var cfg = JSON.parse(cfgRes.value);
          if (cfg.ownerPin) setOwnerPin(String(cfg.ownerPin).trim());
          if (cfg.transport != null) setTransport(Number(cfg.transport) || 0);
          if (cfg.cuttingOverlapMM != null) setCuttingOverlapMM(Number(cfg.cuttingOverlapMM) || 0);
          if (cfg.insideMarginMM != null) setInsideMarginMM(Number(cfg.insideMarginMM) || 0);
          if (cfg.feedOffsetL != null) setFeedOffsetL(Number(cfg.feedOffsetL) || 0);
          if (cfg.feedOffsetW != null) setFeedOffsetW(Number(cfg.feedOffsetW) || 0);
          if (cfg.feedHandL != null) setFeedHandL(Number(cfg.feedHandL) || 0);
          if (cfg.feedHandW != null) setFeedHandW(Number(cfg.feedHandW) || 0);
        }
      } catch (e) { }
      try {
        var usRes = await window.storage.get(USERS_KEY, true);
        if (usRes && usRes.value) {
          var list = JSON.parse(usRes.value);
          if (Array.isArray(list)) setUsers(list.map(function (u) { return Object.assign({}, u, { margin: Number(u.margin) || 0 }); }));
        }
      } catch (e) { }
      async function loadSheets(retries) {
        for (var attempt = 0; attempt <= retries; attempt++) {
          try {
            if (attempt > 0) await new Promise(function (r) { setTimeout(r, 500 * attempt); });
            var shRes = await window.storage.get(SHEETS_KEY, true);
            if (shRes && shRes.value) {
              var list = JSON.parse(shRes.value);
              if (Array.isArray(list) && list.length > 0) {
                setSheetCatalogue(list.map(function (s) { return Object.assign({}, s, { l: Number(s.l), w: Number(s.w), rate: Number(s.rate) }); }));
                return;
              }
            }
          } catch (e) { }
        }
      }
      try { await loadSheets(2); } catch (e) { }
      setSheetsLoading(false);
      setStorageReady(true);
      var stored2 = localStorage.getItem(SESSION_KEY);
      if (stored2) {
        try {
          var parsed2 = JSON.parse(stored2);
          if (parsed2 && parsed2.username && parsed2.role) { setAppPhase("dashboard"); return; }
        } catch (e) { }
      }
      setAppPhase("login");
    })();
  }, []);

  useEffect(function () {
    if (!session || session.role !== "AGENT") return;
    var poll = setInterval(async function () {
      try {
        var shRes = await window.storage.get(SHEETS_KEY, true);
        if (shRes && shRes.value) {
          var list = JSON.parse(shRes.value);
          if (Array.isArray(list)) setSheetCatalogue(list);
        }
        var usRes = await window.storage.get(USERS_KEY, true);
        if (usRes && usRes.value) {
          var list2 = JSON.parse(usRes.value);
          if (Array.isArray(list2)) setUsers(list2.map(function (u) { return Object.assign({}, u, { margin: Number(u.margin) || 0 }); }));
        }
      } catch (e) { }
    }, 20000);
    return function () { clearInterval(poll); };
  }, [session]);

  useEffect(function () {
    if (!storageReady || !storageAvailable) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async function () {
      try {
        var cfg = { ownerPin: ownerPin, transport: transport, cuttingOverlapMM: cuttingOverlapMM, insideMarginMM: insideMarginMM, feedOffsetL: feedOffsetL, feedOffsetW: feedOffsetW, feedHandL: feedHandL, feedHandW: feedHandW };
        await window.storage.set(CONFIG_KEY, JSON.stringify(cfg), true, ownerPin);
      } catch (e) { setStorageAvailable(false); }
    }, 700);
    return function () { clearTimeout(saveTimer.current); };
  }, [storageReady, ownerPin, transport, cuttingOverlapMM, insideMarginMM, feedOffsetL, feedOffsetW, feedHandL, feedHandW]);

  async function persistSheets(list) {
    setSheetCatalogue(list);
    try { await window.storage.set(SHEETS_KEY, JSON.stringify(list), true, ownerPin); } catch (e) { setStorageAvailable(false); }
  }
  function addSheet() {
    var number = newSheetNumber.trim();
    if (!number) return;
    var id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    persistSheets(sheetCatalogue.concat([{ id: id, number: number, l: Number(newSheetL) || 0, w: Number(newSheetW) || 0, rate: Number(newSheetRate) || 0 }]));
    setNewSheetNumber(""); setNewSheetL(PAPER_DEFAULTS.sheetL); setNewSheetW(PAPER_DEFAULTS.sheetW); setNewSheetRate(PAPER_DEFAULTS.sheetRate);
  }
  function removeSheet(id) { persistSheets(sheetCatalogue.filter(function (s) { return s.id !== id; })); if (selectedSheetId === id) setSelectedSheetId(""); }
  function updateSheetField(id, field, value) { persistSheets(sheetCatalogue.map(function (s) { return s.id === id ? Object.assign({}, s, Object.defineProperty({}, field, { value: value, enumerable: true })) : s; })); }

  async function persistUsers(list) {
    setUsers(list);
    try { await window.storage.set(USERS_KEY, JSON.stringify(list), true, ownerPin); } catch (e) { setStorageAvailable(false); }
  }
  function addAgent() {
    var username = newAgentUsername.trim(), name = newAgentName.trim();
    if (!username || !name) { setAgentFormError("Username and name are required."); return; }
    if (users.some(function (u) { return String(u.username || "").toLowerCase() === username.toLowerCase(); })) { setAgentFormError("That username already exists."); return; }
    setAgentFormError("");
    persistUsers(users.concat([{ username: username, password: newAgentPassword || "", role: "AGENT", name: name, margin: Number(newAgentMargin) || 0 }]));
    setNewAgentUsername(""); setNewAgentPassword(""); setNewAgentName(""); setNewAgentMargin(30);
  }
  function removeAgent(username) { persistUsers(users.filter(function (u) { return u.username !== username; })); }
  function updateAgentField(username, field, value) { persistUsers(users.map(function (u) { return u.username === username ? Object.assign({}, u, Object.defineProperty({}, field, { value: value, enumerable: true })) : u; })); }

  async function handleLogin() {
    var username = loginUsername.trim(), password = loginPassword.trim();
    if (!username || !password) { setLoginError("Please enter username and password"); return; }
    setLoginLoading(true); setLoginError("");
    var lowerUser = username.toLowerCase();
    try {
      var result = null;
      try {
        result = await jsonpRequest({ action: "login", username: lowerUser, password: password });
      } catch (err) {}

      if (!result || !result.ok) {
        try {
          result = await jsonpRequest({ action: "login", username: username, password: password });
        } catch (err) {}
      }

      if (!result || !result.ok) {
        var localUsers = (users && users.length > 0) ? users : [];
        if (localUsers.length === 0) {
          try {
            var cachedData = await fetchAllCached();
            if (cachedData && cachedData.users) localUsers = cachedData.users;
          } catch(e2) {}
        }
        var found = localUsers.find(function(u) {
          var uUsername = String(u.username || "").trim().toLowerCase();
          var uName = String(u.name || "").trim().toLowerCase();
          var matchUser = (uUsername === lowerUser || uName === lowerUser);
          var matchPass = String(u.password || "").trim() === password;
          return matchUser && matchPass;
        });
        if (found) {
          result = { ok: true, user: found };
        }
      }

      if (!result || !result.ok) {
        throw new Error((result && result.error) || "Invalid username or password");
      }

      var user = result.user;
      var sessionData = { username: user.username, role: user.role, name: user.name, margin: user.margin };
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionData));
      setSession(sessionData); setAppPhase("dashboard");
    } catch (e) {
      setLoginError(e.message || "Login failed. Check your credentials.");
    } finally {
      setLoginLoading(false);
    }
  }
  function handleLogout() { localStorage.removeItem(SESSION_KEY); setSession(null); setLoginUsername(""); setLoginPassword(""); setLoginError(""); setAppPhase("login"); }

  var effectiveMarginPct = isOwner ? marginPct : (session && session.margin != null ? session.margin : 0);
  var effectiveMarginMode = isOwner ? marginMode : "markup";
  var selectedSheet = sheetCatalogue.find(function (s) { return String(s.id) === String(selectedSheetId); });
  useEffect(function () {
    if (!isOwner && selectedSheet) { setSheetL(Number(selectedSheet.l)); setSheetW(Number(selectedSheet.w)); setSheetRate(Number(selectedSheet.rate)); }
  }, [isOwner, selectedSheetId]);

  var calc = useMemo(function () {
    var feed = printMethod === "offset" ? [feedOffsetL, feedOffsetW] : [feedHandL, feedHandW];
    var overlapIn = mm2in(cuttingOverlapMM);
    var marginIn = mm2in(insideMarginMM);
    var layoutResult = optimizeOrientation(sheetL, sheetW, tagL, tagW, feed, overlapIn, marginIn, printMethod === "hand");
    var layout = layoutResult && layoutResult.best ? layoutResult.best : layoutResult;
    var wastageExtra = Math.floor(orderQty / 5000) * 200;
    var productionQty = orderQty + wastageExtra;

    return computeCosts(layout, {
      sheetRate: sheetRate, orderQty: orderQty, productionQty: productionQty, printMethod: printMethod, colors: colors,
      lamination: lamination, transport: transport, overridePieces: overridePieces,
      manualPiecesPerSheet: manualPiecesPerSheet, effectiveMarginPct: effectiveMarginPct,
      effectiveMarginMode: effectiveMarginMode, overlapIn: overlapIn, marginIn: marginIn,
      feedOffsetL: feedOffsetL, feedOffsetW: feedOffsetW, feedHandL: feedHandL, feedHandW: feedHandW,
    });
  }, [sheetL, sheetW, sheetRate, tagL, tagW, cuttingOverlapMM, insideMarginMM, feedOffsetL, feedOffsetW, feedHandL, feedHandW, overridePieces, manualPiecesPerSheet, orderQty, printMethod, colors, lamination, transport, effectiveMarginPct, effectiveMarginMode]);

  return (
    <div className="tc-root">
      {appPhase === "splash" && (<div className="tc-splash"><div className="tc-splash-spinner" /><div className="tc-splash-text">Loading...</div></div>)}

      {appPhase === "login" && (
        <div className="tc-login-wrap">
          <div className="tc-login-card">
            <div className="tc-login-title">Tag <span>Costing</span></div>
            <div className="tc-login-sub">Sign in to continue</div>
            <div className="tc-login-field"><label>Username</label><input type="text" placeholder="Enter your username" value={loginUsername} onChange={function (e) { setLoginUsername(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") handleLogin(); }} autoFocus /></div>
            <div className="tc-login-field"><label>Password</label><input type="password" placeholder="Enter your password" value={loginPassword} onChange={function (e) { setLoginPassword(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") handleLogin(); }} /></div>
            {loginError && <div className="tc-login-error">{loginError}</div>}
            <button className="tc-login-btn" onClick={handleLogin} disabled={loginLoading}>{loginLoading ? "Signing in..." : "Sign In"}</button>
          </div>
        </div>
      )}

      {appPhase === "dashboard" && (<>
        <div className="tc-header">
          <div><div className="tc-eyebrow">Job Costing - Tag Manufacturing</div><h1 className="tc-title">Tag <span>Costing</span> Ticket</h1></div>
          <div className="tc-sub">{isOwner ? "Full breakdown & business settings." : "Enter the job details to get your price."}</div>
        </div>
        <div className="tc-dashboard-menu">
          <div className="tc-dashboard-menu-left">
            <span className="tc-user-badge"><Users /> {session.name}</span>
            {isOwner && (<>
              <button className={"tc-dash-btn" + (ownerView === "calculator" ? " tc-dash-btn-active" : "")} onClick={function () { setOwnerView("calculator"); }}><Layers /> Calculator</button>
              <button className={"tc-dash-btn" + (ownerView === "sheets" ? " tc-dash-btn-active" : "")} onClick={function () { setOwnerView("sheets"); }}><Layers /> Sheet Catalogue</button>
              <button className={"tc-dash-btn" + (ownerView === "agents" ? " tc-dash-btn-active" : "")} onClick={function () { setOwnerView("agents"); }}><Users /> Manage Agents</button>
            </>)}
            {!isOwner && (<>
              <button className="tc-dash-btn tc-dash-btn-active"><Percent /> New Quote</button>
              <button className="tc-dash-btn"><Info /> Quote History</button>
            </>)}
          </div>
          <div className="tc-dashboard-menu-right">
            <button className="tc-dash-btn tc-dash-btn-logout" onClick={handleLogout}><X /> Logout</button>
          </div>
        </div>
        <div className={"tc-grid" + (isOwner && ownerView !== "calculator" ? " tc-grid-single" : "")}>
          <div className="tc-ticket">
            {isOwner && ownerView === "sheets" && (<>
              <div className="tc-section-title"><Layers /> Sheet catalogue</div>
              <div className="tc-field-hint" style={{ marginBottom: 10 }}>Agents pick a sheet by number only - size and rate are pulled from here automatically.</div>
              {sheetCatalogue.length === 0 && <div className="tc-agent-empty">No sheets yet - add one below.</div>}
              {sheetCatalogue.map(function (s) {
                return (
                  <div className="tc-agent-row" key={s.id}>
                    <span className="tc-agent-row-name">{s.number}</span>
                    <input type="number" value={s.l} onChange={function (e) { updateSheetField(s.id, "l", Number(e.target.value)); }} title="Length (in)" />
                    <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>x</span>
                    <input type="number" value={s.w} onChange={function (e) { updateSheetField(s.id, "w", Number(e.target.value)); }} title="Width (in)" />
                    <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>@Rs</span>
                    <input type="number" value={s.rate} onChange={function (e) { updateSheetField(s.id, "rate", Number(e.target.value)); }} title="Rate per sheet" />
                    <button className="tc-agent-del" onClick={function () { removeSheet(s.id); }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
              <div className="tc-agent-add-row">
                <input type="text" placeholder="Sheet number" value={newSheetNumber} onChange={function (e) { setNewSheetNumber(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") addSheet(); }} />
                <input type="number" placeholder="L" value={newSheetL} onChange={function (e) { setNewSheetL(e.target.value); }} />
                <input type="number" placeholder="W" value={newSheetW} onChange={function (e) { setNewSheetW(e.target.value); }} />
                <input type="number" placeholder="Rs/sheet" value={newSheetRate} onChange={function (e) { setNewSheetRate(e.target.value); }} />
                <button className="tc-add-btn" onClick={addSheet}><Plus size={14} /> Add</button>
              </div>
            </>)}
            {isOwner && ownerView === "agents" && (<>
              <div className="tc-section-title"><Users /> Agents & their margins</div>
              <div className="tc-field-hint" style={{ marginBottom: 10 }}>Pulled from the Users sheet. Each agent gets their own margin, applied silently - they log in with the username/password here and never see the % or the cost breakdown.</div>
              {users.filter(function (u) { return u.role === "AGENT"; }).length === 0 && <div className="tc-agent-empty">No agents yet - add one below.</div>}
              {users.filter(function (u) { return u.role === "AGENT"; }).map(function (u) {
                return (
                  <div className="tc-agent-row" key={u.username}>
                    <span className="tc-agent-row-name">{u.name} <span style={{ opacity: 0.6, fontWeight: 400 }}>({u.username})</span></span>
                    <input type="text" value={u.password} onChange={function (e) { updateAgentField(u.username, "password", e.target.value); }} title="Password" style={{ width: 90 }} />
                    <input type="number" value={u.margin} onChange={function (e) { updateAgentField(u.username, "margin", Number(e.target.value)); }} title="Margin %" />
                    <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>%</span>
                    <button className="tc-agent-del" onClick={function () { removeAgent(u.username); }}><Trash2 size={14} /></button>
                  </div>
                );
              })}
              {agentFormError && <div className="tc-field-hint" style={{ color: "var(--stamp)", marginTop: 6 }}>{agentFormError}</div>}
              <div className="tc-agent-add-row">
                <input type="text" placeholder="Username" value={newAgentUsername} onChange={function (e) { setNewAgentUsername(e.target.value); }} />
                <input type="text" placeholder="Password" value={newAgentPassword} onChange={function (e) { setNewAgentPassword(e.target.value); }} />
                <input type="text" placeholder="Agent name" value={newAgentName} onChange={function (e) { setNewAgentName(e.target.value); }} onKeyDown={function (e) { if (e.key === "Enter") addAgent(); }} />
                <input type="number" placeholder="%" value={newAgentMargin} onChange={function (e) { setNewAgentMargin(e.target.value); }} />
                <button className="tc-add-btn" onClick={addAgent}><Plus size={14} /> Add</button>
              </div>
            </>)}
            {(ownerView !== "sheets" && ownerView !== "agents") || !isOwner ? (<>
              <div className="tc-section-title"><Layers /> Sheet & material</div>
              {isOwner ? (<>
                {sheetsLoading ? (
                  <div className="tc-field-hint" style={{ marginTop: 10, fontStyle: "italic" }}>Loading catalogue...</div>
                ) : sheetCatalogue.length > 0 ? (
                  <Field label="Load from catalogue (optional)" hint="Fills the fields below - still editable after">
                    <select className="tc-agent-select" defaultValue="" onChange={function (e) { var val = e.target.value; if (!val) return; var s = sheetCatalogue.find(function (x) { return String(x.id) === String(val); }); if (s) { setSheetL(Number(s.l)); setSheetW(Number(s.w)); setSheetRate(Number(s.rate)); } }}>
                      <option value="">Select a catalogue sheet...</option>
                      {sheetCatalogue.map(function (s) { return <option key={s.id} value={s.id}>{s.number}</option>; })}
                    </select>
                  </Field>
                ) : (
                  <div className="tc-field-hint" style={{ marginTop: 10, fontStyle: "italic" }}>No catalogue sheets available yet. Add one below.</div>
                )}
                <div className="tc-row3">
                  <Field label="Sheet length"><NumberInput value={sheetL} onChange={setSheetL} suffix="in" /></Field>
                  <Field label="Sheet width"><NumberInput value={sheetW} onChange={setSheetW} suffix="in" /></Field>
                  <Field label="Sheet rate"><NumberInput value={sheetRate} onChange={setSheetRate} suffix="Rs/sheet" /></Field>
                </div>
              </>) : (<>
                {sheetsLoading ? (
                  <div className="tc-field-hint" style={{ marginTop: 10, fontStyle: "italic" }}>Loading catalogue...</div>
                ) : sheetCatalogue.length === 0 ? (
                  <div className="tc-agent-empty">No sheets in catalogue yet - ask the owner to add sheets in Owner mode.</div>
                ) : (
                  <Field label="Sheet number">
                    <select className="tc-agent-select" value={selectedSheetId} onChange={function (e) { setSelectedSheetId(e.target.value); }}>
                      <option value="">Select sheet number...</option>
                      {sheetCatalogue.map(function (s) { return <option key={s.id} value={s.id}>{s.number}</option>; })}
                    </select>
                    {selectedSheet && <span className="tc-field-hint">Size: {selectedSheet.l}" x {selectedSheet.w}"</span>}
                  </Field>
                )}
              </>)}
              <div className="tc-section-title"><Scissors /> Tag size & cutting</div>
              <div className="tc-row">
                <Field label="Tag length"><NumberInput value={tagL} onChange={setTagL} suffix="in" /></Field>
                <Field label="Tag width"><NumberInput value={tagW} onChange={setTagW} suffix="in" /></Field>
              </div>
              {isOwner && (<>
                <div className="tc-auto-note"><Info /> Orientation auto-selected: <strong>{calc.isRotated ? "tag rotated 90deg" : "tag as entered"}</strong> - whichever uses fewer sheets for this job.</div>
                <div className="tc-row">
                  <Field label="Cutting overlap" hint="Added to each side before punching"><NumberInput value={cuttingOverlapMM} onChange={setCuttingOverlapMM} min={0} suffix="mm/side" /></Field>
                  <Field label="Inside margin" hint="Minimum spacing kept around tags"><NumberInput value={insideMarginMM} onChange={setInsideMarginMM} min={0} suffix="mm/side" /></Field>
                </div>
                <div className="tc-auto-note"><Info /> Sheet cut into <strong>{num(calc.n, 0)} x {num(calc.m, 0)} = {num(calc.autoPiecesPerSheet, 0)} pieces</strong> ({num(calc.pieceL)}" x {num(calc.pieceW)}" each, to fit the {printMethod} machine). Each piece holds <strong>{num(calc.tagsRows, 0)} x {num(calc.tagsCols, 0)} = {num(calc.tagsPerPieceNominal, 0)} tags</strong>{calc.reclaimedTagsPerPiece > 0 ? <span> + <strong style={{color:"#2980b9"}}>{calc.reclaimedTagsPerPiece} reclaimed</strong> = <strong>{calc.tagsPerPieceNominal + calc.reclaimedTagsPerPiece}</strong> tags/piece</span> : ""} - {num(calc.totalTagsPerSheet, 0)} tags/sheet total.</div>
                <div className="tc-field-hint" style={{ marginBottom: 10 }}>Inlap left over per piece: {num(calc.leftoverL)}" x {num(calc.leftoverW)}" (minimum required: {num(2 * calc.marginIn)}" x {num(2 * calc.marginIn)}"){printMethod === "offset" ? " - strip reclaiming available for screen print only" : ""}</div>
                <button type="button" className={"tc-assump-toggle" + (showAdvancedLayout ? " open" : "")} style={{ marginTop: 0, marginBottom: 10 }} onClick={function () { setShowAdvancedLayout(function (s) { return !s; }); }}><ChevronDown /> {showAdvancedLayout ? "Hide" : "Show"} advanced layout options</button>
                {showAdvancedLayout && (<div className="tc-override-box">
                  <div className="tc-field-hint" style={{ marginBottom: 10 }}>Max feed size - the largest piece each machine can take. Pieces are grouped as large as possible within this limit.</div>
                  <div className="tc-row"><Field label="Offset max feed"><NumberInput value={feedOffsetL} onChange={setFeedOffsetL} suffix="in" /></Field><Field label="x "><NumberInput value={feedOffsetW} onChange={setFeedOffsetW} suffix="in" /></Field></div>
                  <div className="tc-row"><Field label="Screen print max feed"><NumberInput value={feedHandL} onChange={setFeedHandL} suffix="in" /></Field><Field label="x "><NumberInput value={feedHandW} onChange={setFeedHandW} suffix="in" /></Field></div>
                  <div className="tc-field-hint">Minimum piece size for screen print: 6" x 9".</div>
                  <Toggle checked={overridePieces} onChange={setOverridePieces} onLabel="Overriding pieces per sheet" offLabel="Using app's suggested grouping" />
                  {overridePieces && <Field label="Pieces per sheet (manual)"><NumberInput value={manualPiecesPerSheet} onChange={setManualPiecesPerSheet} min={0} step={1} /></Field>}
                </div>)}
              </>)}
              <div className="tc-section-title"><Printer /> Printing</div>
              <div className="tc-choice-row">
                <div className={"tc-choice" + (printMethod === "offset" ? " tc-choice-active" : "")} onClick={function () { setPrintMethod("offset"); }}>Offset</div>
                <div className={"tc-choice" + (printMethod === "hand" ? " tc-choice-active" : "")} onClick={function () { setPrintMethod("hand"); }}>Screen print</div>
              </div>
              {printMethod === "hand" && <Field label="Number of colors" hint="Rs500 per color per 1000 pulls"><NumberInput value={colors} onChange={setColors} min={1} step={1} /></Field>}
              <div className="tc-section-title"><CircleDot /> Lamination & finishing</div>
              <Toggle checked={lamination} onChange={setLamination} onLabel="Matt lamination - yes" offLabel="No lamination" />
              <div className="tc-field-hint" style={{ marginBottom: 10 }}>Die punching is applied to every job automatically.</div>
              <div className="tc-section-title"><Truck /> Order</div>
              <div className="tc-row">
                <Field label="Order quantity"><NumberInput value={orderQty} onChange={setOrderQty} min={1} step={1} suffix="tags" /></Field>
                {isOwner ? <Field label="Transport (flat)"><NumberInput value={transport} onChange={setTransport} suffix="Rs/order" /></Field> : <div />}
              </div>
              {isOwner ? (<>
                <div className="tc-section-title"><Percent /> Your reference margin</div>
                <div className="tc-margin-row" style={{ marginTop: 0 }}>
                  <div style={{ width: 110 }}><NumberInput value={marginPct} onChange={setMarginPct} min={0} suffix="%" /></div>
                  <div className="tc-choice-row" style={{ marginBottom: 0, flex: 1 }}>
                    <div className={"tc-choice" + (marginMode === "markup" ? " tc-choice-active" : "")} onClick={function () { setMarginMode("markup"); }}>On cost (markup)</div>
                    <div className={"tc-choice" + (marginMode === "margin" ? " tc-choice-active" : "")} onClick={function () { setMarginMode("margin"); }}>On price (margin)</div>
                  </div>
                </div>
              </>) : (<>
                <div className="tc-section-title"><Users /> Welcome, {session.name}</div>
                <div className="tc-agent-empty" style={{ marginBottom: 12 }}>Your margin has been applied automatically. Enter the job details on the left to generate a quote.</div>
              </>)}
            </>) : null}
          </div>
          {isOwner ? (ownerView === "calculator" ? (
            <div className="tc-tag">
              <div className="tc-tag-hole-loop" />
              <div className="tc-tag-header"><div className="tc-tag-eyebrow">Cost Breakdown</div><div className="tc-tag-qty">{num(orderQty, 0)} tags ordered - {num(calc.sheetsNeeded, 0)} sheets - {num(calc.totalPieces, 0)} pieces - {num(calc.totalTags, 0)} tags produced</div></div>
              <div className="tc-lines">
                <LineItem icon={<Layers />} label="Material" sub={num(calc.sheetsNeeded, 0) + " sheets x " + inr(sheetRate)} amount={inr(calc.materialCost)} />
                <LineItem icon={<Printer />} label={printMethod === "offset" ? "Offset printing" : "Screen printing"} sub={printMethod === "offset" ? "Min Rs2,000 (1000 pcs) + " + Math.max(0, calc.printSlabs - 1) + " x Rs350" : colors + " color(s) x Rs500 x " + calc.printSlabs + " slab(s)"} amount={inr(calc.printingCost)} />
                <LineItem icon={<CircleDot />} label="Lamination (matt)" sub={lamination ? num(calc.pieceAreaSqIn) + " sq.in x " + num(calc.totalPieces, 0) + " pieces x Rs0.004" : "Not applied"} amount={inr(calc.laminationCost)} muted={!lamination} />
                <LineItem icon={<Scissors />} label="Die punching" sub={"Die (" + calc.tier.label + "): " + inr(calc.dieMakingCost) + " + running " + calc.dieSlabs + " slab(s) x Rs" + calc.tier.runRate} amount={inr(calc.dieTotalCost)} />
                <LineItem icon={<Truck />} label="Transportation" sub="Flat, per order" amount={inr(calc.transportCost)} />
              </div>
              <div className="tc-subtotal-row"><span>Subtotal (cost)</span><strong>{inr(calc.subtotal)}</strong></div>
              <div className="tc-subtotal-row"><span>Profit ({marginPct}% {marginMode === "markup" ? "on cost" : "on price"})</span><strong>{inr(calc.profitAmount)}</strong></div>
              <div className="tc-final"><div className="tc-final-label">Selling Price - This Order</div><div className="tc-final-price">{inr(calc.sellingPrice)}</div><div className="tc-final-per">{inr(calc.pricePerTag)} per tag - cost {inr(calc.costPerTag)} per tag</div></div>
              {calc.overage > 0 && <div className="tc-overage-note">Sheets round up to whole numbers - this run produces {num(calc.totalTags, 0)} tags, {num(calc.overage, 0)} more than ordered, at no extra charge.</div>}
              <button className={"tc-assump-toggle" + (showAssumptions ? " open" : "")} onClick={function () { setShowAssumptions(function (s) { return !s; }); }}><ChevronDown /> {showAssumptions ? "Hide" : "Show"} assumptions used in this calculation</button>
              {showAssumptions && (<ul className="tc-assumptions">
                <li>The full sheet is cut into {num(calc.n, 0)} x {num(calc.m, 0)} = {num(calc.autoPiecesPerSheet, 0)} equal pieces ({num(calc.pieceL)}" x {num(calc.pieceW)}" each) sized to fit the {printMethod} machine's max feed.</li>
                <li>Each piece is then packed with tags (each needing {num(cuttingOverlapMM, 1)}mm cutting overlap per side): {num(calc.tagsRows, 0)} x {num(calc.tagsCols, 0)} = {num(calc.tagsPerPieceNominal, 0)} tags/piece, {num(calc.totalTagsPerSheet, 0)} tags/sheet total.</li>
                <li>The leftover space becomes the inlap/margin around the tags - at least the minimum {num(insideMarginMM, 1)}mm/side you set.</li>
                <li>Printing, lamination and die-punching costs are counted per piece, not per tag or per sheet.</li>
                <li>Slab rounding: up to 200 pieces over a 1,000 mark still count as that slab; 201+ rolls to the next.</li>
                <li>Lamination area is based on the piece size, at Rs0.004/sq.in, matt only.</li>
                <li>Die tier and running rate: up to 10x10" (Rs1,000 die), up to 14x20" (Rs1,800 die), both Rs500/1000 running; bigger is Rs2,800 die at Rs750/1000 running.</li>
                <li>Labor is Rs0 - treated as already built into the rates above.</li>
                <li>Transport is a flat Rs{num(transport, 0)} per order, not per piece.</li>
                <li>Agent margins are stored per user and applied automatically - agents never see the cost breakdown or the %.</li>
              </ul>)}
            </div>
          ) : null) : (
            <div className="tc-tag">
              <div className="tc-tag-hole-loop" />
              <div className="tc-tag-header"><div className="tc-tag-eyebrow">Quote</div><div className="tc-tag-qty">{num(orderQty, 0)} tags</div></div>
              <div className="tc-final" style={{ marginTop: 6 }}><div className="tc-final-label">Price for this order</div><div className="tc-final-price">{inr(calc.sellingPrice)}</div><div className="tc-final-per">{inr(calc.pricePerTag)} per tag</div></div>
            </div>
          )}
        </div>
        {isOwner && ownerView === "calculator" && (
          <div style={{ maxWidth: 1180, margin: "18px auto 0" }}>
            <button className={"tc-assump-toggle" + (showLayoutPreview ? " open" : "")} onClick={function () { setShowLayoutPreview(function (s) { return !s; }); }}><ChevronDown /> {showLayoutPreview ? "Hide" : "Show"} visual layout preview</button>
            {showLayoutPreview && <div style={{ marginTop: 12 }}><LayoutPreview title="Layout Preview" sheetLength={sheetL} sheetWidth={sheetW} pieceLength={calc.pieceL} pieceWidth={calc.pieceW} piecesAcross={calc.n} piecesDown={calc.m} tagLength={calc.TL} tagWidth={calc.TW} tagsAcross={calc.tagsRows} tagsDown={calc.tagsCols} overlap={calc.overlapIn} margin={calc.marginIn} orientation={calc.isRotated ? "Tag rotated 90deg" : "Tag as entered"} totalSheets={calc.sheetsNeeded} quantity={orderQty} feedDirection={printMethod === "offset" ? "Offset press feed" : "Hand-print feed"} /></div>}
          </div>
        )}
      </>)}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<TagCostingCalculator />);
