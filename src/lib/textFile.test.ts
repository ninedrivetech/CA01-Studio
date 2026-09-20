import { expect, it } from 'vitest';
import { readTextFile } from './textFile';

it('UTF-8 文件支持中文和 BOM，不把损坏字节替换成可发送文本', async () => {
  await expect(readTextFile(new File(['\ufeff你好'], 'valid.txt'))).resolves.toBe('你好');
  await expect(readTextFile(new File([new Uint8Array([0xd6, 0xd0])], 'gbk.txt'))).rejects.toThrow('UTF-8');
  await expect(readTextFile(new File([new Uint8Array([0xe4, 0xb8])], 'truncated.txt'))).rejects.toThrow('UTF-8');
});

it('超出上限的文件在读取内容前拒绝', async () => {
  await expect(readTextFile(new File([new Uint8Array(1024 * 1024 + 1)], 'large.txt'))).rejects.toThrow('1 MB');
});
