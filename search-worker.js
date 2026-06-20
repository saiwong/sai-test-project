/* global KTV_SONGS, KTV_SONGS_META */

const CJK_RE = /[\u3400-\u9fff]/;
const TAG_RE = /\b(hd|mtv|live|diy|dj|dvd|mp3)\b/gi;

let records = [];
let singerGroups = [];
let T2S_MAP = {};

try {
  importScripts(`data/t2s-map.js?v=${Date.now()}`);
  importScripts(`data/songs.js?v=${Date.now()}`);
  T2S_MAP = self.KTV_T2S_MAP || {};
  records = (self.KTV_SONGS || KTV_SONGS).map(makeRecord);
  singerGroups = buildSingerGroups(records);
  self.postMessage({
    type: "ready",
    count: records.length,
    meta: self.KTV_SONGS_META || KTV_SONGS_META || {}
  });
} catch (error) {
  self.postMessage({
    type: "error",
    message: "Could not load data/songs.js",
    detail: String(error && error.message ? error.message : error)
  });
}

self.addEventListener("message", (event) => {
  const message = event.data;
  if (message.type !== "search") return;

  const started = performance.now();
  const query = String(message.query || "").trim();
  const limit = clamp(Number(message.limit) || 80, 10, 500);
  const mode = message.mode || "all";
  const singerFilter = String(message.singerFilter || "").trim();
  const artistAliases = normalizeAliasList(message.artistAliases);
  const results = search(query, mode, limit, singerFilter, artistAliases);
  const elapsedMs = performance.now() - started;

  self.postMessage({
    type: "results",
    requestId: message.requestId,
    query,
    mode,
    normalizedQuery: results.normalizedQuery,
    singerFilter: results.singerFilter,
    elapsedMs,
    totalMatches: results.totalMatches,
    totalSingerMatches: results.totalSingerMatches,
    artistAliases: results.artistAliases,
    singers: results.singers,
    results: results.items
  });
});

function makeRecord(row, index) {
  const id = String(row.id || "");
  const title = String(row.title || "");
  const singer = String(row.singer || "");
  const singerNames = splitSingers(singer);
  const titleNorm = normalize(title);
  const singerNorm = normalize(singer);
  const titleCompact = compact(titleNorm);
  const singerCompact = compact(singerNorm);
  const haystack = `${titleNorm} ${singerNorm}`.trim();
  const haystackCompact = compact(haystack);

  return {
    index,
    id,
    title,
    singer,
    singerNames,
    titleNorm,
    singerNorm,
    titleCompact,
    singerCompact,
    haystack,
    haystackCompact,
    tags: extractTags(title)
  };
}

function buildSingerGroups(items) {
  const groups = new Map();

  for (const record of items) {
    for (const name of record.singerNames) {
      const norm = normalize(name);
      const key = compact(norm);
      if (!key) continue;

      let group = groups.get(key);
      if (!group) {
        group = {
          key,
          name,
          norm,
          compact: key,
          count: 0,
          firstIndex: record.index,
          records: []
        };
        groups.set(key, group);
      }

      group.count += 1;
      group.records.push(record);
      group.firstIndex = Math.min(group.firstIndex, record.index);
    }
  }

  return [...groups.values()].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.firstIndex - b.firstIndex;
  });
}

function findSingerGroup(query) {
  let best = null;
  let bestScore = 0;

  for (const group of singerGroups) {
    if (group.compact === query.compact) return group;

    const score = scoreText(group.norm, group.compact, query, 1);
    if (score > bestScore) {
      best = group;
      bestScore = score;
    }
  }

  return bestScore > 0 ? best : null;
}

