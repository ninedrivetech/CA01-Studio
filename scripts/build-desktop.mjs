import { execFileSync } from "node:child_process";
import { readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  hashFile,
  root,
  sourceState,
  targetRelease,
} from "./release-source.mjs";

const source = await sourceState();
execFileSync(
  process.execPath,
  [
    path.join(root, "node_modules/@tauri-apps/cli/tauri.js"),
    "build",
    ...process.argv.slice(2),
    "--",
    "--locked",
  ],
  {
    cwd: root,
    stdio: "inherit",
  },
);
const after = await sourceState();
if (after.commit !== source.commit || after.dirty !== source.dirty)
  throw new Error(
    "Source state changed during build. Rebuild from a clean checkout.",
  );
const binary =
  process.platform === "win32" ? "zhiliao-studio.exe" : "zhiliao-studio";
const files = { [binary]: await hashFile(path.join(targetRelease, binary)) };
async function recordFiles(directory, recursive = false) {
  for (const entry of await readdir(path.join(targetRelease, directory), {
    withFileTypes: true,
  })) {
    const relative = path.posix.join(directory, entry.name);
    if (entry.isDirectory() && recursive) await recordFiles(relative, true);
    if (entry.isFile())
      files[relative] = await hashFile(path.join(targetRelease, relative));
  }
}
for (const directory of {
  win32: ["nsis"],
  linux: ["deb", "appimage"],
  darwin: ["macos", "dmg"],
}[process.platform] || []) {
  await recordFiles(`bundle/${directory}`, directory === "macos");
}
await writeFile(
  path.join(targetRelease, "build-record.json"),
  `${JSON.stringify(
    {
      ...source,
      platform: process.platform,
      architecture: process.arch,
      node: process.version,
      rust: execFileSync("rustc", ["--version"], {
        encoding: "utf8",
        windowsHide: true,
      }).trim(),
      builtAt: new Date().toISOString(),
      workflow: process.env.GITHUB_RUN_ID || null,
      files,
    },
    null,
    2,
  )}\n`,
);
