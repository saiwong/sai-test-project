const queryInput = document.querySelector("#query");
const clearButton = document.querySelector("#clear-search");
const resultsEl = document.querySelector("#results");
const statusEl = document.querySelector("#status");
const songCountEl = document.querySelector("#song-count");
const resultSummaryEl = document.querySelector("#result-summary");
const elapsedEl = document.querySelector("#elapsed");
const emptyStateEl = document.querySelector("#empty-state");
const resultsBand = document.querySelector(".results-band");
const modeButtons = [...document.querySelectorAll(".mode-button")];
const viewButtons = [...document.querySelectorAll(".view-tab")];
const languageButtons = [...document.querySelectorAll(".language-button")];
const searchView = document.querySelector("#search-view");
const queueView = document.querySelector("#queue-view");
const controlButtons = [...document.querySelectorAll(".control-button")];
const queueCountEl = document.querySelector("#queue-count");
const queueSummaryEl = document.querySelector("#queue-summary");
const queueListEl = document.querySelector("#queue-list");
const queueEmptyEl = document.querySelector("#queue-empty");
const refreshQueueButton = document.querySelector("#refresh-queue");
const randomizeQueueButton = document.querySelector("#randomize-queue");

const DEFAULT_SONG_SERVER_HOST = "";
const SONG_SERVER_HOST = getSongServerHost();
const COMMAND_ENDPOINT = `${SONG_SERVER_HOST}/demo/CommandServlet`;
const PLAYLIST_ENDPOINT = `${SONG_SERVER_HOST}/demo/PlaylistServlet`;
const SELECTED_SONGS_CACHE_KEY = `ktv-selected-songs:${SONG_SERVER_HOST}`;
const LANGUAGE_CACHE_KEY = "ktv-interface-language";
const ADD_COMMAND = "Add1";
const COMMAND_LABEL_KEYS = {
  Skip: "command.skip",
  Play: "command.playPause",
  Reset: "command.replay",
  Mute: "command.mute",
  MuOr: "command.vocal",
  Music_down: "command.volumeDown",
  Music_up: "command.volumeUp",
  Tone_down: "command.pitchDown",
  Tone_up: "command.pitchUp"
};
const VIEW_LABEL_KEYS = {
  search: "view.search",
  queue: "view.playlist"
};
const MODE_LABEL_KEYS = {
  all: "mode.all",
  title: "mode.songs",
  singer: "mode.singers"
};
const VIEW_ICON_NAMES = {
  search: "search",
  queue: "list"
};
const MODE_ICON_NAMES = {
  all: "asterisk",
  title: "music",
  singer: "mic"
};
const COMMAND_ICON_NAMES = {
  Skip: "skipForward",
  Play: "playPause",
  Reset: "rotateCcw",
  Mute: "volumeX",
  MuOr: "mic",
  Music_down: "volumeMinus",
  Music_up: "volumePlus",
  Tone_down: "chevronDown",
  Tone_up: "chevronUp"
};
const ICON_NODES = {
  arrowUp: [
    ["path", { d: "M12 19V5" }],
    ["path", { d: "m5 12 7-7 7 7" }]
  ],
  asterisk: [
    ["path", { d: "M12 3v18" }],
    ["path", { d: "M3 12h18" }],
    ["path", { d: "m5.6 5.6 12.8 12.8" }],
    ["path", { d: "m18.4 5.6-12.8 12.8" }]
  ],
  chevronDown: [
    ["path", { d: "m6 9 6 6 6-6" }]
  ],
  chevronUp: [
    ["path", { d: "m18 15-6-6-6 6" }]
  ],
  list: [
    ["path", { d: "M8 6h13" }],
    ["path", { d: "M8 12h13" }],
    ["path", { d: "M8 18h13" }],
    ["path", { d: "M3 6h.01" }],
    ["path", { d: "M3 12h.01" }],
    ["path", { d: "M3 18h.01" }]
  ],
  mic: [
    ["path", { d: "M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Z" }],
    ["path", { d: "M19 10v2a7 7 0 0 1-14 0v-2" }],
    ["path", { d: "M12 19v3" }],
    ["path", { d: "M8 22h8" }]
  ],
  music: [
    ["path", { d: "M9 18V5l12-2v13" }],
    ["circle", { cx: "6", cy: "18", r: "3" }],
    ["circle", { cx: "18", cy: "16", r: "3" }]
  ],
  playPause: [
    ["path", { d: "M6 4v16l8-8-8-8Z" }],
    ["path", { d: "M17 5v14" }],
    ["path", { d: "M21 5v14" }]
  ],
  refreshCw: [
    ["path", { d: "M21 12a9 9 0 1 1-2.6-6.4" }],
    ["path", { d: "M21 3v6h-6" }]
  ],
  rotateCcw: [
    ["path", { d: "M3 12a9 9 0 1 0 3-6.7" }],
    ["path", { d: "M3 4v6h6" }]
  ],
  search: [
    ["circle", { cx: "11", cy: "11", r: "7" }],
    ["path", { d: "m20 20-4-4" }]
  ],
  shuffle: [
    ["path", { d: "M16 3h5v5" }],
    ["path", { d: "M4 20 21 3" }],
    ["path", { d: "M21 16v5h-5" }],
    ["path", { d: "M15 15l6 6" }],
    ["path", { d: "M4 4l5 5" }]
  ],
  skipForward: [
    ["path", { d: "M5 4v16l10-8-10-8Z" }],
    ["path", { d: "M19 5v14" }]
  ],
  trash: [
    ["path", { d: "M3 6h18" }],
    ["path", { d: "M8 6V4h8v2" }],
    ["path", { d: "M6 6l1 15h10l1-15" }],
    ["path", { d: "M10 11v6" }],
    ["path", { d: "M14 11v6" }]
  ],
  volumeMinus: [
    ["path", { d: "M11 5 6 9H3v6h3l5 4V5Z" }],
    ["path", { d: "M16 12h5" }]
  ],
  volumePlus: [
    ["path", { d: "M11 5 6 9H3v6h3l5 4V5Z" }],
    ["path", { d: "M16 12h5" }],
    ["path", { d: "M18.5 9.5v5" }]
  ],
  volumeX: [
    ["path", { d: "M11 5 6 9H3v6h3l5 4V5Z" }],
    ["path", { d: "m16 9 5 6" }],
    ["path", { d: "m21 9-5 6" }]
  ],
  x: [
    ["path", { d: "M18 6 6 18" }],
    ["path", { d: "m6 6 12 12" }]
  ]
};
const TEXT = {
  en: {
    "app.title": "KTV Finder",
    "aria.views": "Views",
    "aria.language": "Interface language",
    "aria.search": "Song search",
    "aria.searchTarget": "Search target",
    "aria.controls": "Playback controls",
    "view.search": "Search",
    "view.playlist": "Playlist",
    "search.label": "Search songs or singers",
    "search.placeholder": "Song or singer",
    "action.clearSearch": "Clear search",
    "mode.all": "All",
    "mode.songs": "Songs",
    "mode.singers": "Singers",
    "result.preparing": "Preparing index",
    "result.noMatches": "No matches",
    "result.songBy": "{count} song by {singer}",
    "result.songsBy": "{count} songs by {singer}",
    "result.singer": "{count} singer",
    "result.singers": "{count} singers",
    "result.showingSingers": "Showing {count} singers",
    "result.match": "{count} match",
    "result.matches": "{count} matches",
    "result.showingSongs": "Showing {count} songs",
    "singer.song": "{count} song",
    "singer.songs": "{count} songs",
    "singer.view": "View",
    "aria.showSinger": "Show songs by {singer}",
    "aria.addSong": "Add {title} by {singer} to queue",
    "action.addToQueue": "Add to queue",
    "queue.title": "Playlist",
    "queue.loading": "Loading...",
    "queue.empty": "No songs in playlist",
    "queue.unable": "Unable to load playlist",
    "queue.songInPlaylist": "{count} song in playlist",
    "queue.songsInPlaylist": "{count} songs in playlist",
    "queue.songInPlaylistRefresh": "{count} song in playlist; tap Refresh",
    "queue.songsInPlaylistRefresh": "{count} songs in playlist; tap Refresh",
    "queue.loadingSong": "Loading {count} playlist song...",
    "queue.loadingSongs": "Loading {count} playlist songs...",
    "queue.refresh": "Refresh",
    "queue.randomize": "Randomize",
    "queue.next": "Next",
    "queue.remove": "Remove",
    "queue.unknownSinger": "Unknown singer",
    "queue.untitled": "Untitled",
    "status.loadingIndex": "Loading song index...",
    "status.ready": "Ready",
    "status.indexFailed": "Index failed to load",
    "status.workerFailed": "Search worker failed",
    "status.unableIndex": "Unable to load index",
    "status.sent": "{action} sent",
    "status.failed": "{action} failed",
    "status.movedNext": "Moved next",
    "status.removed": "Removed",
    "status.needTwoSongs": "Need at least two songs in playlist",
    "status.randomizing": "Randomizing {current}/{total}",
    "status.randomized": "Randomized playlist",
    "status.randomizeFailed": "Randomize failed",
    "status.sending": "Sending",
    "status.queued": "Queued",
    "status.queuedCount": "Queued x{count}",
    "status.queueFailed": "Queue failed",
    "status.failedQueued": "Failed; queued x{count}",
    "status.queuedTitle": "{status}: {title}",
    "command.skip": "Skip",
    "command.playPause": "Play/Pause",
    "command.replay": "Replay",
    "command.mute": "Mute",
    "command.vocal": "Vocal",
    "command.volumeDown": "Vol -",
    "command.volumeUp": "Vol +",
    "command.pitchDown": "Pitch -",
    "command.pitchUp": "Pitch +"
  },
  zh: {
    "app.title": "KTV 点歌",
    "aria.views": "视图",
    "aria.language": "界面语言",
    "aria.search": "歌曲搜索",
    "aria.searchTarget": "搜索范围",
    "aria.controls": "播放控制",
    "view.search": "搜索",
    "view.playlist": "歌单",
    "search.label": "搜索歌曲或歌手",
    "search.placeholder": "歌曲或歌手",
    "action.clearSearch": "清除搜索",
    "mode.all": "全部",
    "mode.songs": "歌曲",
    "mode.singers": "歌手",
    "result.preparing": "正在准备歌库",
    "result.noMatches": "没有结果",
    "result.songBy": "{singer}：{count} 首歌",
    "result.songsBy": "{singer}：{count} 首歌",
    "result.singer": "{count} 位歌手",
    "result.singers": "{count} 位歌手",
    "result.showingSingers": "显示 {count} 位歌手",
    "result.match": "{count} 个结果",
    "result.matches": "{count} 个结果",
    "result.showingSongs": "显示 {count} 首歌",
    "singer.song": "{count} 首歌",
    "singer.songs": "{count} 首歌",
    "singer.view": "查看",
    "aria.showSinger": "查看 {singer} 的歌曲",
    "aria.addSong": "加入歌单：{title}，{singer}",
    "action.addToQueue": "加入歌单",
    "queue.title": "歌单",
    "queue.loading": "加载中...",
    "queue.empty": "歌单为空",
    "queue.unable": "无法加载歌单",
    "queue.songInPlaylist": "歌单中有 {count} 首歌",
    "queue.songsInPlaylist": "歌单中有 {count} 首歌",
    "queue.songInPlaylistRefresh": "歌单中有 {count} 首歌；点刷新",
    "queue.songsInPlaylistRefresh": "歌单中有 {count} 首歌；点刷新",
    "queue.loadingSong": "正在加载 {count} 首歌...",
    "queue.loadingSongs": "正在加载 {count} 首歌...",
    "queue.refresh": "刷新",
    "queue.randomize": "随机排序",
    "queue.next": "置顶",
    "queue.remove": "删除",
    "queue.unknownSinger": "未知歌手",
    "queue.untitled": "未命名",
    "status.loadingIndex": "正在加载歌库...",
    "status.ready": "就绪",
    "status.indexFailed": "歌库加载失败",
    "status.workerFailed": "搜索加载失败",
    "status.unableIndex": "无法加载歌库",
    "status.sent": "{action}已发送",
    "status.failed": "{action}失败",
    "status.movedNext": "已置顶",
    "status.removed": "已删除",
    "status.needTwoSongs": "歌单至少需要两首歌",
    "status.randomizing": "随机排序 {current}/{total}",
    "status.randomized": "歌单已随机排序",
    "status.randomizeFailed": "随机排序失败",
    "status.sending": "发送中",
    "status.queued": "已加入",
    "status.queuedCount": "已加入 x{count}",
    "status.queueFailed": "加入失败",
    "status.failedQueued": "失败；已加入 x{count}",
    "status.queuedTitle": "{status}：{title}",
    "command.skip": "切歌",
    "command.playPause": "播放/暂停",
    "command.replay": "重唱",
    "command.mute": "静音",
    "command.vocal": "原唱",
    "command.volumeDown": "音量-",
    "command.volumeUp": "音量+",
    "command.pitchDown": "降调",
    "command.pitchUp": "升调"
  }
};

