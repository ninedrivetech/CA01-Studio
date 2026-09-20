// Lightweight protocol definitions shared by the UI and the encoding worker.
export const encodings = [
  { id: 0, name: 'GB2312', limit: 400 },
  { id: 1, name: 'GBK', limit: 400 },
  { id: 3, name: 'UTF-16LE', limit: 400 },
  { id: 4, name: 'UTF-16BE', limit: 400 },
  { id: 5, name: 'UTF-8', limit: 400 },
];
export const voices = [
  [3, '晓玲 · 女声'], [51, '尹小坚 · 男声'], [52, '易小强 · 男声'],
  [53, '田蓓蓓 · 女声'], [54, '唐老鸭 · 效果器'], [55, '小燕子 · 女童'],
  [56, '贝童 · 男童'], [57, '晓可 · 男童'],
] as const;
export const hex = (bytes: number[]) =>
  bytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');

export function frame(command: number, data: number[] = []): number[] {
  if (![1, 2, 3, 4, 5, 6, 10, 11, 33, 34, 88, 136, 255].includes(command))
    throw new Error('未知命令');
  if (data.some(b => !Number.isInteger(b) || b < 0 || b > 255) || data.length > 65534)
    throw new Error('帧数据无效');
  const length = data.length + 1;
  return [0xfd, length >> 8, length & 255, command, ...data];
}

export interface Reply { code: number; data: number[] }
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
  reset() { this.buffer = []; }
}
