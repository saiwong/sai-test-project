import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const dbPath = resolve(process.argv[2] || resolve(appRoot, "data/songs.db"));
const outPath = resolve(appRoot, "data/songs.js");

const sql = `
  select
    cast(id as text) as id,
    coalesce(title, '') as title,
    coalesce(singer, '') as singer
  from songs
  order by rowid
`;

const json = execFileSync("sqlite3", ["-json", dbPath, sql], {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024
});

const rows = JSON.parse(json);
mkdirSync(dirname(outPath), { recursive: true });

const generatedAt = new Date().toISOString();
const payload = [
  `self.KTV_SONGS_META = ${JSON.stringify({ generatedAt, source: dbPath, count: rows.length })};`,
  `self.KTV_SONGS = ${JSON.stringify(rows)};`,
  ""
].join("\n");

writeFileSync(outPath, payload, "utf8");
console.log(`Wrote ${rows.length.toLocaleString()} songs to ${outPath}`);
