import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");

const DEFAULT_HOST = "";
const DEFAULT_DB_PATH = resolve(appRoot, "data/songs.db");
const DEFAULT_IMAGE_DIR = resolve(appRoot, "data/singer-images");
const DEFAULT_CONCURRENCY = 8;
const DEFAULT_IMAGE_CONCURRENCY = 16;
const DEFAULT_RETRIES = 3;
const INSERT_CHUNK_SIZE = 400;
const DEFAULT_SINGER_TYPE = "全部";

const options = parseArgs(process.argv.slice(2));

if (options.help) {
  printHelp();
  process.exit(0);
}

const startedAt = Date.now();
const singers = dedupeSingers(await scrapeSingers(options));

console.log(`Fetched ${singers.length.toLocaleString()} unique singers`);

if (options.dryRun) {
  console.log("Dry run only; database and images were not changed");
  process.exit(0);
}

const storedSingers = await storeSingerImages(singers, options);
writeSingerDatabase(storedSingers, options.dbPath, {
  host: options.host,
  fetchedSingers: singers.length,
  storedSingers: storedSingers.length,
  scrapedAt: new Date().toISOString(),
  elapsedMs: Date.now() - startedAt
});
writeSingerManifest(storedSingers, options.manifestPath);

console.log(`Wrote ${storedSingers.length.toLocaleString()} singer images to ${options.imageDir}`);
console.log(`Updated singer image table in ${options.dbPath}`);

async function scrapeSingers(config) {
  const firstPage = await fetchSingerPage(config.startPage, config);
  const serverMaxPage = firstPage.maxPage;
  const endPage = Math.min(
    config.endPage ?? serverMaxPage,
    config.limitPages ? config.startPage + config.limitPages - 1 : serverMaxPage
  );

  if (endPage < config.startPage) return [];

  const pages = new Map([[firstPage.page, firstPage.singers]]);
  const pendingPages = [];
  for (let page = config.startPage; page <= endPage; page += 1) {
    if (page !== firstPage.page) pendingPages.push(page);
  }

  console.log([
    `Scraping singer pages ${config.startPage}-${endPage}`,
    `server max page ${serverMaxPage}`,
    `concurrency ${config.concurrency}`
  ].join("; "));

  let completed = 1;
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < pendingPages.length) {
      const page = pendingPages[nextIndex];
      nextIndex += 1;

      const result = await fetchSingerPage(page, config);
      pages.set(result.page, result.singers);
      completed += 1;

      if (completed === 1 || completed % config.progressEvery === 0 || completed === endPage - config.startPage + 1) {
        const percent = ((completed / (endPage - config.startPage + 1)) * 100).toFixed(1);
        console.log(`Fetched ${completed.toLocaleString()} singer pages (${percent}%)`);
      }
    }
  }

  const workerCount = Math.min(config.concurrency, Math.max(pendingPages.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  const singers = [];
  for (let page = config.startPage; page <= endPage; page += 1) {
    singers.push(...(pages.get(page) || []));
  }

  return singers;
}

async function fetchSingerPage(page, config) {
  const url = new URL("/demo/SingerServlet", config.host);
  url.search = new URLSearchParams({
    singer: config.singer,
    singerType: config.singerType,
    sortType: config.sortType,
    page: String(page),
    jsonpCallback: " "
  }).toString();

  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const payload = parseJsonp(await response.text(), "SingerServlet");
      const singers = JSON.parse(payload.singerList || "[]").map((singer) => ({
        name: String(singer.name || "").trim(),
        picture: normalizePictureName(singer.picture)
      })).filter((singer) => singer.name && singer.picture);

      return {
        page: Number.parseInt(payload.page ?? page, 10),
        maxPage: Number.parseInt(payload.maxPage ?? page, 10),
        singers
      };
    } catch (error) {
      if (attempt >= config.retries) {
        throw new Error(`Failed to fetch singer page ${page}: ${error.message}`);
      }

      const delayMs = 350 * 2 ** attempt;
      console.warn(`Singer page ${page} failed (${error.message}); retrying in ${delayMs}ms`);
      await delay(delayMs);
    }
  }

  throw new Error(`Failed to fetch singer page ${page}`);
}