function search(rawQuery, mode, limit, singerFilter = "", artistAliases = []) {
  if (singerFilter) {
    return searchBySingerFilter(singerFilter, limit);
  }

  if (!rawQuery) {
    if (mode === "singer") {
      const singers = singerGroups.slice(0, limit).map(publicSinger);
      return {
        normalizedQuery: "",
        singerFilter: "",
        artistAliases: [],
        totalMatches: 0,
        totalSingerMatches: singerGroups.length,
        singers,
        items: []
      };
    }

    return {
      normalizedQuery: "",
      singerFilter: "",
      artistAliases: [],
      totalMatches: records.length,
      totalSingerMatches: 0,
      singers: [],
      items: records.slice(0, limit).map(publicSong)
    };
  }

  const queries = makeQueryVariants(rawQuery, artistAliases);
  const query = queries[0] || makeQuery(rawQuery);
  const shouldIncludeSingers = mode === "singer" || (mode === "all" && artistAliases.length > 0);
  const singers = shouldIncludeSingers ? searchSingers(queries, Math.min(limit, 40)) : {
    totalMatches: 0,
    items: []
  };
  const matches = [];
  let totalMatches = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const score = scoreRecord(record, queries, mode);
    if (score <= 0) continue;

    totalMatches += 1;
    matches.push({ record, score });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const titleDelta = a.record.title.length - b.record.title.length;
    if (titleDelta !== 0) return titleDelta;
    return a.record.index - b.record.index;
  });

  return {
    normalizedQuery: query.norm,
    singerFilter: "",
    artistAliases,
    totalMatches,
    totalSingerMatches: singers.totalMatches,
    singers: singers.items,
    items: matches.slice(0, limit).map((item) => publicSong(item.record, item.score))
  };
}

function searchBySingerFilter(rawSinger, limit) {
  const query = makeQuery(rawSinger);
  const group = findSingerGroup(query);
  const items = group
    ? group.records.slice(0, limit).map((record) => publicSong(record, 1000))
    : [];

  return {
    normalizedQuery: query.norm,
    singerFilter: group?.name || rawSinger,
    artistAliases: [],
    totalMatches: group?.records.length || 0,
    totalSingerMatches: 0,
    singers: [],
    items
  };
}

function searchSingers(queries, limit) {
  const matches = [];
  let totalMatches = 0;

  for (const group of singerGroups) {
    const score = scoreSingerGroup(group, queries);
    if (score <= 0) continue;

    totalMatches += 1;
    matches.push({ group, score });
  }

  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (b.group.count !== a.group.count) return b.group.count - a.group.count;
    return a.group.firstIndex - b.group.firstIndex;
  });

  return {
    totalMatches,
    items: matches.slice(0, limit).map((item) => publicSinger(item.group, item.score))
  };
}

function scoreSingerGroup(group, queries) {
  let best = 0;

  for (const query of queries) {
    best = Math.max(best, scoreText(group.norm, group.compact, query, 1));
  }

  return best;
}

function scoreRecord(record, queries, mode) {
  let best = 0;

  for (const query of queries) {
    if (mode === "all" || mode === "title") {
      best = Math.max(best, scoreText(record.titleNorm, record.titleCompact, query, 1));
    }

    if (mode === "all" || mode === "singer") {
      best = Math.max(best, scoreText(record.singerNorm, record.singerCompact, query, 0.94));
    }

    if (mode === "all") {
      best = Math.max(best, scoreText(record.haystack, record.haystackCompact, query, 0.7));
    }
  }

  return best;
}

function scoreText(textNorm, textCompact, query, weight) {
  if (!textCompact || !query.compact) return 0;

  let score = 0;

  if (textCompact === query.compact) {
    score = 930;
  } else if (textCompact.startsWith(query.compact)) {
    score = 850 - Math.min(textCompact.length - query.compact.length, 120);
  } else {
    const compactIndex = textCompact.indexOf(query.compact);
    if (compactIndex >= 0) {
      score = Math.max(score, 760 - Math.min(compactIndex * 5, 180));
    }
  }

  if (query.tokens.length > 0) {
    const tokenScore = scoreTokens(textNorm, textCompact, query.tokens);
    score = Math.max(score, tokenScore);
  }

  if (!query.strict && query.hasCjk) {
    const cjkScore = scoreCjk(textCompact, query.chars);
    score = Math.max(score, cjkScore);
  }

  if (!query.strict && query.compact.length >= 3) {
    const fuzzy = subsequenceScore(query.compact, textCompact);
    score = Math.max(score, fuzzy);
  }

  return score * weight;
}

