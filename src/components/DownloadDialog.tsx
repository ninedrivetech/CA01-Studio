import { useEffect, useRef } from "react";
import { Download, FileText, X } from "lucide-react";
import { useI18n } from "../lib/i18n";

export interface LogDownload { name: string; content: string; count: number }

export function DownloadDialog({ file, onClose }: { file: LogDownload | null; onClose: () => void }) {
    const { t } = useI18n();
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current!;
        if (file && !element.open) element.showModal();
        if (!file && element.open) element.close();
    }, [file]);
    function save() {
        if (!file) return;
        const url = URL.createObjectURL(new Blob([file.content], { type: "text/plain;charset=utf-8" }));
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        onClose();
    }
    return <dialog ref={dialog} className="settings-dialog download-dialog" aria-labelledby="download-title" aria-describedby="download-description"
        onCancel={event => { event.preventDefault(); onClose(); }}>
        <header className="settings-header">
            <div><small>CICADA-1 / EXPORT</small><h2 id="download-title"><Download size={20}/>{t("导出日志")}</h2></div>
            <button className="icon-button" aria-label={t("关闭下载弹窗")} onClick={onClose}><X size={20}/></button>
        </header>
        <div className="download-content">
            <p id="download-description">{t("下载当前筛选结果，保存打开弹窗时的日志快照。")}</p>
            <div className="download-file"><FileText size={32} aria-hidden="true"/><div><strong>{file?.name}</strong><span>{file?.count ?? 0}{t(" 条")} · {new TextEncoder().encode(file?.content ?? "").length.toLocaleString()} B · UTF-8</span></div></div>
            {file?.count === 0 && <p role="status">{t("当前没有可导出的日志，请调整筛选或连接设备后重试。")}</p>}
        </div>
        <footer className="download-actions">
            <button autoFocus onClick={onClose}>{t("取消")}</button>
            <button className="primary" disabled={!file?.count} onClick={save}><Download size={16}/>{t("下载文件")}</button>
        </footer>
    </dialog>;
}
