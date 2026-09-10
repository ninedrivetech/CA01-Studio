import { TextEncoder as LegacyEncoder } from "@kayahr/text-encoding/no-encodings";
import "@kayahr/text-encoding/encodings/gbk";
import { gb2312Ranges } from "./gb2312-ranges";

export const encodings = [
  { id: 0, name: "GB2312", limit: 400 },
  { id: 1, name: "GBK", limit: 400 },
  { id: 3, name: "UTF-16LE", limit: 400 },
  { id: 4, name: "UTF-16BE", limit: 400 },
  { id: 5, name: "UTF-8", limit: 400 },
];
export const voices = [
  [3, "晓玲 · 女声"],
  [51, "尹小坚 · 男声"],
  [52, "易小强 · 男声"],
  [53, "田蓓蓓 · 女声"],
  [54, "唐老鸭 · 效果器"],
  [55, "小燕子 · 女童"],
  [56, "贝童 · 男童"],
  [57, "晓可 · 男童"],
] as const;
export const hex = (bytes: number[]) =>
  bytes.map((b) => b.toString(16).padStart(2, "0").toUpperCase()).join(" ");
export function encode(text: string, encoding: number): number[] {
  if (!encodings.some((e) => e.id === encoding))
    throw new Error("不支持此编码");
  for (const char of text) {
    const cp = char.codePointAt(0)!;
    if (cp >= 0xd800 && cp <= 0xdfff)
      throw new Error("文本包含不完整 Unicode 字符");
    if (cp > 0xffff)
      throw new Error("芯片字库不支持补充平面字符，请移除表情等字符");
  }
  if (encoding === 5) return Array.from(new TextEncoder().encode(text));
  if (encoding === 3 || encoding === 4)
    return Array.from(text).flatMap((c) => {
      const v = c.charCodeAt(0);
      return encoding === 3 ? [v & 255, v >> 8] : [v >> 8, v & 255];
    });
  const bytes = Array.from(new LegacyEncoder("gbk").encode(text));
  if (
    new TextDecoder("gbk", { fatal: true }).decode(Uint8Array.from(bytes)) !==
    text
  )
    throw new Error("文本包含无法用 GBK 无损编码的字符");
  if (encoding === 0) {
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] < 128) continue;
      const a = bytes[i],
        b = bytes[++i];
      const code = a * 256 + b;
      if (!gb2312Ranges.some(([start, end]) => code >= start && code <= end))
        throw new Error("文本超出 GB2312 字符范围，请选择 GBK 或 UTF-8");
    }
  }
  return bytes;
}
export function frame(command: number, data: number[] = []): number[] {
  if (![1, 2, 3, 4, 5, 6, 10, 11, 33, 34, 88, 136, 255].includes(command))
    throw new Error("未知命令");
  if (
    data.some((b) => !Number.isInteger(b) || b < 0 || b > 255) ||
    data.length > 65534
  )
    throw new Error("帧数据无效");
  const length = data.length + 1;
  return [0xfd, length >> 8, length & 255, command, ...data];
}
export function speechFrames(text: string, encoding: number): number[][] {
  if (!text.trim()) throw new Error("请输入播报文本");
  const limit = encodings.find((e) => e.id === encoding)?.limit;
  if (!limit) throw new Error("不支持此编码");
  // Keep bracket controls and tone names intact across frame boundaries.
  const tokens = text.match(/\[[^\]]*\]|sound\d+|[^\[]/gu) ?? [];
  if (tokens.join("") !== text) throw new Error("控制标记缺少右方括号");
  const frames: number[][] = [];
  let payload: number[] = [];
  let sentenceEnd = 0;
  for (const token of tokens) {
    const bytes = encode(token, encoding);
    if (bytes.length > limit) throw new Error("单个控制标记超过帧容量");
    if (payload.length + bytes.length > limit) {
      const end = sentenceEnd || payload.length;
      frames.push(frame(1, [encoding, ...payload.slice(0, end)]));
      payload = payload.slice(end);
      sentenceEnd = 0;
      if (payload.length + bytes.length > limit) {
        frames.push(frame(1, [encoding, ...payload]));
        payload = [];
      }
    }
    payload.push(...bytes);
    if (/^[。！？；.!?;\n]$/u.test(token)) sentenceEnd = payload.length;
  }
  if (payload.length) frames.push(frame(1, [encoding, ...payload]));
  return frames;
}
export interface Reply {
  code: number;
  data: number[];
}
export class ReplyParser {
  private buffer: number[] = [];
  push(bytes: number[]): Reply[] {
    this.buffer.push(...bytes);
    const replies: Reply[] = [];
    while (this.buffer.length) {
      const code = this.buffer[0];
      const length = code === 0x5f ? 18 : code === 0x5e ? 13 : 1;
      if (this.buffer.length < length) break;
      replies.push({ code, data: this.buffer.splice(0, length) });
    }
    return replies;
  }
  reset() {
    this.buffer = [];
  }
}