const state = {
  ready: false,
  language: getInitialLanguage(),
  activeView: "search",
  mode: "all",
  query: "",
  singerFilter: "",
  statusKey: "status.loadingIndex",
  statusValues: {},
  pendingTimer: 0,
  requestId: 0,
  lastResults: [],
  lastSingers: [],
  lastResultMessage: null,
  visibleSongs: new Map(),
  queueState: new Map(),
  selectedSongs: loadSelectedSongsCache(),
  playlistCount: null,
  queueBusy: false,
  selectedRetryTimer: 0,
  selectedRetryCount: 0
};

updatePlaylistCount(state.selectedSongs.length);
applyLanguage();

const worker = new Worker(`search-worker.js?v=${Date.now()}`);
let jsonpSequence = 0;

function getSongServerHost() {
  const rawHost = new URLSearchParams(window.location.search).get("songServerHost");
  if (!rawHost) return DEFAULT_SONG_SERVER_HOST;

  try {
    const parsed = new URL(rawHost);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("songServerHost must start with http:// or https://");
    }
    return parsed.origin;
  } catch (error) {
    console.warn(`Ignoring invalid songServerHost: ${rawHost}`, error);
    return DEFAULT_SONG_SERVER_HOST;
  }
}

function getInitialLanguage() {
  const params = new URLSearchParams(window.location.search);
  const rawUrlLanguage = params.get("lang");
  if (String(rawUrlLanguage || "").trim().toLowerCase() === "auto") {
    clearSavedLanguage();
    return detectLocaleLanguage();
  }

  const urlLanguage = normalizeLanguage(params.get("lang"));
  if (urlLanguage) {
    saveLanguage(urlLanguage);
    return urlLanguage;
  }

  try {
    return normalizeLanguage(window.localStorage.getItem(LANGUAGE_CACHE_KEY)) || detectLocaleLanguage();
  } catch (error) {
    console.warn("Unable to read interface language", error);
    return detectLocaleLanguage();
  }
}

