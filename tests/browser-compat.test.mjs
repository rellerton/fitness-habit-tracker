import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const chunksRoot = path.resolve(".next", "static", "chunks");

async function javascriptFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) return javascriptFiles(fullPath);
      return entry.name.endsWith(".js") ? [fullPath] : [];
    })
  );
  return nested.flat();
}

test("production chunks avoid class static blocks unsupported by the Family Hub", async () => {
  const files = await javascriptFiles(chunksRoot);
  assert.ok(files.length > 0, "run the production build before this test");

  const incompatible = [];
  for (const file of files) {
    const source = await readFile(file, "utf8");
    if (/\bstatic\s*\{/.test(source)) incompatible.push(path.relative(process.cwd(), file));
  }

  assert.deepEqual(
    incompatible,
    [],
    `class static blocks require Chromium 94+ and break the Family Hub: ${incompatible.join(", ")}`
  );
});
