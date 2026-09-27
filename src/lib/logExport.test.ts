import { expect, it, vi } from 'vitest';
const ipc = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true, invoke: ipc.invoke }));
import { logFilename, logExportDirectory, saveLogExport } from './logExport';

it('normalizes log names and rejects paths and Windows device names', () => {
    expect(logFilename(' 通信.LOG ')).toBe('通信.log');
    expect(logFilename('😀'.repeat(80))).toBe('😀'.repeat(80) + '.log');
    for (const name of ['', '../x', 'C:\\x', 'CON', 'aux.txt', 'COM9', 'LPT1', 'a.', 'a .log', 'a\n.log', 'a\u0085', '中'.repeat(81)]) {
        expect(() => logFilename(name), name).toThrow();
    }
});

it('desktop exports use native IPC and preserve content and errors', async () => {
    ipc.invoke.mockResolvedValueOnce('C:\\Downloads');
    expect(await logExportDirectory()).toBe('C:\\Downloads');
    ipc.invoke.mockResolvedValueOnce('C:\\Downloads\\通信 (1).log');
    expect(await saveLogExport('通信', '中文\nFD 00 01 21')).toBe('C:\\Downloads\\通信 (1).log');
    expect(ipc.invoke).toHaveBeenLastCalledWith('save_log_export', { filename: '通信.log', content: '中文\nFD 00 01 21' });
    ipc.invoke.mockRejectedValueOnce('无法访问下载目录，请检查文件夹权限');
    await expect(saveLogExport('通信', '内容')).rejects.toBe('无法访问下载目录，请检查文件夹权限');
    const calls = ipc.invoke.mock.calls.length;
    await expect(saveLogExport('large', 'a'.repeat(8 * 1024 * 1024 + 1))).rejects.toThrow('8 MB');
    expect(ipc.invoke.mock.calls.length).toBe(calls);
});