function normalizeLanguage(value) {
  const language = String(value || "").trim().toLowerCase();
  if (!language) return "";
  if (
    language === "cn" ||
    language === "zh" ||
    language.startsWith("zh-") ||
    language === "cmn" ||
    language.startsWith("cmn-") ||
    language === "yue" ||
    language.startsWith("yue-")
  ) {
    return "zh";
  }
  if (language === "en" || language.startsWith("en-")) return "en";
  return "";
}

function detectLocaleLanguage() {
  const locales = [];
  if (Array.isArray(navigator.languages)) locales.push(...navigator.languages);
  if (navigator.language) locales.push(navigator.language);
  if (navigator.userLanguage) locales.push(navigator.userLanguage);

  for (const locale of locales) {
    const language = normalizeLanguage(locale);
    if (language) return language;
  }

  return "en";
}

function saveLanguage(language) {
  try {
    window.localStorage.setItem(LANGUAGE_CACHE_KEY, language);
  } catch (error) {
    console.warn("Unable to save interface language", error);
  }
}

function clearSavedLanguage() {
  try {
    window.localStorage.removeItem(LANGUAGE_CACHE_KEY);
  } catch (error) {
    console.warn("Unable to clear interface language", error);
  }
}

function setLanguage(language) {
  const nextLanguage = normalizeLanguage(language);
  if (!nextLanguage || nextLanguage === state.language) return;

  state.language = nextLanguage;
  saveLanguage(nextLanguage);
  applyLanguage();

  if (state.lastResultMessage) {
    renderResults(state.lastResultMessage);
  }
  renderSelectedSongs(state.playlistCount ?? state.selectedSongs.length);
  updateStatusDisplay();
}

