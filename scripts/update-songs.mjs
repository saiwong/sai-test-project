import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const dbPath = getArgValue(args, "--db");

run("node", [resolve(here, "scrape-songs.mjs"), ...args]);

if (hasArg(args, "--help") || hasArg(args, "-h") || hasArg(args, "--dry-run")) {
  process.exit(0);
}

run("node", [
  resolve(here, "build-data.mjs"),
  ...(dbPath ? [dbPath] : [])
]);

function run(command, commandArgs) {
  const result = spawnSync(command, commandArgs, {
    stdio: "inherit"
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

function getArgValue(argsList, name) {
  for (let index = 0; index < argsList.length; index += 1) {
    const arg = argsList[index];
    if (arg === name) return argsList[index + 1];
    if (arg.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }

  return "";
}

function hasArg(argsList, name) {
  return argsList.some((arg) => arg === name || arg.startsWith(`${name}=`));
}
