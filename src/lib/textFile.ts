export async function readTextFile(file: File): Promise<string> {
  if (file.size > 1024 * 1024) throw new Error('文本文件最大 1 MB');
  const bytes = await file.arrayBuffer();
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    throw new Error('文件不是有效的 UTF-8 文本，请转换编码后重新导入');
  }
}