function applyLanguage() {
  document.documentElement.lang = state.language === "zh" ? "zh-Hans" : "en";
  document.title = t("app.title");

  document.querySelector(".view-tabs")?.setAttribute("aria-label", t("aria.views"));
  document.querySelector(".language-toggle")?.setAttribute("aria-label", t("aria.language"));
  document.querySelector(".search-band")?.setAttribute("aria-label", t("aria.search"));
  document.querySelector(".mode-row")?.setAttribute("aria-label", t("aria.searchTarget"));
  document.querySelector(".control-panel")?.setAttribute("aria-label", t("aria.controls"));

  viewButtons.forEach((button) => {
    const count = button.querySelector("#queue-count");
    const label = t(VIEW_LABEL_KEYS[button.dataset.view] || button.dataset.view);
    setButtonContent(button, VIEW_ICON_NAMES[button.dataset.view], label, count ? [count] : []);
  });

  languageButtons.forEach((button) => {
    const active = button.dataset.lang === state.language;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  });

  modeButtons.forEach((button) => {
    setButtonContent(
      button,
      MODE_ICON_NAMES[button.dataset.mode],
      t(MODE_LABEL_KEYS[button.dataset.mode] || button.dataset.mode)
    );
  });

  controlButtons.forEach((button) => {
    setButtonContent(button, COMMAND_ICON_NAMES[button.dataset.command], commandLabel(button.dataset.command));
  });

  const searchLabel = document.querySelector("label[for='query']");
  if (searchLabel) searchLabel.textContent = t("search.label");
  queryInput.placeholder = t("search.placeholder");
  setButtonContent(clearButton, "x", "");
  clearButton.setAttribute("aria-label", t("action.clearSearch"));
  clearButton.title = t("action.clearSearch");
  setButtonContent(refreshQueueButton, "refreshCw", t("queue.refresh"));
  setButtonContent(randomizeQueueButton, "shuffle", t("queue.randomize"));
  document.querySelector(".queue-toolbar h2").textContent = t("queue.title");
  emptyStateEl.textContent = t("result.noMatches");
  queueEmptyEl.textContent = t("queue.empty");

  if (!state.lastResultMessage) {
    resultSummaryEl.textContent = t("result.preparing");
  }
  if (queueSummaryEl.textContent.trim() === "" || queueSummaryEl.textContent === "Loading...") {
    queueSummaryEl.textContent = t("queue.loading");
  }
  updateStatusDisplay();
}

function t(key, values = {}) {
  const text = TEXT[state.language]?.[key] ?? TEXT.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}

function formatCount(count) {
  const locale = state.language === "zh" ? "zh-Hans" : "en-US";
  return Number(count || 0).toLocaleString(locale);
}

function chooseByCount(count, singularKey, pluralKey, values = {}) {
  const key = count === 1 ? singularKey : pluralKey;
  return t(key, { ...values, count: formatCount(count) });
}

function commandLabel(cmd) {
  return t(COMMAND_LABEL_KEYS[cmd] || cmd);
}

function setButtonContent(element, iconName, label, extraNodes = []) {
  const children = [];
  if (iconName) children.push(createButtonIcon(iconName));
  if (label) children.push(createButtonLabel(label));
  children.push(...extraNodes);
  element.replaceChildren(...children);
}

function createButtonIcon(iconName) {
  const span = document.createElement("span");
  span.className = "button-icon";
  span.setAttribute("aria-hidden", "true");
  span.append(createSvgIcon(iconName));
  return span;
}

function createButtonLabel(label) {
  const span = document.createElement("span");
  span.className = "button-label";
  span.textContent = label;
  return span;
}

