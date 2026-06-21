import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(here, "..");
const dbPath = resolve(process.argv[2] || resolve(appRoot, "data/songs.db"));
const outPath = resolve(appRoot, "data/songs.js");
const singersOutPath = resolve(appRoot, "data/singers.js");
const dbSource = toRepoPath(dbPath);

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
  `self.KTV_SONGS_META = ${JSON.stringify({ generatedAt, source: dbSource, count: rows.length })};`,
  `self.KTV_SONGS = ${JSON.stringify(rows)};`,
  ""
].join("\n");

writeFileSync(outPath, payload, "utf8");
console.log(`Wrote ${rows.length.toLocaleString()} songs to ${outPath}`);

const singerImages = readSingerImages(dbPath);
const singerPayload = [
  `self.KTV_SINGER_IMAGES_META = ${JSON.stringify({ generatedAt, source: dbSource, count: singerImages.length })};`,
  `self.KTV_SINGER_IMAGES = ${JSON.stringify(Object.fromEntries(singerImages.map((row) => [row.name, row.image_path])))};`,
  ""
].join("\n");

writeFileSync(singersOutPath, singerPayload, "utf8");
console.log(`Wrote ${singerImages.length.toLocaleString()} singer images to ${singersOutPath}`);

function readSingerImages(path) {
  if (!tableExists(path, "singer_images")) return [];

  const output = execFileSync("sqlite3", ["-json", path, `
    select
      name,
      image_path
    from singer_images
    where coalesce(name, '') <> ''
      and coalesce(image_path, '') <> ''
    order by name
  `], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024
  });

  return JSON.parse(output);
}

function tableExists(path, tableName) {
  try {
    const output = execFileSync("sqlite3", ["-json", path, `
      select 1 as found
      from sqlite_master
      where type = 'table'
        and name = ${sqlQuote(tableName)}
      limit 1
    `], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    });

    return JSON.parse(output).length > 0;
  } catch (error) {
    return false;
  }
}

function sqlQuote(value) {
  return `'${String(value ?? "").replaceAll("'", "''")}'`;
}

function toRepoPath(path) {
  const value = relative(appRoot, path) || ".";
  return value.split(sep).join("/");
}
