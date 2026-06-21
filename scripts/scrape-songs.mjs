import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

const DEFAULT_HOST = "";
const DEFAULT_DB_PATH = resolve(appRoot, "data/songs.db");
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_RETRIES = 3;
const INSERT_CHUNK_SIZE = 400;

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const startedAt = Date.now();
const rows = await scrapeSongs(options);
const uniqueRows = dedupeSongs(rows);

console.log(`Fetched ${rows.length.toLocaleString()} rows, ${uniqueRows.length.toLocaleString()} unique songs`);

if (options.dryRun) {
  console.log("Dry run only; database was not changed");
  process.exit(0);
}

writeSongDatabase(uniqueRows, options.dbPath, {
  host: options.host,
  fetchedRows: rows.length,
  uniqueRows: uniqueRows.length,
  scrapedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt
});

console.log(`Wrote ${uniqueRows.length.toLocaleString()} songs to ${options.dbPath}`);

async function scrapeSongs(config) {
  const firstPage = await fetchPage(config.startPage, config);
  const serverMaxPage = firstPage.maxPage;
  const endPage = Math.min(
    config.endPage ?? serverMaxPage,
    config.limitPages ? config.startPage + config.limitPages - 1 : serverMaxPage
  );

  if (endPage < config.startPage) return [];

  const pages = new Map([[firstPage.page, firstPage.rows]]);
  const pendingPages = [];
  for (let page = config.startPage; page <= endPage; page += 1) {
    if (page !== firstPage.page) pendingPages.push(page);
  }

  console.log([
    `Scraping pages ${config.startPage}-${endPage}`,
    `server max page ${serverMaxPage}`,
    `concurrency ${config.concurrency}`
  ].join("; "));

  let completed = 1;
  let nextIndex = 0;

  async function worker(workerId) {
    while (nextIndex < pendingPages.length) {
      const page = pendingPages[nextIndex];
      nextIndex += 1;

      const result = await fetchPage(page, config);
      pages.set(result.page, result.rows);
      completed += 1;

      if (completed === 1 || completed % config.progressEvery === 0 || completed === endPage - config.startPage + 1) {
        const percent = ((completed / (endPage - config.startPage + 1)) * 100).toFixed(1);
        console.log(`Fetched ${completed.toLocaleString()} pages (${percent}%)`);
      }
    }
  }

  const workerCount = Math.min(config.concurrency, Math.max(pendingPages.length, 1));
  await Promise.all(Array.from({ length: workerCount }, (_, index) => worker(index)));

  const rows = [];
  for (let page = config.startPage; page <= endPage; page += 1) {
    rows.push(...(pages.get(page) || []));
  }

  return rows;
}

async function fetchPage(page, config) {
  const url = new URL("/demo/SearchServlet", config.host);
  url.search = new URLSearchParams({
    page: String(page),
    songName: "",
    songType: "",
    singer: "",
    lang: "",
    sortType: "",
    jsonpCallback: " "
  }).toString();

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const payload = parseJsonp(await response.text());
      const rows = JSON.parse(payload.songList || "[]").map((song) => ({
        id: String(song.sONGBM ?? song.id ?? "").trim(),
        title: String(song.sONGNAME ?? song.title ?? ""),
        singer: String(song.sINGER ?? song.singer ?? "")
      })).filter((song) => song.id);

      return {
        page: Number.parseInt(payload.page ?? page, 10),
        maxPage: Number.parseInt(payload.maxPage ?? page, 10),
        rows
      };
    } catch (error) {
      if (attempt >= config.retries) {
        throw new Error(`Failed to fetch page ${page}: ${error.message}`);
      }

      const delayMs = 350 * 2 ** attempt;
      console.warn(`Page ${page} failed (${error.message}); retrying in ${delayMs}ms`);
      await delay(delayMs);
    }
  }

  throw new Error(`Failed to fetch page ${page}`);
}

function parseJsonp(text) {
  const body = String(text || "").trim();
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error("SearchServlet returned an invalid JSONP payload");
  }

  return JSON.parse(body.slice(firstBrace, lastBrace + 1));
}

function dedupeSongs(rows) {
  const songs = new Map();

  for (const row of rows) {
    if (!row.id || songs.has(row.id)) continue;
    songs.set(row.id, row);
  }

  return [...songs.values()];
}