function createSvgIcon(iconName) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("focusable", "false");

  (ICON_NODES[iconName] || ICON_NODES.asterisk).forEach(([tag, attributes]) => {
    const node = document.createElementNS("http://www.w3.org/2000/svg", tag);
    Object.entries(attributes).forEach(([name, value]) => {
      node.setAttribute(name, value);
    });
    svg.append(node);
  });

  return svg;
}

function setStatus(key, values = {}) {
  state.statusKey = key;
  state.statusValues = values;
  updateStatusDisplay();
}

function updateStatusDisplay() {
  statusEl.textContent = t(state.statusKey, state.statusValues);
}

worker.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "ready") {
    state.ready = true;
    if (songCountEl) {
      songCountEl.textContent = formatCount(message.count);
    }
    setStatus("status.ready");
    resultsBand.setAttribute("aria-busy", "false");
    searchNow();
    loadSelectedSongs(false);
    window.setInterval(() => {
      loadSelectedSongs(state.activeView === "queue");
    }, 6000);
    return;
  }

  if (message.type === "error") {
    setStatus("status.indexFailed");
    resultsBand.setAttribute("aria-busy", "false");
    resultSummaryEl.textContent = t("status.unableIndex");
    return;
  }

  if (message.type === "results" && message.requestId === state.requestId) {
    resultsBand.setAttribute("aria-busy", "false");
    renderResults(message);
  }
});

worker.addEventListener("error", () => {
  setStatus("status.workerFailed");
  resultSummaryEl.textContent = t("status.unableIndex");
  resultsBand.setAttribute("aria-busy", "false");
});

queryInput.addEventListener("input", () => {
  state.query = queryInput.value.trim();
  state.singerFilter = "";
  queueSearch();
});

clearButton.addEventListener("click", () => {
  queryInput.value = "";
  state.query = "";
  state.singerFilter = "";
  queryInput.focus();
  searchNow();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === state.mode) return;

    state.mode = mode;
    state.singerFilter = "";
    modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    searchNow();
  });
});

languageButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setLanguage(button.dataset.lang);
  });
});

viewButtons.forEach((button) => {
  button.addEventListener("click", () => {
    setActiveView(button.dataset.view);
  });
});

controlButtons.forEach((button) => {
  button.addEventListener("click", () => {
    sendRemoteCommand(button.dataset.command, undefined, button);
  });
});

refreshQueueButton.addEventListener("click", () => {
  state.selectedRetryCount = 0;
  loadSelectedSongs(true);
});

randomizeQueueButton.addEventListener("click", () => {
  randomizeSelectedSongs();
});

queueListEl.addEventListener("click", (event) => {
  const actionButton = event.target.closest("[data-queue-action]");
  if (!actionButton || !queueListEl.contains(actionButton)) return;

  const rowId = actionButton.closest(".queue-item")?.dataset.rowId;
  if (!rowId) return;

  if (actionButton.dataset.queueAction === "next") {
    promoteSelectedSong(rowId);
  } else if (actionButton.dataset.queueAction === "remove") {
    removeSelectedSong(rowId);
  }
});

resultsEl.addEventListener("click", (event) => {
  const row = event.target.closest(".result-item");
  if (!row || !resultsEl.contains(row)) return;

  if (row.classList.contains("singer-result")) {
    selectSinger(row.dataset.singer);
    return;
  }

  queueSong(row.dataset.songId);
});

resultsEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const row = event.target.closest(".result-item");
  if (!row || !resultsEl.contains(row)) return;

  event.preventDefault();
  if (row.classList.contains("singer-result")) {
    selectSinger(row.dataset.singer);
    return;
  }

  queueSong(row.dataset.songId);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "/" && document.activeElement !== queryInput) {
    event.preventDefault();
    queryInput.focus();
  }

  if (event.key === "Escape" && document.activeElement === queryInput && queryInput.value) {
    queryInput.value = "";
    state.query = "";
    state.singerFilter = "";
    searchNow();
  }
});

function selectSinger(singer) {
  if (!singer) return;

  state.mode = "singer";
  state.singerFilter = singer;
  state.query = singer;
  queryInput.value = singer;
  modeButtons.forEach((item) => item.classList.toggle("is-active", item.dataset.mode === "singer"));
  searchNow();
}

function queueSearch() {
  window.clearTimeout(state.pendingTimer);
  state.pendingTimer = window.setTimeout(searchNow, 95);
}

function searchNow() {
  if (!state.ready) return;

  state.requestId += 1;
  resultsBand.setAttribute("aria-busy", "true");
  worker.postMessage({
    type: "search",
    requestId: state.requestId,
    query: state.query,
    singerFilter: state.singerFilter,
    mode: state.mode,
    limit: state.singerFilter ? 500 : 80
  });
}

