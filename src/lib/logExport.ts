import { invoke, isTauri } from "@tauri-apps/api/core";

export function logFilename(value: string): string {
    const stem = value.trim().replace(/\.log$/i, "");
    if (!stem || [...stem].length > 80 || /[<>:"/\\|?*\u0000-\u001f\u007f-\u009f]/.test(stem)
        || /[. ]$/.test(stem) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(stem)) {
        throw new Error("请输入有效文件名（最多 80 个字符，不能包含路径或特殊符号）");
    }
    return `${stem}.log`;
}

export async function logExportDirectory(): Promise<string> {
    return isTauri() ? invoke<string>("log_export_directory") : "浏览器设置的下载目录";
}

export async function saveLogExport(name: string, content: string): Promise<string | null> {
    const filename = logFilename(name);
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    if (blob.size > 8 * 1024 * 1024) throw new Error("日志超过 8 MB，请缩小筛选范围后重试");
    if (isTauri()) return invoke<string>("save_log_export", { filename, content });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    try { anchor.click(); } finally {
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    }
    return null;
}
