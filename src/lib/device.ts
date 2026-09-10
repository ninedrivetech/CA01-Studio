import { invoke, isTauri } from "@tauri-apps/api/core";
import { frame, ReplyParser, type Reply } from "./protocol";

export interface PortInfo {
  name: string;
  description: string;
  manufacturer: string | null;
}

export interface Log {
  id: number;
  time: string;
  direction: "TX" | "RX" | "INFO";
  bytes: number[];
  message: string;
}
export interface Snapshot {
  connected: boolean;
  simulated: boolean;
  busy: boolean;
  status: string;
  progress: string;
  logs: Log[];
  parameters: number[] | null;
  special: number[] | null;
  error: string;
  version: number[] | null;
}
type Pending = {
  expected: number[];
  resolve: (r: Reply) => void;
  reject: (e: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};
const delay = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
export class Device {
  private state: Snapshot = {
    connected: false,
    simulated: false,
    busy: false,
    status: "未连接",
    progress: "尚未开始",
    logs: [],
    parameters: null,
    special: null,
    error: "",
    version: null,
  };
  private listeners = new Set<() => void>();
  private parser = new ReplyParser();
  private pending: Pending | null = null;
  private generation = 0;
  private queue: number[][] = [];
  private total = 0;
  private completed = 0;
  private acknowledged = false;
  private playTimer?: ReturnType<typeof setTimeout>;
  private simulatedParams = [
    0xa8, 3, 5, 5, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ];
  private simulatedSpecial = [0, 0, 0, 0, 0, 50, 0, 0, 0, 0, 0, 0];
  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };
  snapshot = () => this.state;
  private update(patch: Partial<Snapshot>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  clearError() {
    this.update({ error: "" });
  }
  clearLogs() {
    this.update({ logs: [] });
  }
  private log(direction: Log["direction"], bytes: number[], message: string) {
    this.update({
      logs: [
        ...this.state.logs,
        {
          id: Date.now() + Math.random(),
          time: new Date().toLocaleTimeString("zh-CN", { hour12: false }),
          direction,
          bytes,
          message,
        },
      ].slice(-500),
    });
  }
  async ports() {
    return isTauri() ? invoke<PortInfo[]>("ports") : [];
  }
  async connect(path: string, baud: number, simulated: boolean, wake = false) {
    if (this.state.connected || this.state.busy)
      throw new Error("连接正在使用");
    this.update({ busy: true, error: "" });
    try {
      if (!simulated) {
        if (!isTauri()) throw new Error("真实串口请使用桌面程序");
        await invoke("connect", { path, baud });
      }
      const generation = ++this.generation;
      this.parser.reset();
      this.update({
        connected: true,
        simulated,
        status: "等待同步",
        parameters: null,
        special: null,
      });
      this.log(
        "INFO",
        [],
        simulated
          ? "模拟设备已连接（仅模拟协议，不播放真实语音）"
          : `${path} · ${baud} / 8N1 已连接`,
      );
      if (!simulated) void this.poll(generation);
      if (wake) await this.request(frame(0xff), [0x4a]);
      await this.request(frame(0x21), [0x4e, 0x4f]);
      await this.readParameters();
    } catch (e) {
      await this.disconnect();
      this.fail(e);
      throw e;
    } finally {
      this.update({ busy: false });
    }
  }
  async disconnect() {
    ++this.generation;
    this.queue = [];
    clearTimeout(this.playTimer);
    this.rejectPending(new Error("连接已断开"));
    if (this.state.connected && !this.state.simulated)
      await invoke("disconnect");
    this.parser.reset();
    this.update({
      connected: false,
      busy: false,
      status: "未连接",
      parameters: null,
      special: null,
      progress: "尚未开始",
    });
  }
  private fail(e: unknown) {
    this.update({ error: String(e instanceof Error ? e.message : e) });
  }
  private rejectPending(e: Error) {
    if (this.pending) {
      clearTimeout(this.pending.timer);
      this.pending.reject(e);
      this.pending = null;
    }
  }
  private async poll(generation: number) {
    while (generation === this.generation && this.state.connected) {
      try {
        const bytes = await invoke<number[]>("receive");
        if (generation !== this.generation) return;
        if (bytes.length) this.receive(bytes);
      } catch (e) {
        if (generation !== this.generation) return;
        this.fail(e);
        await this.disconnect();
        return;
      }
      await delay(20);
    }
  }
  private receive(bytes: number[]) {
    this.log("RX", bytes, "设备回传");
    for (const reply of this.parser.push(bytes)) {
      if (reply.code === 0x45) {
        this.rejectPending(new Error("设备拒绝命令（45）"));
        this.queue = [];
        this.update({
          status: "命令失败",
          error: "设备返回 45：请检查文本与通信参数",
        });
        continue;
      }
      if (reply.code === 0x5f) this.update({ parameters: reply.data.slice(1) });
      if (reply.code === 0x5e) this.update({ special: reply.data.slice(1) });
      if (reply.code === 0x4e && this.state.status !== "已暂停")
        this.update({ status: "播报中" });
      if (reply.code === 0x4b) this.update({ status: "已休眠" });
      if (reply.code === 0x4a) this.update({ status: "空闲" });
      if (reply.code === 0x41 && this.queue.length) this.acknowledged = true;
      const pending = this.pending;
      if (pending?.expected.includes(reply.code)) {
        clearTimeout(pending.timer);
        this.pending = null;
        pending.resolve(reply);
      }
      if (reply.code === 0x4f) {
        this.update({ status: "空闲" });
        if (this.queue.length && this.acknowledged) {
          this.queue.shift();
          this.completed++;
          this.acknowledged = false;
          this.update({
            progress: `${this.completed} / ${this.total} 段已完成`,
          });
          if (this.queue.length)
            void this.nextSegment().catch((e) => {
              this.queue = [];
              this.fail(e);
            });
        }
      }
    }
  }
  private async request(bytes: number[], expected: number[]) {
    if (!this.state.connected) throw new Error("请先连接设备");
    if (this.pending) throw new Error("上一条命令尚未完成");
    const generation = this.generation;
    const response = new Promise<Reply>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.rejectPending(
          new Error("设备响应超时，结果不确定；请重新连接后读取状态"),
        );
        void this.disconnect().catch((e) => this.fail(e));
      }, 15000);
      this.pending = { expected, resolve, reject, timer };
    });
    // Attach rejection handler before the potentially slow native send.
    const settled = response.then(
      (value) => ({ value }),
      (error) => ({ error }),
    );
    try {
      this.log("TX", bytes, "发送命令");
      if (this.state.simulated) {
        await delay(40);
        if (generation === this.generation) this.simulate(bytes);
      } else await invoke("send", { bytes });
    } catch (e) {
      this.rejectPending(new Error(String(e)));
    }
    const result = await settled;
    if ("error" in result) throw result.error;
    return result.value;
  }
  async readParameters() {
    await this.request(frame(5), [0x5f]);
    await this.request(frame(11), [0x5e]);
  }
  async queryVersion() {
    if (
      !this.state.connected ||
      this.pending ||
      this.queue.length ||
      this.state.status !== "空闲"
    )
      throw new Error("请先连接空闲设备");
    ++this.generation;
    this.update({ busy: true, version: null });
    try {
      this.log("TX", frame(0x58), "版本查询：独立采集2秒原始响应");
      const bytes = this.state.simulated
        ? [0x58, ...new TextEncoder().encode("SIMULATOR 1.0.0")]
        : await invoke<number[]>("capture_version");
      this.log("RX", bytes, "版本原始响应（不假定固定长度）");
      this.update({ version: bytes });
    } finally {
      await this.disconnect();
    }
  }
  async sleepWithoutReply() {
    if (
      !this.state.connected ||
      this.pending ||
      this.queue.length ||
      this.state.status !== "空闲"
    )
      throw new Error("请先连接空闲设备");
    const bytes = frame(0x22);
    this.log("TX", bytes, "无回传睡眠命令");
    if (this.state.simulated) await delay(75);
    else await invoke("send", { bytes });
    this.update({ status: "休眠待确认" });
  }
  async configure(marks: string) {
    if (
      this.queue.length ||
      this.state.status === "播报中" ||
      this.state.status === "已暂停"
    )
      throw new Error("请先停止播报再保存参数");
    await this.request(
      frame(6, [1, ...new TextEncoder().encode(marks)]),
      [0x4f],
    );
    await this.readParameters();
  }
  async configureSpecial(values: number[]) {
    if (
      values.length !== 3 ||
      values.some(
        (v, i) => !Number.isInteger(v) || v < 0 || v > [200, 250, 300][i],
      )
    )
      throw new Error("延时参数超出范围");
    if (this.queue.length || this.state.status === "播报中")
      throw new Error("请先停止播报");
    await this.request(
      frame(
        10,
        values.flatMap((v) => [v >> 8, v & 255]),
      ),
      [0x4f],
    );
    await this.request(frame(11), [0x5e]);
  }
  async speak(frames: number[][]) {
    if (
      this.queue.length ||
      ["播报中", "已暂停", "已休眠", "休眠待确认"].includes(this.state.status)
    )
      throw new Error("请先停止当前播报或唤醒设备");
    this.queue = frames.map((f) => [...f]);
    this.total = frames.length;
    this.completed = 0;
    try {
      await this.nextSegment();
    } catch (e) {
      this.queue = [];
      throw e;
    }
  }
  private async nextSegment() {
    const generation = this.generation;
    await delay(40);
    if (generation !== this.generation || !this.queue.length) return;
    this.acknowledged = false;
    this.update({
      status: "播报中",
      progress: `${this.completed} / ${this.total} 段已完成`,
    });
    await this.request(this.queue[0], [0x41]);
  }
  async control(command: number) {
    if (command === 2) {
      this.queue = [];
      this.acknowledged = false;
      clearTimeout(this.playTimer);
    }
    if (command === 0x88 && (this.queue.length || this.state.status !== "空闲"))
      throw new Error("请先停止播报再休眠");
    await this.request(
      frame(command),
      command === 0x21
        ? [0x4e, 0x4f]
        : command === 0xff
          ? [0x4a]
          : command === 0x88
            ? [0x4b]
            : [0x41],
    );
    if (command === 2) this.update({ status: "空闲", progress: "已停止" });
    if (command === 3) this.update({ status: "已暂停" });
    if (command === 4) this.update({ status: "播报中" });
  }
  private simulate(bytes: number[]) {
    const command = bytes[3];
    if (command === 5) {
      this.receive([0x5f, ...this.simulatedParams]);
      return;
    }
    if (command === 11) {
      this.receive([0x5e, ...this.simulatedSpecial]);
      return;
    }
    if (command === 6) {
      const marks = new TextDecoder().decode(Uint8Array.from(bytes.slice(5)));
      if (marks.includes("[d]"))
        this.simulatedParams = [
          0xa8,
          3,
          5,
          5,
          5,
          this.simulatedParams[5],
          1,
          1,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
          0,
        ];
      const indices: Record<string, number> = {
        s: 2,
        v: 3,
        t: 4,
        m: 5,
        x: 6,
        f: 7,
        n: 8,
        y: 9,
        b: 10,
        z: 11,
        i: 12,
        r: 13,
      };
      for (const match of marks.matchAll(/\[([svtmxfnybzir])(\d+)\]/g))
        this.simulatedParams[indices[match[1]]] = Number(match[2]);
      this.receive([0x4f]);
      return;
    }
    if (command === 10) {
      this.simulatedSpecial = [...bytes.slice(4), 0, 0, 0, 0, 0, 0];
      this.receive([0x4f]);
      return;
    }
    if (command === 0x21) {
      this.receive([
        this.state.status === "播报中" || this.state.status === "已暂停"
          ? 0x4e
          : 0x4f,
      ]);
      return;
    }
    if (command === 0xff) {
      this.receive([0x4a]);
      return;
    }
    if (command === 0x88) {
      this.receive([0x4b]);
      return;
    }
    this.receive([0x41]);
    if (command === 1 || command === 4) {
      clearTimeout(this.playTimer);
      this.playTimer = setTimeout(() => this.receive([0x4f]), 1200);
    }
    if (command === 2 || command === 3) clearTimeout(this.playTimer);
  }
}
export const device = new Device();