function renderResults(message) {
  const query = message.query || "";
  const highlightQuery = message.normalizedQuery || query;
  const total = message.totalMatches;
  const shown = message.results.length;
  const singers = message.singers || [];
  const totalSingers = Number(message.totalSingerMatches || 0);
  resultsBand.dataset.query = query;
  state.lastResultMessage = message;
  state.lastResults = message.results;
  state.lastSingers = singers;
  state.visibleSongs = new Map(message.results.map((song) => [song.id, song]));

  if (message.singerFilter) {
    resultSummaryEl.textContent = chooseByCount(total, "result.songBy", "result.songsBy", {
      singer: message.singerFilter
    });
  } else if (state.mode === "singer") {
    resultSummaryEl.textContent = query
      ? chooseByCount(totalSingers, "result.singer", "result.singers")
      : t("result.showingSingers", { count: formatCount(singers.length) });
  } else if (query) {
    resultSummaryEl.textContent = chooseByCount(total, "result.match", "result.matches");
  } else {
    resultSummaryEl.textContent = t("result.showingSongs", { count: formatCount(shown) });
  }

  elapsedEl.textContent = `${message.elapsedMs.toFixed(0)} ms`;
  emptyStateEl.hidden = shown + singers.length !== 0;
  renderVisibleSongs(highlightQuery);
}

function renderVisibleSongs(query = state.query) {
  resultsEl.replaceChildren(
    ...state.lastSingers.map((singer) => renderSinger(singer, query)),
    ...state.lastResults.map((song) => renderSong(song, query))
  );
}

function renderSinger(singer, query) {
  const li = document.createElement("li");
  li.className = "result-item singer-result";
  li.dataset.singer = singer.name;
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.setAttribute("aria-label", t("aria.showSinger", { singer: singer.name }));

  const main = document.createElement("div");
  main.className = "song-main";

  const title = document.createElement("span");
  title.className = "song-title";
  title.append(...highlightText(singer.name, query));

  const meta = document.createElement("span");
  meta.className = "song-singer";
  meta.textContent = chooseByCount(singer.count, "singer.song", "singer.songs");

  main.append(title, meta);

  const side = document.createElement("div");
  side.className = "song-side";

  const action = document.createElement("span");
  action.className = "singer-action";
  setButtonContent(action, "list", t("singer.view"));

  side.append(action);
  li.append(main, side);
  return li;
}

function renderSong(song, query) {
  const queueStatus = state.queueState.get(song.id);
  const li = document.createElement("li");
  li.className = "result-item";
  li.dataset.songId = song.id;
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.setAttribute("aria-label", t("aria.addSong", {
    title: song.title,
    singer: song.singer || t("queue.unknownSinger")
  }));
  if (queueStatus) {
    li.dataset.queueState = queueStatus.status;
  }

  const main = document.createElement("div");
  main.className = "song-main";

  const title = document.createElement("span");
  title.className = "song-title";
  title.append(...highlightText(song.title, query));

  const singer = document.createElement("span");
  singer.className = "song-singer";
  singer.append(...highlightText(song.singer || t("queue.unknownSinger"), query));

  main.append(title, singer);

  const side = document.createElement("div");
  side.className = "song-side";

  const actionRow = document.createElement("div");
  actionRow.className = "song-actions";

  const queueButton = document.createElement("span");
  queueButton.className = "queue-button";
  queueButton.title = t("action.addToQueue");
  queueButton.setAttribute("aria-hidden", "true");
  queueButton.textContent = queueButtonText(queueStatus);

  const tags = document.createElement("span");
  tags.className = "tags";
  song.tags.forEach((tag) => {
    const item = document.createElement("span");
    item.className = "tag";
    item.textContent = tag;
    tags.append(item);
  });

  const queueNote = document.createElement("span");
  queueNote.className = "queue-status";
  queueNote.textContent = queueStatusMessage(queueStatus);

  actionRow.append(queueButton);
  side.append(actionRow, tags, queueNote);
  li.append(main, side);
  return li;
}

function setActiveView(view) {
  if (view !== "search" && view !== "queue") return;

  state.activeView = view;
  viewButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.view === view);
  });

  searchView.hidden = view !== "search";
  queueView.hidden = view !== "queue";

  if (view === "queue") {
    state.selectedRetryCount = 0;
    loadSelectedSongs(true);
  } else {
    queryInput.focus();
  }
}

async function sendRemoteCommand(cmd, cmdValue, button) {
  if (!cmd || button?.disabled) return;

  const label = commandLabel(cmd);
  button?.classList.add("is-busy");
  if (button) button.disabled = true;

  try {
    await sendCommand(cmd, cmdValue);
    setStatus("status.sent", { action: label });
  } catch (error) {
    setStatus("status.failed", { action: label });
    console.error(error);
  } finally {
    await loadSelectedSongs(true);
    button?.classList.remove("is-busy");
    if (button) button.disabled = false;
  }
}

async function loadSelectedSongs(fullList) {
  if (state.queueBusy && !fullList) return;

  try {
    const response = await jsonp(PLAYLIST_ENDPOINT, {
      onSelectPage: fullList ? "true" : "false"
    }, 5000);

    const responseCount = Number(response.number);
    const hasResponseCount = Number.isFinite(responseCount);

    if (response.songList !== undefined) {
      clearSelectedSongsRetry();
      state.selectedRetryCount = 0;
      state.selectedSongs = parseSelectedSongs(response.songList);
      saveSelectedSongsCache(state.selectedSongs);
      const count = hasResponseCount ? responseCount : state.selectedSongs.length;
      updatePlaylistCount(count);
      renderSelectedSongs(count);
    } else {
      const count = hasResponseCount ? responseCount : state.selectedSongs.length;
      updatePlaylistCount(count);
      if (count === 0) {
        clearSelectedSongsRetry();
        state.selectedRetryCount = 0;
        state.selectedSongs = [];
        saveSelectedSongsCache(state.selectedSongs);
        renderSelectedSongs(count);
      } else if (fullList) {
        renderPendingSelectedSongs(count);
        scheduleSelectedSongsRetry();
      }
    }
  } catch (error) {
    if (state.activeView === "queue") {
      queueSummaryEl.textContent = t("queue.unable");
    }
    console.error(error);
  }
}

