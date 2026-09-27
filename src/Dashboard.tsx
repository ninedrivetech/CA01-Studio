import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AudioLines, Play, Pause, Square, RotateCcw, Settings, Languages, Radio, FileText, Sun, Moon, Plug, RefreshCw, Download, Trash2, Volume2, Minus, X, Maximize2, } from "lucide-react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { device, type PortInfo } from "./lib/device";
import { encodings, hex, voices } from "./lib/protocolCore";
import { useSpeechFrames } from "./lib/useSpeechFrames";
import { readTextFile } from "./lib/textFile";
import { FramePreview } from "./components/FramePreview";
import { DownloadDialog, type LogDownload } from "./components/DownloadDialog";
import { SettingsDialog, themes } from "./components/SettingsDialog";
import { PortPicker } from "./components/PortPicker";
import { useI18n } from "./lib/i18n";
const examples = [
    ["日常问候", "您好，我是知了1号。让文字成为声音，让沟通更加自然。"],
    ["智能提醒", "当前温度26℃，湿度百分之六十。请注意通风。"],
    ["排队叫号", "请A008号顾客，到3号窗口办理业务。"],
    ["多音字", "银行行长穿过人行道，骑着自行车去银行。"],
];
const tones = [
    [101, "警报"],
    [102, "刷卡成功"],
    [103, "风铃"],
    [104, "短提示"],
    [105, "确认"],
    [106, "长警报"],
    [107, "紧急警报"],
    [108, "叮咚"],
    [201, "长叮咚"],
    [202, "警报声"],
    [901, "短蜂鸣"],
    [902, "蜂鸣"],
    [903, "咚"],
] as const;
const strategies = [
    ["n", "数字读法", ["自动判断", "按号码读", "按数值读"]],
    ["y", "号码中的 1", ["读作幺", "读作一"]],
    ["r", "姓氏处理", ["自动判断", "每句开头按姓氏", "下一句开头按姓氏"]],
    ["f", "发音风格", ["一字一顿", "平铺直叙"]],
    ["b", "标点处理", ["不读标点", "读出标点"]],
    ["x", "提示音识别", ["禁用识别", "自动识别"]],
    ["i", "拼音识别", ["不识别", "识别拼音"]],
    ["z", "韵律标注", ["不处理", "识别 # 和 *"]],
] as const;
const marks = [
    ["停顿1秒", "[p1000]"],
    ["多音字标记", "[=ni3]"],
    ["拼音识别标记", "[i1]"],
    ["数字号码", "[n1]"],
] as const;
function initial(key: string, fallback: string) {
    try {
        return localStorage.getItem(key) ?? fallback;
    }
    catch {
        return fallback;
    }
}
function remember(key: string, value: string) {
    try {
        localStorage.setItem(key, value);
    }
    catch { }
}
function Cicada() {
    return (<svg viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M47 42C13 6 3 32 17 63L43 81M53 42C87 6 97 32 83 63L57 81" fill="var(--wing)" stroke="var(--accent)" strokeWidth="2"/>
      <path d="M46 43L19 35L40 70M54 43L81 35L60 70M28 44L24 58M72 44L76 58" stroke="var(--accent)" opacity=".5"/>
      <ellipse cx="50" cy="58" rx="11" ry="27" fill="var(--accent)"/>
      <path d="M43 55H57M42 64H58M45 73H55" stroke="var(--surface)" strokeWidth="2"/>
      <circle cx="43" cy="34" r="5" fill="var(--ink)"/>
      <circle cx="57" cy="34" r="5" fill="var(--ink)"/>
    </svg>);
}
export default function Dashboard() {
    const { t, language, setLanguage } = useI18n();
    const state = useSyncExternalStore(device.subscribe, device.snapshot);
    const [theme, setTheme] = useState(initial("zhiliao.theme", "amber"));
    const [text, setText] = useState(initial("zhiliao.draft", examples[0][1]));
    const [encoding, setEncoding] = useState(1);
    const [port, setPort] = useState(initial("zhiliao.port", "COM9"));
    const [ports, setPorts] = useState<PortInfo[]>([]);
    const [baud, setBaud] = useState(115200);
    const [simulated, setSimulated] = useState(!isTauri());
    const [pending, setPending] = useState(false);
    const pendingRef = useRef(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [logDownload, setLogDownload] = useState<LogDownload | null>(null);
    const [volume, setVolume] = useState(5);
    const [speed, setSpeed] = useState(5);
    const [pitch, setPitch] = useState(5);
    const [voice, setVoice] = useState(3);
    const [options, setOptions] = useState<Record<string, number>>({
        n: 0,
        y: 0,
        r: 0,
        f: 1,
        b: 0,
        x: 1,
        i: 0,
        z: 0,
    });
    const [special, setSpecial] = useState(["0", "0", "50"]);
    const [filter, setFilter] = useState("");
    const [direction, setDirection] = useState("ALL");
    const [motion, setMotion] = useState(initial("zhiliao.motion", "system"));
    const [logPaused, setLogPaused] = useState(false);
    const [frozenLogs, setFrozenLogs] = useState(state.logs);
    const [logsExpanded, setLogsExpanded] = useState(false);
    const draft = useRef(text);
    draft.current = text;
    const editor = useRef<HTMLTextAreaElement>(null);
    const refresh = async () => {
        try {
            const p = await device.ports();
            setPorts(p.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
        }
        catch (e) {
            setError(String(e));
        }
    };
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => void refresh(), 3000);
        return () => clearInterval(timer);
    }, []);
    useEffect(() => {
        document.documentElement.dataset.theme = theme;
        remember("zhiliao.theme", theme);
    }, [theme]);
    useEffect(() => {
        document.documentElement.dataset.motion = motion;
        remember("zhiliao.motion", motion);
    }, [motion]);
    useEffect(() => {
        const timer = setTimeout(() => remember("zhiliao.draft", text), 300);
        return () => clearTimeout(timer);
    }, [text]);
    useEffect(() => {
        const flush = () => remember("zhiliao.draft", draft.current);
        window.addEventListener("pagehide", flush);
        window.addEventListener("beforeunload", flush);
        return () => {
            flush();
            window.removeEventListener("pagehide", flush);
            window.removeEventListener("beforeunload", flush);
        };
    }, []);
    useEffect(() => {
        if (!notice) return;
        const timer = setTimeout(() => setNotice(""), 5000);
        return () => clearTimeout(timer);
    }, [notice]);
    useEffect(() => {
        remember("zhiliao.port", port);
    }, [port]);
    useEffect(() => {
        const p = state.parameters;
        if (p) {
            setSpeed(p[2]);
            setVolume(p[3]);
            setPitch(p[4]);
            setVoice(p[5]);
            setOptions({
                x: p[6],
                f: p[7],
                n: p[8],
                y: p[9],
                b: p[10],
                z: p[11],
                i: p[12],
                r: p[13],
            });
        }
    }, [state.parameters]);
    useEffect(() => {
        if (state.special)
            setSpecial([0, 2, 4].map((i) => String(state.special![i] * 256 + state.special![i + 1])));
    }, [state.special]);
    async function run(action: () => Promise<unknown>, success = "") {
        if (pendingRef.current)
            return;
        pendingRef.current = true;
        setPending(true);
        setError("");
        device.clearError();
        setNotice("");
        try {
            await action();
            setNotice(success);
        }
        catch (e) {
            setError(String(e instanceof Error ? e.message : e));
        }
        finally {
            pendingRef.current = false;
            setPending(false);
        }
    }
    const disabled = !state.connected || pending || state.busy;
    const playing = ["播报中", "已暂停"].includes(state.status);
    const sleeping = ["已休眠", "休眠待确认"].includes(state.status);
    const configuringDisabled = disabled || playing || sleeping;
    const { frames, textError, preparing, characters, bytes } = useSpeechFrames(text, encoding);
    const logs = (logPaused ? frozenLogs : state.logs).filter((l) => (direction === "ALL" || l.direction === direction) &&
            `${t(l.message)} ${hex(l.bytes)}`
            .toLowerCase()
            .includes(filter.toLowerCase()));
    function insert(value: string) {
        const el = editor.current;
        const start = el?.selectionStart ?? text.length;
        const end = el?.selectionEnd ?? start;
        setText(text.slice(0, start) + value + text.slice(end));
        requestAnimationFrame(() => {
            el?.focus();
            el?.setSelectionRange(start + value.length, start + value.length);
        });
    }
    const saved = state.parameters;
    const dirty = !!saved &&
        (voice !== saved[5] ||
            volume !== saved[3] ||
            speed !== saved[2] ||
            pitch !== saved[4] ||
            ["x", "f", "n", "y", "b", "z", "i", "r"].some((k, i) => options[k] !== saved[i + 6]));
    const feedback = (error || state.error || notice) && (<div className={`feedback ${error || state.error ? "error" : ""}`} role={error || state.error ? "alert" : "status"}>
      <span>{t(error || state.error || notice)}</span>
      <button className="icon-button" aria-label={t("关闭提示")} onClick={() => { setError(""); device.clearError(); setNotice(""); }}><X size={15}/></button>
    </div>);
    return (<div className={`studio-shell${logsExpanded ? " logs-expanded" : ""}`}>
      <header className="studio-header">
        <div className="studio-brand" onMouseDown={(e) => {
            if (isTauri() && e.button === 0)
                void getCurrentWindow()
                    .startDragging()
                    .catch((e) => setError(String(e)));
        }}>
          <Cicada />
          <h1>{t(" 知了1号")}<span>{t("语音工作台")}</span>
          </h1>
          <small>CICADA-1 <span>/ VOICE STUDIO</span></small>
        </div>
        <div className="header-actions" role="group" aria-label={t("顶部状态栏")}>
          <span className="header-state"><i className={state.connected ? "online" : ""}/>{t(state.connected ? state.simulated ? "模拟设备" : `${port} 已连接` : "设备未连接")}</span>
          <button className="icon-button" aria-label={t("Switch language / 切换语言")} title={t("中文 / English")} onClick={() => setLanguage(language === "zh" ? "en" : "zh")}><Languages size={18}/></button>
          <button className="icon-button settings-trigger" aria-label={t("设置")} title={t("设置")} aria-haspopup="dialog" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(true)}><Settings size={18}/></button>
        <button className="icon-button" aria-label={t("切换日夜主题")} onClick={() => setTheme(["night", "contrast"].includes(theme) ? "amber" : "night")}>
          {["night", "contrast"].includes(theme) ? <Sun size={17} /> : <Moon size={17} />}
        </button>
        </div>
        {isTauri() && <div className="window-buttons">{[
          ["minimize", Minus, "最小化"], ["toggleMaximize", Maximize2, "最大化或还原"], ["close", X, "关闭"],
        ].map(([action, Icon, label]) => <button className="icon-button" key={String(action)} aria-label={t(String(label))}
          onClick={() => void run(() => getCurrentWindow()[action as "minimize" | "toggleMaximize" | "close"]())}>
          <Icon size={16} /></button>)}</div>}
      </header>
      <main className="studio-main">
        <section className="connection-bar" aria-label={t("设备连接")}>
          <strong>
            <Plug size={16}/>{t(" 设备连接 ")}</strong>
          <label>{t(" 通道 ")}<select disabled={state.connected || pending} value={simulated ? "sim" : "serial"} onChange={(e) => setSimulated(e.target.value === "sim")}>
              <option value="serial">{t("真实串口")}</option>
              <option value="sim">{t("模拟设备")}</option>
            </select>
          </label>
          <PortPicker ports={ports} value={port} onChange={setPort} disabled={state.connected || pending || simulated}/>
          <button className="icon-button" aria-label={t("刷新串口")} onClick={() => void refresh()}>
            <RefreshCw size={15}/>
          </button>
          <label>{t(" 波特率 ")}<select disabled={state.connected || pending || simulated} value={baud} onChange={(e) => setBaud(Number(e.target.value))}>
              {[9600, 57600, 115200, 460800].map(b => <option key={b}>{b}</option>)}
            </select>
          </label>
          <button className={state.connected ? "" : "primary"} disabled={pending || state.busy || (!simulated && !port && !state.connected)} onClick={() => void run(() => state.connected
            ? device.disconnect()
            : device.connect(port, baud, simulated))}>
            {t(pending || state.busy ? "处理中…" : state.connected ? "断开连接" : "连接设备")}
          </button>
          <button disabled={pending || state.busy || state.connected || (!simulated && !port)} onClick={() => void run(() => device.connect(port, baud, simulated, true))}>{t(" 唤醒并连接 ")}</button>
          <small>{t(simulated ? "模拟协议，不输出声音" : "8N1 · 无流控")}</small>
          <span className="connection-status" aria-live="polite">
            {t(state.status)}
          </span>
        </section>
        {!settingsOpen && feedback}
        <div className="dashboard-grid">
          <section className="card speech-panel" aria-label={t("文本与提示音")}>
            <div className="card-heading">
              <h2>
                <FileText size={17}/>{t(" 文本与提示音 ")}</h2>
              <label className="inline-label">{t(" 编码 ")}<select value={encoding} onChange={(e) => setEncoding(Number(e.target.value))}>
                  {encodings.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </label>
            </div>
            <div className="example-row">
              {examples.map(([name, value]) => <button key={name} onClick={() => setText(value)}>{t(name)}</button>)}
            </div>
            <label className="sr-only" htmlFor="speech-text">{t(" 播报文本 ")}</label>
            <textarea id="speech-text" ref={editor} value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} aria-invalid={!!textError} aria-describedby={textError ? "speech-text-error" : undefined}/>
            <div className="text-meta">
              <span>
                {preparing ? t("正在准备文本…") : <>{characters}{t(" 字符 · ")}{bytes}{t(" 字节 ")}</>}</span>
              <span>
                {frames.length}{t(" 段 / 每段 ≤ ")}{encodings.find(e => e.id === encoding)?.limit} B
              </span>
            </div>
            {textError && <p id="speech-text-error" className="field-error" role="alert">{t(textError)}</p>}
            <div className="play-controls">
              <button className="primary" disabled={disabled || preparing || !frames.length || !!textError || playing || sleeping} onClick={() => void run(() => device.speak(frames))}>
                <Play size={15}/>{t(" 开始播报 ")}</button>
              <button disabled={disabled || !playing} onClick={() => void run(() => device.control(state.status === "已暂停" ? 4 : 3))}>
                {state.status === "已暂停" ? <Play size={15} /> : <Pause size={15} />}
                {t(state.status === "已暂停" ? "继续" : "暂停")}
              </button>
              <button disabled={disabled} onClick={() => void run(() => device.control(2))}>
                <Square size={13}/>{t(" 停止 ")}</button>
              <label className="file-button" title={t("导入 UTF-8 文本")}>
                <Download size={15}/>
                <span>{t("导入")}</span>
                <input aria-label={t("导入文本")} type="file" accept=".txt" onChange={(e) => {
            const f = e.target.files?.[0];
            if (f)
                void run(async () => {
                    setText(await readTextFile(f));
                });
            e.target.value = "";
        }}/>
              </label>
            </div>
            <div className="section-caption">
              <span>
                <Volume2 size={14}/>{t(" 内置提示音 ")}</span>
              <small>{t("点击插入文本")}</small>
            </div>
            <div className="tone-grid">
              {tones.map(([id, name]) => <button key={id} title={t(`插入 [x1]sound${id}`)} onClick={() => insert(` [x1]sound${id} `)}><span>{t(name)}</span><code>{id}</code></button>)}
            </div>
            <div className="section-caption">
              <span>{t("文本控制标记")}</span>
              <small>{t("在光标处插入")}</small>
            </div>
            <div className="mark-row">
              {marks.map(([name, value]) => <button key={name} title={value} onClick={() => insert(value)}>{t(name)}</button>)}
            </div>
            <div className="card-foot" aria-live="polite">
              <progress className="playback-progress" aria-label={t("播报进度")} max={state.totalSegments || 1} value={state.completedSegments} />
              {t(state.progress)}
              {t(" · 收到播放完成回传后续播 ")}</div>
          </section>
          <section className="card voice-panel" aria-label={t("语音参数")}>
            <div className="card-heading">
              <h2>
                <AudioLines size={17}/>{t(" 语音参数 ")}</h2>
              <span className={dirty ? "unsaved" : ""}>
                {t(!saved ? "尚未同步" : dirty ? "有未保存修改" : "已从模块读取")}
              </span>
            </div>
            <div className="voice-form">
              <label className="voice-picker">{t(" 发音人 ")}<select value={voice} onChange={(e) => setVoice(Number(e.target.value))}>
                  {voices.map(([id, name]) => <option key={id} value={id}>{t(name)}</option>)}
                </select>
              </label>
              <div className="sliders">
                {[["音量", volume, setVolume, 0, 10], ["语速", speed, setSpeed, 1, 30], ["语调", pitch, setPitch, 1, 10]].map(([name, value, set, min, max]) => <label key={String(name)}>
                  <span>{t(String(name))}<strong>{Number(value)}<small> / {Number(max)}</small></strong></span>
                  <input type="range" min={Number(min)} max={Number(max)} value={Number(value)} onChange={event => (set as (n: number) => void)(Number(event.target.value))} />
                </label>)}
              </div>
              <div className="option-grid">
                {strategies.map(([key, label, values]) => <label key={key}>{t(label)}<select value={options[key]} onChange={event => setOptions({ ...options, [key]: Number(event.target.value) })}>
                  {values.map((value, i) => <option key={i} value={i}>{t(value)}</option>)}</select></label>)}
              </div>
            </div>
            <div className="parameter-actions">
              <button disabled={configuringDisabled} onClick={() => void run(() => device.readParameters(), "已读取模块参数")}>
                <RefreshCw size={14}/>{t(" 重新读取 ")}</button>
              <button disabled={configuringDisabled} onClick={() => void run(() => device.configure("[d][m3]"), "已恢复默认参数")}>
                <RotateCcw size={14}/>{t(" 恢复默认 ")}</button>
              <button className="primary" disabled={configuringDisabled} onClick={() => void run(() => device.configure(`[m${voice}][v${volume}][s${speed}][t${pitch}]` +
            Object.entries(options)
                .map(([k, v]) => `[${k}${v}]`)
                .join("")), "参数已保存并读回")}>{t(" 保存参数 ")}</button>
            </div>
            <div className="card-foot">{t("显式保存后掉电保留 · 音量 0 为静音")}</div>
          </section>
          <section className="card logs" aria-label={t("通信记录")}>
            <div className="card-heading">
              <h2>
                <Radio size={16}/>{t(" 通信记录 ")}<small>{logs.length}{t(" 条")}</small>
              </h2>
              <div className="log-tools">
                <button className="icon-button" aria-label={t(logsExpanded ? "收起日志" : "展开日志")} title={t(logsExpanded ? "收起日志" : "展开日志")} aria-expanded={logsExpanded} onClick={() => setLogsExpanded(!logsExpanded)}><Maximize2 size={14}/></button>
                <input aria-label={t("搜索日志")} placeholder={t("搜索报文")} value={filter} onChange={(e) => setFilter(e.target.value)}/>
                <select aria-label={t("日志方向")} value={direction} onChange={(e) => setDirection(e.target.value)}>
                  <option value="ALL">{t("全部方向")}</option>
                  <option>TX</option>
                  <option>RX</option>
                  <option>INFO</option>
                </select>
                <button className="icon-button" title={t("暂停显示")} aria-label={t("暂停显示")} aria-pressed={logPaused} onClick={() => {
            setFrozenLogs(state.logs);
            setLogPaused(!logPaused);
        }}>
                  {logPaused ? <Play size={14} /> : <Pause size={14} />}
                </button>
                <button className="icon-button" title={t("导出日志")} aria-label={t("导出日志")} aria-haspopup="dialog" aria-expanded={!!logDownload} onClick={() => setLogDownload({ name: t("知了1号-通信.log"), count: logs.length, content: logs
            .map((l) => `${l.time} ${l.direction} ${t(l.message)} ${hex(l.bytes)}`)
            .join("\n") })}>
                  <Download size={14}/>
                </button>
                <button className="icon-button" title={t("清空日志")} aria-label={t("清空日志")} onClick={() => {
            device.clearLogs();
            setFrozenLogs([]);
        }}>
                  <Trash2 size={14}/>
                </button>
              </div>
            </div>
            <div className="log-list">
              {logs.length ? logs.slice().reverse().map(l => <div className="log-row" key={l.id}><time>{l.time}</time><b className={l.direction}>{l.direction}</b><span>{t(l.message)}</span><code>{hex(l.bytes)}</code></div>) :
                <div className="empty"><Radio size={24} /><span>{t(filter || direction !== "ALL" ? "无匹配记录" : "连接设备后，在这里查看命令和回传。")}</span>
                  {(filter || direction !== "ALL") && <button onClick={() => { setFilter(""); setDirection("ALL"); }}>{t("清除筛选")}</button>}</div>}
            </div>
            <div className="card-foot">{t(" 最近 500 条 ·")}
              {t(logPaused ? "显示已暂停，后台继续接收" : "实时收发")} · HEX {t("原始报文")}</div>
          </section>
          <FramePreview frames={frames} preparing={preparing} />
        </div>
      </main>
      <footer className="status-bar" aria-label={t("状态栏")}>
        <span className="header-state"><i className={state.connected ? "online" : ""}/>{t(state.connected ? state.simulated ? "模拟设备" : `${port} 已连接` : "设备未连接")}<b>{t(state.status)}</b></span>
        <span className="status-detail">{encodings.find(e => e.id === encoding)?.name} · {frames.length}{t(" 段 · 400 B 安全分段")}</span>
        <span className="status-theme">{t(themes.find(themeOption => themeOption.id === theme)?.name)}</span>
      </footer>
      {logDownload && <DownloadDialog file={logDownload} onClose={() => setLogDownload(null)}/>}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} status={state.status} disabled={disabled} configuringDisabled={configuringDisabled} version={state.version} special={special} setSpecial={setSpecial} theme={theme} setTheme={setTheme} motion={motion} setMotion={setMotion} run={run} feedback={settingsOpen ? feedback : null}/>
    </div>);
}
