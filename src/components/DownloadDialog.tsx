import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, FileText, Folder, X } from "lucide-react";
import { useI18n } from "../lib/i18n";
import { logExportDirectory, logFilename, saveLogExport } from "../lib/logExport";

export interface LogDownload { name: string; content: string; count: number }

export function DownloadDialog({ file, onClose }: { file: LogDownload; onClose: () => void }) {
    const { t } = useI18n();
    const dialog = useRef<HTMLDialogElement>(null);
    const nameInput = useRef<HTMLInputElement>(null);
    const doneButton = useRef<HTMLButtonElement>(null);
    const savingRef = useRef(false);
    const [name, setName] = useState(file.name.replace(/\.log$/i, ""));
    const [directory, setDirectory] = useState("");
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState<{ path: string | null; filename: string } | null>(null);
    useEffect(() => {
        const element = dialog.current!;
        const previousFocus = document.activeElement as HTMLElement | null;
        element.showModal();
        nameInput.current?.focus();
        return () => { element.close(); previousFocus?.focus(); };
    }, []);
    useEffect(() => {
        let active = true;
        setError("");
        void logExportDirectory().then(path => {
            if (active) setDirectory(path);
        }).catch(reason => {
            if (active) setError(reason instanceof Error ? reason.message : String(reason));
        });
        return () => { active = false; };
    }, [attempt]);
    useEffect(() => { if (saved) doneButton.current?.focus(); }, [saved]);
    async function save() {
        if (savingRef.current || !directory || !file.count) return;
        savingRef.current = true;
        setSaving(true);
        setError("");
        try {
            const filename = logFilename(name);
            const path = await saveLogExport(filename, file.content);
            setSaved({ path, filename });
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : String(reason));
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    }
    return <dialog ref={dialog} className="settings-dialog download-dialog" aria-labelledby="download-title" aria-describedby="download-description"
        onCancel={event => { event.preventDefault(); if (!savingRef.current) onClose(); }}>
        <header className="settings-header">
            <div><small>CICADA-1 / EXPORT</small><h2 id="download-title"><Download size={20}/>{t("导出日志")}</h2></div>
            <button className="icon-button" aria-label={t("关闭下载弹窗")} disabled={saving} onClick={onClose}><X size={20}/></button>
        </header>
        <form className="download-form" onSubmit={event => { event.preventDefault(); void save(); }} aria-busy={saving}>
            <div className="download-content">
                <p id="download-description">{t("下载当前筛选结果，保存打开弹窗时的日志快照。")}</p>
                {saved ? <div className="download-success" role="status">
                    <CheckCircle2 size={32} aria-hidden="true"/>
                    <strong>{t(saved.path ? "文件已保存" : "已交给浏览器下载")}</strong>
                    <p>{saved.path ?? saved.filename}</p>
                </div> : <>
                    <div className="download-file"><FileText size={28} aria-hidden="true"/><div><strong>{file.name}</strong><span>{file.count}{t(" 条")} · {new TextEncoder().encode(file.content).length.toLocaleString()} B · UTF-8</span></div></div>
                    <label className="download-name" htmlFor="download-name"><span id="download-name-label">{t("文件名")}</span>
                        <div><input id="download-name" aria-labelledby="download-name-label" ref={nameInput} value={name} disabled={saving}
                            onChange={event => setName(event.target.value)} aria-describedby={error ? "download-error" : undefined}/><span aria-hidden="true">.log</span></div>
                    </label>
                    <div className="download-location"><Folder size={18} aria-hidden="true"/><div><strong>{t("保存位置")}</strong><p>{directory === "浏览器设置的下载目录" ? t(directory) : directory || t("正在获取下载目录…")}</p></div></div>
                    {directory && directory !== "浏览器设置的下载目录" && <p className="download-hint">{t("直接保存到系统下载目录；重名文件会自动编号。")}</p>}
                    <div className="download-preview"><span>{t("内容预览（前 12 行）")}</span><pre tabIndex={0} aria-label={t("日志内容预览")}>{file.content.split(/\r?\n/).slice(0, 12).join("\n")}</pre></div>
                    {file.count === 0 && <p role="status">{t("当前没有可导出的日志，请调整筛选或连接设备后重试。")}</p>}
                    {error && <p className="download-error" id="download-error" role="alert">{t(error)}</p>}
                </>}
            </div>
            <footer className="download-actions">
                {saved ? <button type="button" ref={doneButton} className="primary" onClick={onClose}>{t("完成")}</button> : <>
                    <button type="button" disabled={saving} onClick={onClose}>{t("取消")}</button>
                    {!directory && error && <button type="button" onClick={() => setAttempt(value => value + 1)}>{t("重新获取保存位置")}</button>}
                    <button type="submit" className="primary" disabled={saving || !directory || !file.count || !name.trim()}><Download size={16}/>{t(saving ? "正在保存…" : "下载文件")}</button>
                </>}
            </footer>
        </form>
    </dialog>;
}