function renderPendingSelectedSongs(remoteCount) {
  if (state.selectedSongs.length > 0 && state.selectedSongs.length === remoteCount) {
    clearSelectedSongsRetry();
    state.selectedRetryCount = 0;
    renderSelectedSongs(remoteCount);
    return;
  }

  const count = Number.isFinite(remoteCount) ? remoteCount : 0;
  queueSummaryEl.textContent = state.selectedRetryCount >= 6
    ? chooseByCount(count, "queue.songInPlaylistRefresh", "queue.songsInPlaylistRefresh")
    : chooseByCount(count, "queue.loadingSong", "queue.loadingSongs");
  queueEmptyEl.hidden = true;
  queueListEl.replaceChildren();
}

function updatePlaylistCount(count) {
  state.playlistCount = Number.isFinite(count) ? count : 0;
  queueCountEl.textContent = String(state.playlistCount);
}

function loadSelectedSongsCache() {
  try {
    const raw = window.localStorage.getItem(SELECTED_SONGS_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];

    return parsed.map((song, index) => ({
      index,
      rowId: String(song.rowId || ""),
      songId: String(song.songId || ""),
      title: String(song.title || ""),
      singer: String(song.singer || "")
    }));
  } catch (error) {
    console.warn("Unable to read selected song cache", error);
    return [];
  }
}

function saveSelectedSongsCache(songs) {
  try {
    if (songs.length === 0) {
      window.localStorage.removeItem(SELECTED_SONGS_CACHE_KEY);
      return;
    }

    window.localStorage.setItem(SELECTED_SONGS_CACHE_KEY, JSON.stringify(songs));
  } catch (error) {
    console.warn("Unable to save selected song cache", error);
  }
}

function scheduleSelectedSongsRetry() {
  if (state.selectedRetryTimer || state.activeView !== "queue" || state.selectedRetryCount >= 6) return;

  state.selectedRetryCount += 1;
  state.selectedRetryTimer = window.setTimeout(() => {
    state.selectedRetryTimer = 0;
    loadSelectedSongs(true);
  }, 700);
}

function clearSelectedSongsRetry() {
  window.clearTimeout(state.selectedRetryTimer);
  state.selectedRetryTimer = 0;
}