function writeSongDatabase(rows, dbPath, meta) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const tempDir = mkdtempSync(resolve(tmpdir(), "ktv-songs-"));
  const sqlPath = resolve(tempDir, "songs.sql");

  try {
    writeFileSync(sqlPath, buildSql(rows, meta), "utf8");
    const result = spawnSync("sqlite3", [dbPath], {
      input: `.read ${sqlPath}\n`,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024
    });

    if (result.status !== 0) {
      throw new Error([
        "sqlite3 failed",
        result.stderr.trim(),
        result.stdout.trim()
      ].filter(Boolean).join("\n"));
    }
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

function buildSql(rows, meta) {
  const lines = [
    ".bail on",
    "PRAGMA foreign_keys = OFF;",
    "PRAGMA journal_mode = WAL;",
    "PRAGMA synchronous = NORMAL;",
    "BEGIN IMMEDIATE;",
    "DROP TABLE IF EXISTS songs_next;",
    "CREATE TABLE songs_next (id TEXT PRIMARY KEY, title TEXT, singer TEXT);"
  ];

  for (let index = 0; index < rows.length; index += INSERT_CHUNK_SIZE) {
    const values = rows
      .slice(index, index + INSERT_CHUNK_SIZE)
      .map((row) => `(${sqlQuote(row.id)}, ${sqlQuote(row.title)}, ${sqlQuote(row.singer)})`)
      .join(",\n");
    lines.push(`INSERT INTO songs_next (id, title, singer) VALUES\n${values};`);
  }

  lines.push(
    "DROP TABLE IF EXISTS songs;",
    "ALTER TABLE songs_next RENAME TO songs;",
    "CREATE INDEX IF NOT EXISTS idx_songs_title ON songs(title);",
    "CREATE INDEX IF NOT EXISTS idx_songs_singer ON songs(singer);",
    "CREATE TABLE IF NOT EXISTS scrape_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
  );

  Object.entries(meta).forEach(([key, value]) => {
    lines.push([
      "INSERT INTO scrape_meta (key, value)",
      `VALUES (${sqlQuote(key)}, ${sqlQuote(String(value))})`,
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
    ].join(" "));
  });

  lines.push(
    "COMMIT;",
    "PRAGMA wal_checkpoint(TRUNCATE);"
  );

  return `${lines.join("\n")}\n`;
}

function sqlQuote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function parseArgs(args) {
  const config = {
    host: DEFAULT_HOST,
    dbPath: DEFAULT_DB_PATH,
    concurrency: DEFAULT_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    startPage: 0,
    endPage: undefined,
    limitPages: undefined,
    timeoutMs: 12000,
    progressEvery: 250,
    dryRun: false,
    help: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [name, inlineValue] = arg.split("=", 2);
    const nextValue = () => inlineValue ?? args[++index];

    switch (name) {
      case "--help":
      case "-h":
        config.help = true;
        break;
      case "--host":
        config.host = normalizeHost(nextValue());
        break;
      case "--db":
        config.dbPath = resolve(appRoot, nextValue());
        break;
      case "--concurrency":
        config.concurrency = clampNumber(nextValue(), 1, 32, DEFAULT_CONCURRENCY);
        break;
      case "--retries":
        config.retries = clampNumber(nextValue(), 0, 8, DEFAULT_RETRIES);
        break;
      case "--start-page":
        config.startPage = clampNumber(nextValue(), 0, Number.MAX_SAFE_INTEGER, 0);
        break;
      case "--end-page":
        config.endPage = clampNumber(nextValue(), 0, Number.MAX_SAFE_INTEGER, 0);
        break;
      case "--limit-pages":
        config.limitPages = clampNumber(nextValue(), 1, Number.MAX_SAFE_INTEGER, 1);
        break;
      case "--timeout-ms":
        config.timeoutMs = clampNumber(nextValue(), 1000, 120000, 12000);
        break;
      case "--progress-every":
        config.progressEvery = clampNumber(nextValue(), 1, Number.MAX_SAFE_INTEGER, 250);
        break;
      case "--dry-run":
        config.dryRun = true;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!config.help) {
    config.host = normalizeHost(config.host);
  }
  return config;
}

function normalizeHost(value) {
  const rawValue = String(value || "").trim();
  if (!rawValue) {
    throw new Error("--host is required");
  }

  const parsed = new URL(rawValue);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("--host must start with http:// or https://");
  }
  return parsed.origin;
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function delay(ms) {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

function printHelp() {
  console.log(`Usage: npm run scrape:songs -- [options]

Scrape SoundKing SearchServlet into a SQLite database.

Options:
  --host <url>          Song server origin. Required.
  --db <path>           SQLite DB path. Default: data/songs.db
  --concurrency <n>     Concurrent page requests, 1-32. Default: ${DEFAULT_CONCURRENCY}
  --retries <n>         Retries per page. Default: ${DEFAULT_RETRIES}
  --start-page <n>      First server page. Default: 0
  --end-page <n>        Last server page. Default: server maxPage
  --limit-pages <n>     Scrape only n pages, useful for tests
  --timeout-ms <n>      Request timeout. Default: 12000
  --dry-run             Fetch and parse without writing the DB
  --help                Show this message

Examples:
  npm run scrape:songs -- --host https://your-song-server.example --concurrency 12
  npm run scrape:songs -- --host https://your-song-server.example --limit-pages 3 --dry-run
  npm run update:songs -- --host https://your-song-server.example --concurrency 12
`);
}