async function storeSingerImages(singers, config) {
  mkdirSync(config.imageDir, { recursive: true });

  const stored = [];
  let nextIndex = 0;
  let completed = 0;

  async function worker() {
    while (nextIndex < singers.length) {
      const singer = singers[nextIndex];
      nextIndex += 1;

      try {
        const storedSinger = await storeSingerImage(singer, config);
        if (storedSinger) stored.push(storedSinger);
      } catch (error) {
        console.warn(`Skipping singer image for ${singer.name}: ${error.message}`);
      }

      completed += 1;

      if (completed === 1 || completed % config.progressEvery === 0 || completed === singers.length) {
        const percent = ((completed / singers.length) * 100).toFixed(1);
        console.log(`Stored ${completed.toLocaleString()} singer images (${percent}%)`);
      }
    }
  }

  const workerCount = Math.min(config.imageConcurrency, Math.max(singers.length, 1));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return stored.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans"));
}

async function storeSingerImage(singer, config) {
  const fileName = normalizePictureName(singer.picture);
  if (!fileName) return null;

  const imagePath = resolve(config.imageDir, fileName);
  const imageRelPath = toWebPath(relative(appRoot, imagePath));
  const sourceUrl = new URL(`/demo/singer/${encodeURIComponent(fileName)}`, config.host).toString();

  if (!config.metadataOnly && !(config.skipExistingImages && existsSync(imagePath))) {
    const bytes = await fetchImage(sourceUrl, config);
    await writeFile(imagePath, bytes);
  }

  return {
    name: singer.name,
    picture: fileName,
    imagePath: imageRelPath,
    sourceUrl
  };
}

async function fetchImage(url, config) {
  for (let attempt = 0; attempt <= config.retries; attempt += 1) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(config.timeoutMs)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const contentType = response.headers.get("content-type") || "";
      if (!contentType.startsWith("image/")) {
        throw new Error(`Unexpected content type ${contentType || "unknown"}`);
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (error) {
      if (attempt >= config.retries) {
        throw new Error(`Failed to fetch singer image ${url}: ${error.message}`);
      }

      const delayMs = 250 * 2 ** attempt;
      await delay(delayMs);
    }
  }

  throw new Error(`Failed to fetch singer image ${url}`);
}

