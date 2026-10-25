import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { sourceState } from "./release-source.mjs";

export async function verifyRelease(
  directory,
  { version, commit, allPlatforms = false },
) {
  const files = await readdir(directory);
  const checksums = files.filter((file) => file.endsWith("-SHA256SUMS.txt"));
  if (!checksums.length) throw new Error("No release checksums");
  const verified = new Set();
  for (const file of checksums) {
    for (const line of (await readFile(path.join(directory, file), "utf8"))
      .trim()
      .split("\n")) {
      const match = /^([a-f0-9]{64})  ([^/\\]+)$/.exec(line);
      if (!match) throw new Error(`Invalid checksum in ${file}`);
      const [, expected, name] = match;
      const actual = createHash("sha256")
        .update(await readFile(path.join(directory, name)))
        .digest("hex");
      if (actual !== expected) throw new Error(`Checksum mismatch: ${name}`);
      verified.add(name);
    }
  }
  for (const name of files.filter(
    (file) => !file.endsWith("-SHA256SUMS.txt"),
  )) {
    if (!verified.has(name))
      throw new Error(`Artifact has no checksum: ${name}`);
  }
  const platforms = new Set();
  const builds = files.filter((file) => file.endsWith("-build.json"));
  if (!builds.length) throw new Error("Missing build provenance");
  for (const name of builds) {
    const build = JSON.parse(
      await readFile(path.join(directory, name), "utf8"),
    );
    const platform = { win32: "windows", linux: "linux", darwin: "macos" }[
      build.platform
    ];
    if (
      build.version !== version ||
      build.commit !== commit ||
      build.dirty !== false ||
      !platform ||
      !["x64", "arm64"].includes(build.architecture)
    )
      throw new Error(`Unexpected build source or target: ${name}`);
    const local = name.includes("-local-build.json") ? "-local" : "";
    const prefix = `zhiliao-${version}-${platform}-${build.architecture}${local}`;
    if (name !== `${prefix}-build.json`)
      throw new Error(`Unexpected provenance filename: ${name}`);
    const required = {
      windows: ["-setup.exe", "-portable.zip"],
      linux: ["-installer.deb", "-portable.AppImage", "-portable.tar.gz"],
      macos: ["-installer.dmg", "-portable.zip"],
    }[platform];
    for (const suffix of required) {
      if (!verified.has(prefix + suffix))
        throw new Error(`Missing required artifact: ${prefix + suffix}`);
    }
    platforms.add(platform);
  }
  if (
    allPlatforms &&
    ["windows", "linux", "macos"].some((platform) => !platforms.has(platform))
  )
    throw new Error("Windows, Linux and macOS builds are all required");
  return `Verified ${verified.size} artifacts from ${checksums.length} manifests.`;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const source = await sourceState();
  if (
    process.env.RELEASE_TAG &&
    process.env.RELEASE_TAG !== `v${source.version}`
  )
    throw new Error("Unexpected release tag");
  console.log(
    await verifyRelease("release", {
      version: source.version,
      commit: process.env.RELEASE_SHA || source.commit,
      allPlatforms: process.argv.includes("--all-platforms"),
    }),
  );
}
