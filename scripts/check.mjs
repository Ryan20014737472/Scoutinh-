import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

async function collect(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? collect(full) : /\.m?js$/.test(entry.name) ? [full] : [];
  }));
  return nested.flat();
}

const files = [...await collect(join(process.cwd(), "src")), ...await collect(join(process.cwd(), "scripts")), join(process.cwd(), "sw.js")];
for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    console.error(result.stderr);
    process.exit(result.status || 1);
  }
}
console.log(`Validated ${files.length} JavaScript modules.`);