function scoreTokens(textNorm, textCompact, tokens) {
  let total = 0;
  let matched = 0;

  for (const token of tokens) {
    const tokenCompact = compact(token);
    if (!tokenCompact) continue;

    if (textCompact.startsWith(tokenCompact)) {
      total += 190;
      matched += 1;
    } else if (textNorm.includes(token)) {
      total += 160;
      matched += 1;
    } else if (textCompact.includes(tokenCompact)) {
      total += 140;
      matched += 1;
    } else {
      const fuzzy = tokenCompact.length >= 3 ? subsequenceScore(tokenCompact, textCompact) : 0;
      if (fuzzy > 0) {
        total += Math.min(fuzzy, 110);
        matched += 1;
      }
    }
  }

  if (matched === 0) return 0;
  if (tokens.length > 1 && matched < tokens.length) return 0;

  const coverage = matched / tokens.length;
  return 430 + total * coverage;
}

function scoreCjk(textCompact, chars) {
  if (chars.length === 0) return 0;
  if (chars.length <= 2) {
    return textCompact.includes(chars.join("")) ? 720 : 0;
  }

  let matched = 0;
  const uniqueChars = [...new Set(chars)];
  for (const char of uniqueChars) {
    if (textCompact.includes(char)) matched += 1;
  }

  const coverage = matched / uniqueChars.length;
  if (coverage < 0.5) return 0;

  const sequence = subsequenceScore(chars.join(""), textCompact);
  return Math.max(360 + coverage * 260, sequence);
}

function subsequenceScore(needle, haystack) {
  let pos = -1;
  let first = -1;
  let last = -1;
  let gaps = 0;

  for (const char of needle) {
    const next = haystack.indexOf(char, pos + 1);
    if (next < 0) return 0;
    if (first < 0) first = next;
    if (pos >= 0 && next > pos + 1) gaps += next - pos - 1;
    pos = next;
    last = next;
  }

  const span = Math.max(last - first + 1, 1);
  const density = needle.length / span;
  const base = 370 + density * 210;
  const gapPenalty = Math.min(gaps * 5, 180);
  return Math.max(0, base - gapPenalty);
}

function makeQueryVariants(rawQuery, artistAliases = []) {
  const variants = [];
  const seen = new Set();

  for (const [index, raw] of [rawQuery, ...artistAliases].entries()) {
    const query = makeQuery(raw, { strict: index > 0 });
    if (!query.compact || seen.has(query.compact)) continue;

    seen.add(query.compact);
    variants.push(query);
  }

  return variants;
}

function normalizeAliasList(values) {
  const aliases = [];
  const seen = new Set();

  for (const value of Array.isArray(values) ? values : []) {
    const raw = String(value || "").trim();
    const query = makeQuery(raw);
    if (!raw || !query.compact || seen.has(query.compact)) continue;

    seen.add(query.compact);
    aliases.push(raw);
    if (aliases.length >= 8) break;
  }

  return aliases;
}

function makeQuery(raw, options = {}) {
  const norm = normalize(raw);
  const compactValue = compact(norm);
  return {
    raw,
    norm,
    compact: compactValue,
    tokens: norm.split(" ").filter(Boolean),
    chars: [...compactValue],
    hasCjk: CJK_RE.test(raw),
    strict: Boolean(options.strict)
  };
}

function normalize(value) {
  return toSimplified(String(value || ""))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/&/g, " and ")
    .toLowerCase()
    .replace(/[^\w\u3400-\u9fff]+/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toSimplified(value) {
  let output = "";
  for (const char of String(value || "")) {
    output += T2S_MAP[char] || char;
  }
  return output;
}

function compact(value) {
  return String(value || "").replace(/\s+/g, "");
}

function splitSingers(value) {
  return String(value || "")
    .split(/[,，、/&+;；]+/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractTags(title) {
  const found = new Set();
  let match;
  while ((match = TAG_RE.exec(title)) !== null) {
    found.add(match[1].toUpperCase());
    if (found.size >= 3) break;
  }
  return [...found];
}

function publicSong(record, score = 0) {
  return {
    type: "song",
    id: record.id,
    title: record.title,
    singer: record.singer,
    tags: record.tags,
    score: Math.round(score)
  };
}

function publicSinger(group, score = 0) {
  return {
    type: "singer",
    name: group.name,
    count: group.count,
    score: Math.round(score)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
