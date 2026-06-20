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
const ADD_COMMAND = "Add1";
const COMMAND_LABELS = {
  Skip: "Skipped",
  Play: "Play/Pause",
  Reset: "Replay",
  Mute: "Mute",
  MuOr: "Vocal",
  Music_down: "Vol -",
  Music_up: "Vol +",
  Tone_down: "Pitch -",
  Tone_up: "Pitch +",
  Pro2: "Moved next",
  Del1: "Removed"
};

const state = {
  ready: false,
  activeView: "search",
  mode: "all",
  query: "",
  pendingTimer: 0,
  requestId: 0,
  lastResults: [],
  visibleSongs: new Map(),
  queueState: new Map(),
  selectedSongs: [],
  queueBusy: false
};

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

worker.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "ready") {
    state.ready = true;
    if (songCountEl) {
      songCountEl.textContent = message.count.toLocaleString();
    }
    statusEl.textContent = "Ready";
    resultsBand.setAttribute("aria-busy", "false");
    searchNow();
    loadSelectedSongs(false);
    window.setInterval(() => {
      loadSelectedSongs(state.activeView === "queue");
    }, 6000);
    return;
  }

  if (message.type === "error") {
    statusEl.textContent = message.message || "Index failed to load";
    resultsBand.setAttribute("aria-busy", "false");
    resultSummaryEl.textContent = "Unable to load index";
    return;
  }

  if (message.type === "results" && message.requestId === state.requestId) {
    resultsBand.setAttribute("aria-busy", "false");
    renderResults(message);
  }
});

worker.addEventListener("error", () => {
  statusEl.textContent = "Search worker failed";
  resultSummaryEl.textContent = "Unable to load index";
  resultsBand.setAttribute("aria-busy", "false");
});

queryInput.addEventListener("input", () => {
  state.query = queryInput.value.trim();
  queueSearch();
});

clearButton.addEventListener("click", () => {
  queryInput.value = "";
  state.query = "";
  queryInput.focus();
  searchNow();
});

modeButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const mode = button.dataset.mode;
    if (mode === state.mode) return;

    state.mode = mode;
    modeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
    searchNow();
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
  queueSong(row.dataset.songId);
});

resultsEl.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;

  const row = event.target.closest(".result-item");
  if (!row || !resultsEl.contains(row)) return;

  event.preventDefault();
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
    searchNow();
  }
});

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
    mode: state.mode,
    limit: 80
  });
}

function renderResults(message) {
  const query = message.query || "";
  const total = message.totalMatches;
  const shown = message.results.length;
  resultsBand.dataset.query = query;
  state.lastResults = message.results;
  state.visibleSongs = new Map(message.results.map((song) => [song.id, song]));

  if (query) {
    const label = total === 1 ? "match" : "matches";
    resultSummaryEl.textContent = `${total.toLocaleString()} ${label}`;
  } else {
    resultSummaryEl.textContent = `Showing ${shown.toLocaleString()} songs`;
  }

  elapsedEl.textContent = `${message.elapsedMs.toFixed(0)} ms`;
  emptyStateEl.hidden = shown !== 0;
  renderVisibleSongs(query);
}

function renderVisibleSongs(query = state.query) {
  resultsEl.replaceChildren(...state.lastResults.map((song) => renderSong(song, query)));
}

function renderSong(song, query) {
  const queueStatus = state.queueState.get(song.id);
  const li = document.createElement("li");
  li.className = "result-item";
  li.dataset.songId = song.id;
  li.tabIndex = 0;
  li.setAttribute("role", "button");
  li.setAttribute("aria-label", `Add ${song.title} by ${song.singer || "Unknown singer"} to queue`);
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
  singer.append(...highlightText(song.singer || "Unknown singer", query));

  main.append(title, singer);

  const side = document.createElement("div");
  side.className = "song-side";

  const actionRow = document.createElement("div");
  actionRow.className = "song-actions";

  const queueButton = document.createElement("span");
  queueButton.className = "queue-button";
  queueButton.title = "Add to queue";
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
  queueNote.textContent = queueStatus?.message || "";

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
    loadSelectedSongs(true);
  } else {
    queryInput.focus();
  }
}

