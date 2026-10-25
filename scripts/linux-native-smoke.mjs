import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";

if (process.platform !== "linux")
  throw new Error("This smoke test requires Linux and WebKitWebDriver.");
const binary = path.resolve(
  process.env.CICADA_TEST_BINARY ||
    path.join(
      process.env.CARGO_TARGET_DIR || "src-tauri/target",
      "release/zhiliao-studio",
    ),
);
const port = 4456;
const base = `http://127.0.0.1:${port}`;
const driver = spawn(
  "tauri-driver",
  ["--port", String(port), "--native-port", String(port + 1)],
  {
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      WEBKIT_DISABLE_DMABUF_RENDERER: "1",
      XDG_DATA_HOME: path.resolve(
        `test-results/linux-native/profile-${process.pid}`,
      ),
    },
  },
);
let driverOutput = "";
driver.stdout.on("data", (bytes) => {
  driverOutput += bytes;
});
driver.stderr.on("data", (bytes) => {
  driverOutput += bytes;
});
let session;
const exported = [];
const report = {
  runtime: "Tauri / WebKitGTK",
  binary,
  harnessCommit: process.env.CICADA_TEST_HARNESS_SHA || null,
  date: new Date().toISOString(),
  checks: [],
  hardwareTested: false,
};
await mkdir("test-results/linux-native", { recursive: true });

async function request(method, endpoint, body) {
  const response = await fetch(base + endpoint, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result.value;
}
const execute = (script, args = []) =>
  request("POST", `/session/${session}/execute/sync`, { script, args });
const invoke = (command, args = {}) =>
  request("POST", `/session/${session}/execute/async`, {
    script:
      "const done = arguments[arguments.length-1]; window.__TAURI_INTERNALS__.invoke(arguments[0], arguments[1]).then(value => done({ok:true,value}), error => done({ok:false,error:String(error)}));",
    args: [command, args],
  });
async function waitFor(script, args = []) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await execute(script, args)) return;
    await delay(100);
  }
  throw new Error(`Timed out waiting for: ${script}`);
}
async function click(label) {
  await waitFor(
    "const button=[...document.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')||button.textContent.trim())===arguments[0]); return !!button && !button.disabled;",
    [label],
  );
  assert.equal(
    await execute(
      "const button=[...document.querySelectorAll('button')].find(button=>(button.getAttribute('aria-label')||button.textContent.trim())===arguments[0]); if(!button || button.disabled) return false; button.click(); return true;",
      [label],
    ),
    true,
    label,
  );
}

try {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (driver.exitCode !== null)
      throw new Error(`tauri-driver exited: ${driverOutput}`);
    try {
      await request("GET", "/status");
      break;
    } catch {
      await delay(100);
    }
  }
  const created = await request("POST", "/session", {
    capabilities: { alwaysMatch: { "tauri:options": { application: binary } } },
  });
  session = created.sessionId;
  await request("POST", `/session/${session}/timeouts`, { script: 20000 });
  await waitFor(
    "return !!document.querySelector('h1')?.textContent.includes('知了1号');",
  );
  assert.match(
    await execute("return location.href;"),
    /tauri:\/\/localhost|tauri\.localhost/,
  );
  report.checks.push("Packaged offline assets load in native WebKitGTK");
  const ports = await invoke("ports");
  assert.equal(ports.ok, true);
  assert.ok(Array.isArray(ports.value));
  report.ports = ports.value;
  report.checks.push("Native serial enumeration");
  assert.equal((await invoke("send", { bytes: [0xfd, 0, 1, 0x99] })).ok, false);
  assert.equal((await invoke("capture_version")).ok, false);
  report.checks.push("Invalid command and disconnected capture rejected");
  await execute(
    "const select=document.querySelector('.connection-bar select'); select.value='sim'; select.dispatchEvent(new Event('change',{bubbles:true}));",
  );
  await click("连接设备");
  await waitFor(
    "return document.querySelector('.voice-panel .card-heading')?.textContent.includes('已从模块读取');",
  );
  await click("开始播报");
  await waitFor(
    "return document.querySelector('.speech-panel .card-foot')?.textContent.includes('1 / 1 段已完成');",
  );
  report.checks.push(
    "Simulator connects, reads parameters and completes playback",
  );
  const directory = await invoke("log_export_directory");
  assert.equal(directory.ok, true, JSON.stringify(directory));
  const name = `cicada-linux-native-${Date.now()}.log`;
  for (const content of ["第一份\nFD 00 01 21", "第二份"]) {
    const saved = await invoke("save_log_export", { filename: name, content });
    assert.equal(saved.ok, true, JSON.stringify(saved));
    exported.push(saved.value);
    assert.equal(await readFile(saved.value, "utf8"), content);
    assert.equal(path.dirname(saved.value), directory.value);
  }
  assert.notEqual(exported[0], exported[1]);
  assert.equal(await readFile(exported[0], "utf8"), "第一份\nFD 00 01 21");
  report.checks.push("Native UTF-8 export to Downloads without overwriting");
  await click("设置");
  await waitFor("return document.querySelector('.settings-dialog')?.open;");
  await execute(
    "const select=document.querySelector('.language-switch select'); select.value='en'; select.dispatchEvent(new Event('change',{bubbles:true}));",
  );
  await waitFor("return document.documentElement.lang==='en';");
  assert.ok(
    await execute(
      "return document.querySelector('#settings-title').textContent.includes('Settings');",
    ),
  );
  await click("Done");
  report.checks.push("Native settings dialog and English language switch");
  const screenshot = await request("GET", `/session/${session}/screenshot`);
  await writeFile(
    "test-results/linux-native/app.png",
    Buffer.from(screenshot, "base64"),
  );
  await writeFile(
    "test-results/linux-native/report.json",
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(driverOutput);
  throw error;
} finally {
  for (const filename of exported) await unlink(filename);
  if (session) {
    await execute(
      "setTimeout(() => window.__TAURI_INTERNALS__.invoke('plugin:window|close', {label:'main'}), 100); return true;",
    ).catch((error) => console.error(`App cleanup: ${error.message}`));
    await delay(200);
    await request("DELETE", `/session/${session}`).catch((error) =>
      console.error(error.message),
    );
  }
  driver.kill();
  driver.stdout.destroy();
  driver.stderr.destroy();
  await writeFile("test-results/linux-native/driver.log", driverOutput);
}
