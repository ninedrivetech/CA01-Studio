import { createHash } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { verifiedBuild } from "./release-source.mjs";

const root = path.resolve(import.meta.dirname, "..");
const { version } = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
await verifiedBuild();
const platform = { win32: "windows", linux: "linux", darwin: "macos" }[
  process.platform
];
if (!platform) throw new Error(`Unsupported platform: ${process.platform}`);
const label = process.argv.includes("--local") ? "-local" : "";
const prefix = `zhiliao-${version}-${platform}-${process.arch}${label}`;
const output = path.join(root, "release");
const target = path.resolve(
  root,
  process.env.CARGO_TARGET_DIR || "src-tauri/target",
);
const binaryDirectory = path.join(target, "release");
await mkdir(output, { recursive: true });
const staging = await mkdtemp(path.join(output, "staging-"));
const artifacts = [];

async function copyInstaller(directory, extension, suffix) {
  const folder = path.join(binaryDirectory, "bundle", directory);
  const files = (await readdir(folder)).filter((file) =>
    file.endsWith(extension),
  );
  if (files.length !== 1)
    throw new Error(
      `Expected one ${extension} installer in ${folder}, found ${files.length}`,
    );
  const name = `${prefix}-${suffix}${extension}`;
  await cp(path.join(folder, files[0]), path.join(output, name));
  artifacts.push(name);
}

try {
  for (const file of ["README.md", "LICENSE", "THIRD-PARTY-NOTICES.txt"]) {
    await cp(path.join(root, file), path.join(staging, file));
  }
  await cp(path.join(root, "docs"), path.join(staging, "docs"), {
    recursive: true,
  });
  if (platform === "windows") {
    await cp(
      path.join(binaryDirectory, "zhiliao-studio.exe"),
      path.join(staging, "zhiliao-studio.exe"),
    );
    const archive = `${prefix}-portable.zip`;
    const command =
      "Compress-Archive -LiteralPath (Get-ChildItem -LiteralPath $env:CICADA_STAGE).FullName -DestinationPath $env:CICADA_ARCHIVE -Force";
    execFileSync(
      "pwsh",
      ["-NoProfile", "-NonInteractive", "-Command", command],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          CICADA_STAGE: staging,
          CICADA_ARCHIVE: path.join(output, archive),
        },
      },
    );
    artifacts.push(archive);
    await copyInstaller("nsis", ".exe", "setup");
  } else if (platform === "linux") {
    await cp(
      path.join(binaryDirectory, "zhiliao-studio"),
      path.join(staging, "zhiliao-studio"),
    );
    const archive = `${prefix}-portable.tar.gz`;
    execFileSync(
      "tar",
      ["-czf", path.join(output, archive), "-C", staging, "."],
      { stdio: "inherit" },
    );
    artifacts.push(archive);
    await copyInstaller("deb", ".deb", "installer");
    await copyInstaller("appimage", ".AppImage", "portable");
  } else {
    const apps = (
      await readdir(path.join(binaryDirectory, "bundle/macos"))
    ).filter((file) => file.endsWith(".app"));
    if (apps.length !== 1) throw new Error("Expected one macOS app bundle");
    await cp(
      path.join(binaryDirectory, "bundle/macos", apps[0]),
      path.join(staging, apps[0]),
      { recursive: true },
    );
    const archive = `${prefix}-portable.zip`;
    execFileSync(
      "ditto",
      [
        "-c",
        "-k",
        "--sequesterRsrc",
        "--keepParent",
        staging,
        path.join(output, archive),
      ],
      { stdio: "inherit" },
    );
    artifacts.push(archive);
    await copyInstaller("dmg", ".dmg", "installer");
  }
  execFileSync(
    process.execPath,
    [
      path.join(root, "scripts/build-provenance.mjs"),
      ...(label ? ["--local"] : []),
    ],
    { cwd: root, stdio: "inherit" },
  );
  artifacts.push(`${prefix}-build.json`);
  const sums = [];
  for (const name of artifacts) {
    const hash = createHash("sha256")
      .update(await readFile(path.join(output, name)))
      .digest("hex");
    sums.push(`${hash}  ${name}`);
  }
  await writeFile(
    path.join(output, `${prefix}-SHA256SUMS.txt`),
    `${sums.join("\n")}\n`,
  );
  console.log(sums.join("\n"));
} finally {
  if (path.dirname(staging) !== output)
    throw new Error("Refusing to remove staging outside release directory");
  await rm(staging, { recursive: true, force: true });
}
