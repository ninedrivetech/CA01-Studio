import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { verifyRelease } from "./verify-release.mjs";

const expected = { version: "1.0.0", commit: "a".repeat(40) };
const prefix = "zhiliao-1.0.0-windows-x64";
async function fixture(run, { build = {}, omit = [], unchecked = [] } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "cicada-verifier-"));
  try {
    const entries = {
      [`${prefix}-setup.exe`]: "installer fixture",
      [`${prefix}-portable.zip`]: "portable fixture",
      [`${prefix}-build.json`]: JSON.stringify({
        ...expected,
        dirty: false,
        platform: "win32",
        architecture: "x64",
        ...build,
      }),
    };
    const sums = [];
    for (const [name, content] of Object.entries(entries)) {
      if (omit.includes(name)) continue;
      await writeFile(path.join(directory, name), content);
      if (!unchecked.includes(name))
        sums.push(
          `${createHash("sha256").update(content).digest("hex")}  ${name}`,
        );
    }
    await writeFile(
      path.join(directory, `${prefix}-SHA256SUMS.txt`),
      `${sums.join("\n")}\n`,
    );
    await run(directory);
  } finally {
    assert.equal(path.dirname(directory), tmpdir());
    await rm(directory, { recursive: true, force: true });
  }
}

test("accepts a complete local platform with checked provenance", async () => {
  await fixture(async (directory) =>
    assert.match(
      await verifyRelease(directory, expected),
      /Verified 3 artifacts/,
    ),
  );
});
test("rejects corrupted artifact bytes", async () => {
  await fixture(async (directory) => {
    await writeFile(path.join(directory, `${prefix}-setup.exe`), "corrupted");
    await assert.rejects(
      verifyRelease(directory, expected),
      /Checksum mismatch/,
    );
  });
});
test("rejects unchecked provenance", async () => {
  await fixture(
    async (directory) => {
      await assert.rejects(verifyRelease(directory, expected), /no checksum/);
    },
    { unchecked: [`${prefix}-build.json`] },
  );
});
for (const build of [
  { commit: "b".repeat(40) },
  { version: "9.0.0" },
  { dirty: true },
]) {
  test(`rejects mismatched build source ${JSON.stringify(build)}`, async () => {
    await fixture(
      async (directory) => {
        await assert.rejects(
          verifyRelease(directory, expected),
          /Unexpected build source/,
        );
      },
      { build },
    );
  });
}
test("rejects missing installer even when all remaining checksums pass", async () => {
  await fixture(
    async (directory) => {
      await assert.rejects(
        verifyRelease(directory, expected),
        /Missing required artifact/,
      );
    },
    { omit: [`${prefix}-setup.exe`] },
  );
});
test("requires all three platforms at the publication gate", async () => {
  await fixture(async (directory) => {
    await assert.rejects(
      verifyRelease(directory, { ...expected, allPlatforms: true }),
      /all required/,
    );
    assert.ok(
      (
        await readFile(path.join(directory, `${prefix}-SHA256SUMS.txt`), "utf8")
      ).includes("-build.json"),
    );
  });
});
