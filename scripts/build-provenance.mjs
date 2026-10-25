import { writeFile } from "node:fs/promises";
import { verifiedBuild } from "./release-source.mjs";

const provenance = await verifiedBuild();
const { version } = provenance;
const platform = { win32: "windows", linux: "linux", darwin: "macos" }[
  process.platform
];
const local = process.argv.includes("--local") ? "-local" : "";
await writeFile(
  `release/zhiliao-${version}-${platform}-${process.arch}${local}-build.json`,
  `${JSON.stringify(provenance, null, 2)}\n`,
);
