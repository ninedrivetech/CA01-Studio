import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const root = path.resolve(import.meta.dirname, "..");
export const targetRelease = path.resolve(
  root,
  process.env.CARGO_TARGET_DIR || "src-tauri/target",
  "release",
);
const git = (args) =>
  execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  }).trim();
export const hashFile = async (filename) =>
  createHash("sha256")
    .update(await readFile(filename))
    .digest("hex");

export async function sourceState() {
  const { version } = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8"),
  );
  const tauri = JSON.parse(
    await readFile(path.join(root, "src-tauri/tauri.conf.json"), "utf8"),
  );
  const cargo = await readFile(path.join(root, "src-tauri/Cargo.toml"), "utf8");
  if (
    tauri.version !== version ||
    cargo.match(/^version\s*=\s*"([^"]+)"/m)?.[1] !== version
  )
    throw new Error("Frontend, Tauri and Cargo versions must agree");
  return {
    version,
    commit: git(["rev-parse", "HEAD"]),
    dirty: !!git(["status", "--porcelain"]),
  };
}

export async function verifiedBuild() {
  const source = await sourceState();
  const record = JSON.parse(
    await readFile(path.join(targetRelease, "build-record.json"), "utf8"),
  );
  if (
    source.dirty ||
    record.dirty ||
    source.commit !== record.commit ||
    source.version !== record.version ||
    process.platform !== record.platform ||
    process.arch !== record.architecture
  ) {
    throw new Error(
      "Build record does not match clean current sources. Commit changes and rebuild before packaging.",
    );
  }
  for (const [filename, expected] of Object.entries(record.files)) {
    if ((await hashFile(path.join(targetRelease, filename))) !== expected)
      throw new Error(`Build input changed after compilation: ${filename}`);
  }
  return record;
}
