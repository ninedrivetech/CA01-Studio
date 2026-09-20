import { TextEncoder as LegacyEncoder } from "@kayahr/text-encoding/no-encodings";
import "@kayahr/text-encoding/encodings/gbk";
import { gb2312Ranges } from "./gb2312-ranges";
import { encodings, frame } from "./protocolCore";
export { encodings, frame, voices, hex, ReplyParser, type Reply } from "./protocolCore";
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