async function sendRemoteCommand(cmd, cmdValue, button) {
  if (!cmd || button?.disabled) return;

  const label = COMMAND_LABELS[cmd] || cmd;
  button?.classList.add("is-busy");
  if (button) button.disabled = true;

  try {
    await sendCommand(cmd, cmdValue);
    statusEl.textContent = `${label} sent`;
  } catch (error) {
    statusEl.textContent = `${label} failed`;
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

    const count = Number(response.number || 0);
    queueCountEl.textContent = Number.isFinite(count) ? String(count) : "0";

    if (fullList || response.songList !== undefined || count === 0) {
      if (response.songList !== undefined || count === 0) {
        state.selectedSongs = parseSelectedSongs(response.songList);
      }
      renderSelectedSongs(count);
    }
  } catch (error) {
    if (state.activeView === "queue") {
      queueSummaryEl.textContent = "Unable to load selected songs";
    }
    console.error(error);
  }
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
      title: String(song.sONGNAME ?? song.title ?? "Untitled"),
      singer: String(song.sINGER ?? song.singer ?? "")
    }));
  } catch (error) {
    console.error(error);
    return [];
  }
}

function renderSelectedSongs(remoteCount = state.selectedSongs.length) {
  const count = Number.isFinite(remoteCount) ? remoteCount : state.selectedSongs.length;
  const label = count === 1 ? "song" : "songs";
  queueSummaryEl.textContent = `${count} selected ${label}`;
  queueEmptyEl.hidden = state.selectedSongs.length !== 0;
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
  title.textContent = song.title;

  const singer = document.createElement("span");
  singer.className = "queue-singer";
  singer.textContent = song.singer || "Unknown singer";

  main.append(title, singer);

  const actions = document.createElement("div");
  actions.className = "queue-row-actions";

  const next = document.createElement("button");
  next.className = "small-button";
  next.type = "button";
  next.dataset.queueAction = "next";
  next.disabled = !song.rowId || state.queueBusy;
  next.textContent = "Next";

  const remove = document.createElement("button");
  remove.className = "small-button danger";
  remove.type = "button";
  remove.dataset.queueAction = "remove";
  remove.disabled = !song.rowId || state.queueBusy;
  remove.textContent = "Remove";

  actions.append(next, remove);
  li.append(ordinal, main, actions);
  return li;
}

async function promoteSelectedSong(rowId) {
  await runQueueMutation("Pro2", rowId, "Moved next");
}

async function removeSelectedSong(rowId) {
  await runQueueMutation("Del1", rowId, "Removed");
}

async function runQueueMutation(cmd, rowId, successText) {
  if (state.queueBusy) return;

  state.queueBusy = true;
  renderSelectedSongs();

  try {
    await sendCommand(cmd, rowId);
    statusEl.textContent = successText;
  } catch (error) {
    statusEl.textContent = `${successText} failed`;
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
    statusEl.textContent = "Need at least two selected songs";
    return;
  }

  state.queueBusy = true;
  renderSelectedSongs();

  try {
    const shuffled = shuffle(candidates);
    const promoteOrder = [...shuffled].reverse();

    for (let index = 0; index < promoteOrder.length; index += 1) {
      statusEl.textContent = `Randomizing ${index + 1}/${promoteOrder.length}`;
      await sendCommand("Pro2", promoteOrder[index].rowId);
    }

    statusEl.textContent = "Randomized selected songs";
  } catch (error) {
    statusEl.textContent = "Randomize failed";
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

  setQueueStatus(songId, "pending", "Sending", currentCount);

  try {
    await sendCommand(ADD_COMMAND, song.id);
    setQueueStatus(songId, "queued", queueMessage(nextCount), nextCount);
    statusEl.textContent = `${queueMessage(nextCount)}: ${song.title}`;
  } catch (error) {
    setQueueStatus(songId, "error", failMessage(currentCount), currentCount);
    statusEl.textContent = `Queue failed: ${song.title}`;
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

function setQueueStatus(songId, status, message, count = 0) {
  state.queueState.set(songId, { status, message, count });
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

function queueMessage(count) {
  return count > 1 ? `Queued x${count}` : "Queued";
}

function failMessage(count) {
  return count > 0 ? `Failed; queued x${count}` : "Failed";
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