function parseSelectedSongs(songList) {
  if (!songList) return [];

  try {
    const parsed = typeof songList === "string" ? JSON.parse(songList) : songList;
    if (!Array.isArray(parsed)) return [];

    return parsed.map((song, index) => ({
      index,
      rowId: String(song.xH ?? song.XH ?? ""),
      songId: String(song.sONGBM ?? song.id ?? ""),
      title: String(song.sONGNAME ?? song.title ?? ""),
      singer: String(song.sINGER ?? song.singer ?? "")
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

function renderSelectedSongs(remoteCount = state.selectedSongs.length) {
  const count = Number.isFinite(remoteCount) ? remoteCount : state.selectedSongs.length;
  queueSummaryEl.textContent = chooseByCount(count, "queue.songInPlaylist", "queue.songsInPlaylist");
  queueEmptyEl.hidden = !(state.playlistCount === 0 && state.selectedSongs.length === 0);
  queueListEl.replaceChildren(...state.selectedSongs.map((song, index) => renderQueueItem(song, index)));
}

function renderQueueItem(song, index) {
  const li = document.createElement("li");
  li.className = "queue-item";
  li.dataset.rowId = song.rowId;

  const ordinal = document.createElement("span");
  ordinal.className = "queue-index";
  ordinal.textContent = String(index + 1);

  const main = document.createElement("div");
  main.className = "queue-main";

  const title = document.createElement("span");
  title.className = "queue-title";
  title.textContent = song.title || t("queue.untitled");

  const singer = document.createElement("span");
  singer.className = "queue-singer";
  singer.textContent = song.singer || t("queue.unknownSinger");

  main.append(title, singer);

  const actions = document.createElement("div");
  actions.className = "queue-row-actions";

  const next = document.createElement("button");
  next.className = "small-button";
  next.type = "button";
  next.dataset.queueAction = "next";
  next.disabled = !song.rowId || state.queueBusy;
  setButtonContent(next, "arrowUp", t("queue.next"));

  const remove = document.createElement("button");
  remove.className = "small-button danger";
  remove.type = "button";
  remove.dataset.queueAction = "remove";
  remove.disabled = !song.rowId || state.queueBusy;
  setButtonContent(remove, "trash", t("queue.remove"));

  actions.append(next, remove);
  li.append(ordinal, main, actions);
  return li;
}

async function promoteSelectedSong(rowId) {
  await runQueueMutation("Pro2", rowId, "status.movedNext");
}

async function removeSelectedSong(rowId) {
  await runQueueMutation("Del1", rowId, "status.removed");
}

async function runQueueMutation(cmd, rowId, successKey) {
  if (state.queueBusy) return;

  state.queueBusy = true;
  renderSelectedSongs();

  try {
    await sendCommand(cmd, rowId);
    setStatus(successKey);
  } catch (error) {
    setStatus("status.failed", { action: t(successKey) });
    console.error(error);
  } finally {
    state.queueBusy = false;
    await loadSelectedSongs(true);
  }
}

async function randomizeSelectedSongs() {
  if (state.queueBusy) return;

  const candidates = state.selectedSongs.filter((song) => song.rowId);
  if (candidates.length < 2) {
    setStatus("status.needTwoSongs");
    return;
  }

  state.queueBusy = true;
  renderSelectedSongs();

  try {
    const shuffled = shuffle(candidates);
    const promoteOrder = [...shuffled].reverse();

    for (let index = 0; index < promoteOrder.length; index += 1) {
      setStatus("status.randomizing", {
        current: formatCount(index + 1),
        total: formatCount(promoteOrder.length)
      });
      await sendCommand("Pro2", promoteOrder[index].rowId);
    }

    setStatus("status.randomized");
  } catch (error) {
    setStatus("status.randomizeFailed");
    console.error(error);
  } finally {
    state.queueBusy = false;
    await loadSelectedSongs(true);
  }
}

function shuffle(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

async function queueSong(songId) {
  const song = state.visibleSongs.get(songId);
  if (!song) return;

  const current = state.queueState.get(songId);
  if (current?.status === "pending") return;

  const currentCount = Number(current?.count || 0);
  const nextCount = currentCount + 1;

  setQueueStatus(songId, "pending", currentCount);

  try {
    await sendCommand(ADD_COMMAND, song.id);
    setQueueStatus(songId, "queued", nextCount);
    setStatus("status.queuedTitle", {
      status: queueMessage(nextCount),
      title: song.title
    });
  } catch (error) {
    setQueueStatus(songId, "error", currentCount);
    setStatus("status.queuedTitle", {
      status: t("status.queueFailed"),
      title: song.title
    });
    console.error(error);
  } finally {
    await loadSelectedSongs(true);
  }
}

async function sendCommand(cmd, cmdValue) {
  const response = await jsonp(COMMAND_ENDPOINT, {
    cmd,
    cmdValue
  });

  if (!isCommandSuccess(response, cmd)) {
    throw new Error(`Command rejected: ${JSON.stringify(response)}`);
  }

  return response;
}

function isCommandSuccess(response, expectedCmd) {
  return response?.cmd === expectedCmd && (response.code === undefined || String(response.code) === "0");
}

function setQueueStatus(songId, status, count = 0) {
  state.queueState.set(songId, { status, count });
  renderVisibleSongs();
}

function queueButtonText(queueStatus) {
  switch (queueStatus?.status) {
    case "pending":
      return "...";
    case "queued":
      return queueStatus.count > 1 ? `x${queueStatus.count}` : "OK";
    case "error":
      return "!";
    default:
      return "+";
  }
}

function queueStatusMessage(queueStatus) {
  switch (queueStatus?.status) {
    case "pending":
      return t("status.sending");
    case "queued":
      return queueMessage(queueStatus.count);
    case "error":
      return failMessage(queueStatus.count);
    default:
      return "";
  }
}

function queueMessage(count) {
  return count > 1
    ? t("status.queuedCount", { count: formatCount(count) })
    : t("status.queued");
}

function failMessage(count) {
  return count > 0
    ? t("status.failedQueued", { count: formatCount(count) })
    : t("status.queueFailed");
}

function jsonp(endpoint, params, timeoutMs = 7000) {
  const callbackName = `ktvQueueCallback_${Date.now()}_${jsonpSequence}`;
  jsonpSequence += 1;

  const url = new URL(endpoint);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  });
  url.searchParams.set("jsonpCallback", callbackName);
  url.searchParams.set("_", String(Date.now()));

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    let settled = false;

    const cleanup = () => {
      window.clearTimeout(timer);
      delete window[callbackName];
      script.remove();
    };

    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      handler(value);
    };

    const timer = window.setTimeout(() => {
      finish(reject, new Error("Queue request timed out"));
    }, timeoutMs);

    window[callbackName] = (data) => {
      finish(resolve, data);
    };

    script.onerror = () => {
      finish(reject, new Error("Queue request failed"));
    };

    script.src = url.toString();
    document.head.append(script);
  });
}

function highlightText(value, query) {
  const text = String(value || "");
  const compactQuery = query.trim();
  if (compactQuery.length < 2) return [document.createTextNode(text)];

  const lowerText = text.toLowerCase();
  const lowerQuery = compactQuery.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);
  if (index < 0) return [document.createTextNode(text)];

  const before = document.createTextNode(text.slice(0, index));
  const mark = document.createElement("mark");
  mark.textContent = text.slice(index, index + compactQuery.length);
  const after = document.createTextNode(text.slice(index + compactQuery.length));
  return [before, mark, after];
}