function writeSingerDatabase(singers, dbPath, meta) {
  mkdirSync(dirname(dbPath), { recursive: true });

  const tempDir = mkdtempSync(resolve(tmpdir(), "ktv-singers-"));
  const sqlPath = resolve(tempDir, "singers.sql");

  try {
    writeFileSync(sqlPath, buildSql(singers, meta), "utf8");
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

function buildSql(singers, meta) {
  const lines = [
    ".bail on",
    "PRAGMA foreign_keys = OFF;",
    "PRAGMA journal_mode = WAL;",
    "PRAGMA synchronous = NORMAL;",
    "BEGIN IMMEDIATE;",
    "DROP TABLE IF EXISTS singer_images_next;",
    [
      "CREATE TABLE singer_images_next (",
      "name TEXT PRIMARY KEY,",
      "picture TEXT NOT NULL,",
      "image_path TEXT NOT NULL,",
      "source_url TEXT NOT NULL",
      ");"
    ].join(" ")
  ];

  for (let index = 0; index < singers.length; index += INSERT_CHUNK_SIZE) {
    const values = singers
      .slice(index, index + INSERT_CHUNK_SIZE)
      .map((singer) => [
        sqlQuote(singer.name),
        sqlQuote(singer.picture),
        sqlQuote(singer.imagePath),
        sqlQuote(singer.sourceUrl)
      ].join(", "))
      .map((value) => `(${value})`)
      .join(",\n");
    lines.push(`INSERT INTO singer_images_next (name, picture, image_path, source_url) VALUES\n${values};`);
  }

  lines.push(
    "DROP TABLE IF EXISTS singer_images;",
    "ALTER TABLE singer_images_next RENAME TO singer_images;",
    "CREATE INDEX IF NOT EXISTS idx_singer_images_picture ON singer_images(picture);",
    "CREATE TABLE IF NOT EXISTS scrape_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);"
  );

  Object.entries(meta).forEach(([key, value]) => {
    lines.push([
      "INSERT INTO scrape_meta (key, value)",
      `VALUES (${sqlQuote(`singers.${key}`)}, ${sqlQuote(String(value))})`,
      "ON CONFLICT(key) DO UPDATE SET value = excluded.value;"
    ].join(" "));
  });

  lines.push(
    "COMMIT;",
    "PRAGMA wal_checkpoint(TRUNCATE);"
  );

  return `${lines.join("\n")}\n`;
}

function writeSingerManifest(singers, manifestPath) {
  mkdirSync(dirname(manifestPath), { recursive: true });

  const images = Object.fromEntries(singers.map((singer) => [singer.name, singer.imagePath]));
  const payload = [
    `self.KTV_SINGER_IMAGES_META = ${JSON.stringify({
      generatedAt: new Date().toISOString(),
      count: singers.length
    })};`,
    `self.KTV_SINGER_IMAGES = ${JSON.stringify(images)};`,
    ""
  ].join("\n");

  writeFileSync(manifestPath, payload, "utf8");
}

function dedupeSingers(singers) {
  const unique = new Map();

  for (const singer of singers) {
    const key = singer.name.trim().toLowerCase();
    if (!key || unique.has(key)) continue;
    unique.set(key, singer);
  }

  return [...unique.values()];
}

function normalizePictureName(value) {
  const name = basename(String(value || "").trim());
  if (!name || name === "." || name === "..") return "";

  const extension = extname(name).toLowerCase();
  if (![".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(extension)) return "";

  return name.replace(/[^a-zA-Z0-9._-]/g, "");
}

function parseJsonp(text, sourceName) {
  const body = String(text || "").trim();
  const firstBrace = body.indexOf("{");
  const lastBrace = body.lastIndexOf("}");

  if (firstBrace < 0 || lastBrace <= firstBrace) {
    throw new Error(`${sourceName} returned an invalid JSONP payload`);
  }

  return JSON.parse(body.slice(firstBrace, lastBrace + 1));
}

function sqlQuote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function toWebPath(value) {
  return value.split(sep).join("/");
}

function parseArgs(args) {
  const config = {
    host: DEFAULT_HOST,
    dbPath: DEFAULT_DB_PATH,
    imageDir: DEFAULT_IMAGE_DIR,
    manifestPath: resolve(appRoot, "data/singers.js"),
    concurrency: DEFAULT_CONCURRENCY,
    imageConcurrency: DEFAULT_IMAGE_CONCURRENCY,
    retries: DEFAULT_RETRIES,
    startPage: 0,
    endPage: undefined,
    limitPages: undefined,
    timeoutMs: 12000,
    progressEvery: 250,
    singer: "",
    singerType: DEFAULT_SINGER_TYPE,
    sortType: "",
    skipExistingImages: true,
    metadataOnly: false,
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
      case "--image-dir":
        config.imageDir = resolve(appRoot, nextValue());
        break;
      case "--manifest":
        config.manifestPath = resolve(appRoot, nextValue());
        break;
      case "--concurrency":
        config.concurrency = clampNumber(nextValue(), 1, 32, DEFAULT_CONCURRENCY);
        break;
      case "--image-concurrency":
        config.imageConcurrency = clampNumber(nextValue(), 1, 64, DEFAULT_IMAGE_CONCURRENCY);
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
      case "--singer":
        config.singer = nextValue() || "";
        break;
      case "--singer-type":
        config.singerType = nextValue() || "";
        break;
      case "--sort-type":
        config.sortType = nextValue() || "";
        break;
      case "--no-skip-existing-images":
        config.skipExistingImages = false;
        break;
      case "--metadata-only":
        config.metadataOnly = true;
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
  console.log(`Usage: npm run scrape:singers -- [options]

Scrape SoundKing SingerServlet metadata and singer image files.

Options:
  --host <url>              Song server origin. Required.
  --db <path>               SQLite DB path. Default: data/songs.db
  --image-dir <path>        Image output directory. Default: data/singer-images
  --manifest <path>         Static manifest output. Default: data/singers.js
  --concurrency <n>         Concurrent SingerServlet page requests. Default: ${DEFAULT_CONCURRENCY}
  --image-concurrency <n>   Concurrent image downloads. Default: ${DEFAULT_IMAGE_CONCURRENCY}
  --retries <n>             Retries per request. Default: ${DEFAULT_RETRIES}
  --start-page <n>          First SingerServlet page. Default: 0
  --end-page <n>            Last SingerServlet page. Default: server maxPage
  --limit-pages <n>         Scrape only n pages, useful for tests
  --singer <name>           Singer search query. Default: empty
  --singer-type <type>      Singer type. Default: ${DEFAULT_SINGER_TYPE}
  --sort-type <type>        Sort type, e.g. TopBySinger
  --metadata-only           Update DB/manifest without downloading image files
  --no-skip-existing-images Re-download existing image files
  --dry-run                 Fetch and parse without writing DB or images
  --help                    Show this message

Examples:
  npm run scrape:singers -- --host https://your-song-server.example --concurrency 12
  npm run scrape:singers -- --host https://your-song-server.example --limit-pages 2 --dry-run
  npm run scrape:singers -- --host https://your-song-server.example --singer 林忆莲 --limit-pages 1
`);
}
