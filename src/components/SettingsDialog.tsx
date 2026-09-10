import { useEffect, useRef, type ReactNode } from "react";
import { Settings2, Palette, X, Check } from "lucide-react";
import { device } from "../lib/device";
import { hex } from "../lib/protocol";
import { useI18n, type Language } from "../lib/i18n";
export const themes = [
    { id: "amber", name: "初鸣", code: "First Song", description: "晨光暖白 · 日间专注" },
    { id: "forest", name: "林鸣", code: "Grove", description: "叶影浅绿 · 柔和自然" },
    { id: "night", name: "夜鸣", code: "Nocturne", description: "月下深青 · 夜间工作" },
    { id: "contrast", name: "明翼", code: "Clearwing", description: "墨底亮金 · 高对比" },
] as const;
interface Props {
    open: boolean;
    onClose: () => void;
    status: string;
    disabled: boolean;
    configuringDisabled: boolean;
    version: number[] | null;
    special: string[];
    setSpecial: (values: string[]) => void;
    theme: string;
    setTheme: (value: string) => void;
    density: string;
    setDensity: (value: string) => void;
    motion: string;
    setMotion: (value: string) => void;
    run: (action: () => Promise<unknown>, success?: string) => Promise<void>;
    feedback: ReactNode;
}
export function SettingsDialog(props: Props) {
    const { t, language, setLanguage } = useI18n();
    const { open, onClose, status, disabled, configuringDisabled, version, special, setSpecial, theme, setTheme, density, setDensity, motion, setMotion, run, feedback } = props;
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const element = dialog.current!;
        if (open && !element.open)
            element.showModal();
        if (!open && element.open)
            element.close();
    }, [open]);
    return (<dialog ref={dialog} className="settings-dialog" aria-labelledby="settings-title" onKeyDown={(event) => {
            if (event.key !== "Tab")
                return;
            const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length);
            const first = controls[0], last = controls[controls.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first?.focus();
            }
        }} onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="settings-header">
        <div><small>CICADA-1 / PREFERENCES</small><h2 id="settings-title"><Settings2 size={20}/>{t("设置")}</h2></div>
        <button className="icon-button" aria-label={t("关闭设置")} autoFocus onClick={onClose}><X size={20}/></button>
      </header>
      <div className="settings-content">
        {feedback}
        <section className="settings-section" aria-label={t("设备设置")}>
          <div className="settings-section-heading"><h3><Settings2 size={17}/>{t("设备设置")}</h3><strong className="status-tag">{t(status)}</strong></div>
          <p>{t("管理模块状态与功放延时，操作结果与主界面实时同步。")}</p>
          <div className="device-controls">
            <button disabled={disabled} onClick={() => void run(() => device.control(0x21))}>{t("查询状态")}</button>
            <button disabled={disabled || status !== "空闲"} onClick={() => void run(() => device.control(0x88))}>{t("进入休眠")}</button>
            <button disabled={disabled} onClick={() => void run(() => device.control(0xff))}>{t("唤醒模块")}</button>
            <button disabled={disabled || status !== "空闲"} onClick={() => void run(() => device.sleepWithoutReply(), "睡眠命令已发送；该命令没有确认回传")}>{t("无回传睡眠")}</button>
            <button className="version-button" disabled={disabled || status !== "空闲"} onClick={() => void run(() => device.queryVersion(), "已采集版本响应并断开，可重新连接设备")}>{t("读取版本并断开")}</button>
          </div>
          <div className="version-summary" aria-label={t("最近版本原始响应")}>
            {version ? <code>{hex(version)}</code> : <small>{t("版本查询采集 2 秒原始响应，随后断开。")}</small>}
          </div>
          <div className="section-caption"><span>{t("功放延时")}</span><small>{t("毫秒 / ms")}</small></div>
          <div className="delay-grid">
            {["上电 POP", "句首丢音", "句尾 POP"].map((name, i) => <label key={name}>{t(name)}<input aria-label={t(`${name}延时`)} type="number" min={0} max={[200, 250, 300][i]} value={special[i]} onChange={event => setSpecial(special.map((v, j) => i === j ? event.target.value : v))} /><small>0–{[200, 250, 300][i]}</small></label>)}
          </div>
          <div className="delay-actions"><small>{t("休眠需 POPEN 高电平。")}</small><button disabled={configuringDisabled} onClick={() => void run(() => {
            if (special.some((v) => !v.trim()))
                throw new Error("请填写全部延时值");
            return device.configureSpecial(special.map(Number));
        }, "延时参数已保存并读回")}>{t("保存延时")}</button></div>
          <p className="settings-hint">{t("设备参数点击保存后写入模块；关闭窗口会保留尚未保存的编辑值。")}</p>
        </section>
        <section className="settings-section" aria-label={t("外观设置")}>
          <div className="settings-section-heading"><h3><Palette size={17}/>{t("外观设置")}</h3><small>{t("本机偏好")}</small></div>
          <p>{t("四时蝉声，一方工作台。选择适合此刻的光线。")}</p>
          <div className="theme-grid">
            {themes.map(({ id, name, code, description }) => <button key={id} data-theme={id} className={theme === id ? "selected" : ""} aria-label={language === "zh" ? `${name} / ${code}` : code} aria-pressed={theme === id} onClick={() => setTheme(id)}>
              <span className="theme-swatch"><i /><i /><i />{theme === id && <Check size={15} />}</span>
              <span className="theme-name">{language === "zh" ? name : code}{language === "zh" && <small>{code}</small>}</span><span className="theme-description">{t(description)}</span>
            </button>)}
          </div>
          <div className="appearance-options">
            <label>{t("密度")}<select value={density} onChange={(e) => setDensity(e.target.value)}><option value="compact">{t("紧凑")}</option><option value="comfortable">{t("舒适")}</option></select></label>
            <label>{t("动态效果")}<select value={motion} onChange={(e) => setMotion(e.target.value)}><option value="system">{t("跟随系统")}</option><option value="reduced">{t("减少动态效果")}</option></select></label>
          </div>
          <p className="settings-hint">{t("外观即时生效并自动保存在本机。")}</p>
        </section>
      </div>
      <footer className="settings-footer"><span>{t("知了1号 ")}<b>CICADA-1</b><small>1.0.0</small></span>
        <label className="language-switch">{t("界面语言")}<select value={language} onChange={event => setLanguage(event.target.value as Language)}><option value="zh">{t("简体中文")}</option><option value="en">English</option></select></label>
        <button onClick={onClose}>{t("完成")}</button></footer>
    </dialog>);
}
