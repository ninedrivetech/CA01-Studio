import { describe, expect, it } from "vitest";
import { encode, frame, speechFrames, ReplyParser } from "./protocol";
describe("协议编码与报文", () => {
  it("GBK 文本帧", () =>
    expect(speechFrames("你好", 1)[0]).toEqual([
      0xfd, 0, 6, 1, 1, 0xc4, 0xe3, 0xba, 0xc3,
    ]));
  it("UTF-16BE 文本帧", () =>
    expect(speechFrames("你好", 4)[0]).toEqual([
      0xfd, 0, 6, 1, 4, 0x4f, 0x60, 0x59, 0x7d,
    ]));
  it("停止帧", () => expect(frame(2)).toEqual([0xfd, 0, 1, 2]));
  it("按字节分段且不截断控制标记", () => {
    const frames = speechFrames("中".repeat(133) + "[p1000]你好", 5);
    expect(frames).toHaveLength(2);
    expect(frames[0].length).toBe(404);
    expect(new TextDecoder().decode(Uint8Array.from(frames[1].slice(5)))).toBe(
      "[p1000]你好",
    );
  });
  it("拒绝不支持字符", () => {
    expect(() => encode("😀", 5)).toThrow();
    expect(() => encode("丂", 0)).toThrow();
  });
  it.each([0, 1, 3, 4, 5])("编码 %i 长文本无损且每段不超过400字节", (encoding) => {
    const text = "完整句子。[p1000]下一句sound901。".repeat(60);
    const frames = speechFrames(text, encoding);
    expect(frames.length).toBeGreaterThan(1);
    expect(frames.every(f => f.length > 5 && f.length <= 405)).toBe(true);
    expect(frames.flatMap(f => f.slice(5))).toEqual(encode(text, encoding));
  });
  it("容量内优先在完整句子后分段", () => {
    const frames = speechFrames("中".repeat(100) + "。" + "文".repeat(50), 5);
    expect(frames[0].slice(5)).toEqual(encode("中".repeat(100) + "。", 5));
  });
  it("分包/粘包参数内部状态字节不误判", () => {
    const p = new ReplyParser();
    expect(p.push([0x5f, 0xa8, 3, 0x4f])).toEqual([]);
    expect(
      p.push([...Array(14).fill(5), 0x41, 0x4f]).map((r) => r.code),
    ).toEqual([0x5f, 0x41, 0x4f]);
  });
});
