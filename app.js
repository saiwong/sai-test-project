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

const state = {
  ready: false,
  mode: "all",
  query: "",
  pendingTimer: 0,
  requestId: 0,
  lastResults: []
};

const worker = new Worker(`search-worker.js?v=${Date.now()}`);

worker.addEventListener("message", (event) => {
  const message = event.data;

  if (message.type === "ready") {
    state.ready = true;
    songCountEl.textContent = message.count.toLocaleString();
    statusEl.textContent = "Ready";
    resultsBand.setAttribute("aria-busy", "false");
    searchNow();
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
  state.lastResults = message.results;

  if (query) {
    const label = total === 1 ? "match" : "matches";
    resultSummaryEl.textContent = `${total.toLocaleString()} ${label}`;
  } else {
    resultSummaryEl.textContent = `Showing ${shown.toLocaleString()} songs`;
  }

  elapsedEl.textContent = `${message.elapsedMs.toFixed(0)} ms`;
  emptyStateEl.hidden = shown !== 0;
  resultsEl.replaceChildren(...message.results.map((song) => renderSong(song, query)));
}

function renderSong(song, query) {
  const li = document.createElement("li");
  li.className = "result-item";

  const main = document.createElement("div");
  main.className = "song-main";

  const title = document.createElement("span");
  title.className = "song-title";
  title.append(...highlightText(song.title, query));

  const singer = document.createElement("span");
  singer.className = "song-singer";
  singer.append(...highlightText(song.singer || "Unknown singer", query));

  main.append(title, singer);

  const tags = document.createElement("span");
  tags.className = "tags";
  song.tags.forEach((tag) => {
    const item = document.createElement("span");
    item.className = "tag";
    item.textContent = tag;
    tags.append(item);
  });

  li.append(main, tags);
  return li;
}

function highlightText(text, query) {
  const source = String(text || "");
  if (!query) return [document.createTextNode(source)];

  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return [document.createTextNode(source)];

  const lower = source.toLowerCase();
  const index = lower.indexOf(normalizedQuery);
  if (index < 0) return [document.createTextNode(source)];

  const before = document.createTextNode(source.slice(0, index));
  const mark = document.createElement("mark");
  mark.textContent = source.slice(index, index + normalizedQuery.length);
  const after = document.createTextNode(source.slice(index + normalizedQuery.length));
  return [before, mark, after];
}
