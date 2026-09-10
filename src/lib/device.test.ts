import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Device } from "./device";
import { speechFrames } from "./protocol";
const transport = vi.hoisted(() => ({
  rx: [] as number[][],
  writes: [] as number[][],
  respond: true,
  writeError: false,
  disconnects: 0,
}));
vi.mock("@tauri-apps/api/core", () => ({
  isTauri: () => true,
  invoke: async (command: string, args?: { bytes: number[] }) => {
    if (command === "receive") return transport.rx.shift() ?? [];
    if (command === "capture_version") return [0x58, 0x4f, 0x5f, 0x41];
    if (command === "disconnect") {
      transport.disconnects++;
      return;
    }
    if (command === "send") {
      if (transport.writeError) throw new Error("USB 已拔出");
      const bytes = args!.bytes;
      transport.writes.push(bytes);
      if (transport.respond) {
        if (bytes[3] === 0xff) transport.rx.push([0x4a]);
        else if (bytes[3] === 0x21) transport.rx.push([0x4f]);
        else if (bytes[3] === 5)
          transport.rx.push([
            0x5f, 0xa8, 3, 5, 5, 5, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0,
          ]);
        else if (bytes[3] === 11)
          transport.rx.push([0x5e, ...Array(12).fill(0)]);
        else transport.rx.push([0x41]);
      }
    }
  },
}));
let device: Device;
beforeEach(() => {
  vi.useFakeTimers();
  device = new Device();
  transport.rx = [];
  transport.writes = [];
  transport.respond = true;
  transport.writeError = false;
  transport.disconnects = 0;
});
afterEach(async () => {
  await device.disconnect();
  vi.useRealTimers();
});
async function connect() {
  const ready = device.connect("COM_TEST", 115200, false);
  await vi.advanceTimersByTimeAsync(150);
  await ready;
}
describe("串口会话边界", () => {
  it("休眠设备连接先等待唤醒确认再查询配置", async () => {
    const ready = device.connect("COM_TEST", 115200, false, true);
    await vi.advanceTimersByTimeAsync(200);
    await ready;
    expect(transport.writes.map((f) => f[3])).toEqual([0xff, 0x21, 5, 11]);
    expect(device.snapshot().connected).toBe(true);
  });
  it("版本原始字节不进入状态解析且采集后断开", async () => {
    await connect();
    await device.queryVersion();
    expect(device.snapshot().version).toEqual([0x58, 0x4f, 0x5f, 0x41]);
    expect(device.snapshot().connected).toBe(false);
    expect(device.snapshot().status).toBe("未连接");
    expect(transport.disconnects).toBe(1);
  });
  it("无回传睡眠不假称确认，禁止直接继续播报", async () => {
    await connect();
    await device.sleepWithoutReply();
    expect(device.snapshot().status).toBe("休眠待确认");
    await expect(device.speak(speechFrames("您好", 1))).rejects.toThrow("唤醒");
    expect(transport.writes.at(-1)).toEqual([0xfd, 0, 1, 0x22]);
  });
  it("接收确认不会提前推进长文本，完成回传才推进", async () => {
    await connect();
    const frames = speechFrames("中".repeat(1400), 5);
    const playing = device.speak(frames);
    await vi.advanceTimersByTimeAsync(100);
    await playing;
    expect(transport.writes.filter((f) => f[3] === 1)).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(10000);
    expect(transport.writes.filter((f) => f[3] === 1)).toHaveLength(1);
    transport.rx.push([0x4f]);
    await vi.advanceTimersByTimeAsync(100);
    expect(transport.writes.filter((f) => f[3] === 1)).toHaveLength(2);
  });
  it("停止后迟到的播放完成回传不再发送下一段", async () => {
    await connect();
    const play = device.speak(speechFrames("中".repeat(1400), 5));
    await vi.advanceTimersByTimeAsync(100);
    await play;
    const stop = device.control(2);
    await vi.advanceTimersByTimeAsync(50);
    await stop;
    transport.rx.push([0x4f]);
    await vi.advanceTimersByTimeAsync(500);
    expect(transport.writes.filter((f) => f[3] === 1)).toHaveLength(1);
    expect(device.snapshot().progress).toBe("已停止");
  });
  it("无响应超时后关闭会话且不自动重发", async () => {
    await connect();
    transport.respond = false;
    const request = device.control(0x21);
    const rejection = expect(request).rejects.toThrow("结果不确定");
    await vi.advanceTimersByTimeAsync(15010);
    await rejection;
    expect(device.snapshot().connected).toBe(false);
    expect(transport.disconnects).toBe(1);
    expect(transport.writes.filter((f) => f[3] === 0x21)).toHaveLength(2);
  });
  it("写入失败向调用方报告，不假称发送成功", async () => {
    await connect();
    transport.writeError = true;
    await expect(device.control(2)).rejects.toThrow("USB 已拔出");
  });
});
