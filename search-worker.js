/* global KTV_SONGS, KTV_SONGS_META */

const CJK_RE = /[\u3400-\u9fff]/;
const TAG_RE = /\b(hd|mtv|live|diy|dj|dvd|mp3)\b/gi;

let records = [];

try {
  importScripts(`data/songs.js?v=${Date.now()}`);
  records = (self.KTV_SONGS || KTV_SONGS).map(makeRecord);
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
  const limit = clamp(Number(message.limit) || 80, 10, 200);
  const mode = message.mode || "all";
  const results = search(query, mode, limit);
  const elapsedMs = performance.now() - started;

  self.postMessage({
    type: "results",
    requestId: message.requestId,
    query,
    mode,
    elapsedMs,
    totalMatches: results.totalMatches,
    results: results.items
  });
});

function makeRecord(row, index) {
  const id = String(row.id || "");
  const title = String(row.title || "");
  const singer = String(row.singer || "");
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
    titleNorm,
    singerNorm,
    titleCompact,
    singerCompact,
    haystack,
    haystackCompact,
    tags: extractTags(title)
  };
}

function search(rawQuery, mode, limit) {
  if (!rawQuery) {
    return {
      totalMatches: records.length,
      items: records.slice(0, limit).map(publicSong)
    };
  }

  const query = makeQuery(rawQuery);
  const matches = [];
  let totalMatches = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const score = scoreRecord(record, query, mode);
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
    totalMatches,
    items: matches.slice(0, limit).map((item) => publicSong(item.record, item.score))
  };
}

function scoreRecord(record, query, mode) {
  let best = 0;

  if (mode === "all" || mode === "title") {
    best = Math.max(best, scoreText(record.titleNorm, record.titleCompact, query, 1));
  }

  if (mode === "all" || mode === "singer") {
    best = Math.max(best, scoreText(record.singerNorm, record.singerCompact, query, 0.94));
  }

  if (mode === "all") {
    best = Math.max(best, scoreText(record.haystack, record.haystackCompact, query, 0.7));
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

  if (query.hasCjk) {
    const cjkScore = scoreCjk(textCompact, query.chars);
    score = Math.max(score, cjkScore);
  }

  if (query.compact.length >= 3) {
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

function makeQuery(raw) {
  const norm = normalize(raw);
  const compactValue = compact(norm);
  return {
    raw,
    norm,
    compact: compactValue,
    tokens: norm.split(" ").filter(Boolean),
    chars: [...compactValue],
    hasCjk: CJK_RE.test(raw)
  };
}

function normalize(value) {
  return String(value || "")
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

function compact(value) {
  return String(value || "").replace(/\s+/g, "");
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
    id: record.id,
    title: record.title,
    singer: record.singer,
    tags: record.tags,
    score: Math.round(score)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
