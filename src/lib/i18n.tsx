import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

export type Language = "zh" | "en";
export const english: Record<string, string> = {
  "文件名": "File name", "保存位置": "Save location", "正在获取下载目录…": "Loading download folder…",
  "浏览器设置的下载目录": "Your browser's download folder", "重新获取保存位置": "Retry save location",
  "直接保存到系统下载目录；重名文件会自动编号。": "Saved directly to Downloads. Duplicate names are numbered automatically.",
  "内容预览（前 12 行）": "Preview (first 12 lines)", "日志内容预览": "Log content preview",
  "正在保存…": "Saving…", "文件已保存": "File saved", "已交给浏览器下载": "Sent to browser downloads",
  "请输入有效文件名（最多 80 个字符，不能包含路径或特殊符号）": "Enter a valid file name (up to 80 characters, without paths or special symbols).",
  "无法获取下载目录，请检查系统设置后重试": "Cannot locate Downloads. Check your system settings and retry.",
  "文件名无效，请使用不含路径的 .log 文件名": "Invalid file name. Use a .log file name without a path.",
  "日志超过 8 MB，请缩小筛选范围后重试": "The log exceeds 8 MB. Narrow the filters and retry.",
  "无法访问下载目录，请检查文件夹权限": "Cannot access Downloads. Check folder permissions.",
  "无法保存日志，请检查下载目录权限和磁盘空间后重试": "Cannot save the log. Check Downloads permissions and free disk space, then retry.",
  "日志写入失败，请检查磁盘空间后重试": "Could not write the log. Check free disk space and retry.",
  "同名日志过多，请更换文件名后重试": "Too many logs have this name. Choose another file name.",
  "日志保存任务未完成，请重试": "Log saving did not complete. Please retry.",
  "关闭下载弹窗": "Close download dialog", "取消": "Cancel", "下载文件": "Download file",
  "下载当前筛选结果，保存打开弹窗时的日志快照。": "Download the filtered logs captured when this dialog opened.",
  "当前没有可导出的日志，请调整筛选或连接设备后重试。": "No logs to export. Adjust the filters or connect a device and try again.",
  "关于": "About", "作者": "Author", "联系邮箱": "Contact email",
  "正在准备文本…": "Preparing text…", "文本处理失败，请重新载入应用": "Text processing failed. Reload the app.",
  "文件不是有效的 UTF-8 文本，请转换编码后重新导入": "This file is not valid UTF-8. Convert its encoding and import again.",
  "上一段": "Previous segment", "下一段": "Next segment", "无可发送报文": "No frame to send",
  "无匹配记录": "No matching records", "清除筛选": "Clear filters", "播报进度": "Playback progress",
  "展开日志": "Expand logs", "收起日志": "Collapse logs",
  "知了1号": "Cicada One", "语音工作台": "Voice Studio", "让文字，自然发声。": "Give your words a voice.",
  "设备连接": "Connection", "通道": "Mode", "真实串口": "Serial device", "模拟设备": "Simulator", "端口": "Port",
  "选择串口": "Select a port", "串口设备": "Serial device", "搜索串口设备": "Search serial devices",
  "搜索设备名称或 COM 口": "Search device name or COM port", "可用串口": "Available ports", "手动指定端口": "Manual port",
  "选择或输入 COM 口": "Select or enter a COM port", "使用端口": "Use port", "没有匹配的设备": "No matching devices",
  "未发现串口，可刷新或手动输入": "No ports found. Refresh or enter a port manually.", "刷新串口": "Refresh ports",
  "波特率": "Baud rate", "连接设备": "Connect", "断开连接": "Disconnect", "唤醒并连接": "Wake & connect",
  "处理中…": "Working…", "模拟协议，不输出声音": "Protocol simulation · no audio", "8N1 · 无流控": "8N1 · no flow control",
  "设备未连接": "Device disconnected", "状态栏": "Status bar", "顶部状态栏": "Top status bar",
  "设置": "Settings", "关闭设置": "Close settings", "完成": "Done", "关闭提示": "Dismiss notification",
  "切换日夜主题": "Toggle light / dark theme", "最小化": "Minimize", "最大化或还原": "Maximize or restore", "关闭": "Close",
  "文本与提示音": "Text & sound cues", "编码": "Encoding", "日常问候": "Greeting", "智能提醒": "Reminder",
  "排队叫号": "Queue call", "多音字": "Pronunciation", "播报文本": "Speech text", "字符 ·": "characters ·", "字节": "bytes",
  "段 / 每段 ≤": "segments / max", "段 · 400 B 安全分段": "segments · 400 B safe limit", "段": "segments", "第 1 /": "1 /",
  "开始播报": "Speak", "暂停": "Pause", "继续": "Resume", "停止": "Stop", "导入": "Import", "导入文本": "Import text",
  "导入 UTF-8 文本": "Import UTF-8 text", "文本文件最大 1 MB": "Text files must be no larger than 1 MB",
  "内置提示音": "Built-in sound cues", "点击插入文本": "Click to insert", "文本控制标记": "Text control tags", "在光标处插入": "Insert at cursor",
  "警报": "Alarm", "刷卡成功": "Card OK", "风铃": "Chime", "短提示": "Prompt", "确认": "Confirm", "长警报": "Long alarm",
  "紧急警报": "Urgent", "叮咚": "Ding-dong", "长叮咚": "Long ding", "警报声": "Siren", "短蜂鸣": "Short beep", "蜂鸣": "Beep", "咚": "Dong",
  "停顿1秒": "Pause 1s", "多音字标记": "Pronunciation tag", "拼音识别标记": "Pinyin tag", "数字号码": "Number mode",
  "· 收到播放完成回传后续播": "· Next segment starts after completion reply",
  "语音参数": "Voice parameters", "发音人": "Voice", "音量": "Volume", "语速": "Speed", "语调": "Pitch",
  "尚未同步": "Not synced", "有未保存修改": "Unsaved changes", "已从模块读取": "Synced from device",
  "晓玲 · 女声": "Xiaoling · Female", "尹小坚 · 男声": "Yin Xiaojian · Male", "易小强 · 男声": "Yi Xiaoqiang · Male",
  "田蓓蓓 · 女声": "Tian Beibei · Female", "唐老鸭 · 效果器": "Donald Duck · Effect", "小燕子 · 女童": "Xiaoyanzi · Girl",
  "贝童 · 男童": "Beitong · Boy", "晓可 · 男童": "Xiaoke · Boy",
  "数字读法": "Number reading", "号码中的 1": "Digit 1 in numbers", "姓氏处理": "Surname handling", "发音风格": "Speaking style",
  "标点处理": "Punctuation", "提示音识别": "Sound cue detection", "拼音识别": "Pinyin detection", "韵律标注": "Prosody tags",
  "自动判断": "Automatic", "按号码读": "Digit by digit", "按数值读": "Numeric value", "读作幺": "Read as yao", "读作一": "Read as yi",
  "每句开头按姓氏": "Surname at sentence start", "下一句开头按姓氏": "Surname at next sentence", "一字一顿": "Character by character",
  "平铺直叙": "Natural narration", "不读标点": "Skip punctuation", "读出标点": "Read punctuation", "禁用识别": "Disabled",
  "自动识别": "Automatic", "不识别": "Disabled", "识别拼音": "Recognize pinyin", "不处理": "Disabled", "识别 # 和 *": "Recognize # and *",
  "重新读取": "Read again", "恢复默认": "Reset defaults", "保存参数": "Save parameters", "已读取模块参数": "Device parameters loaded",
  "已恢复默认参数": "Default parameters restored", "参数已保存并读回": "Parameters saved and read back",
  "显式保存后掉电保留 · 音量 0 为静音": "Saved settings survive power-off · Volume 0 mutes",
  "设备设置": "Device settings", "外观设置": "Appearance", "管理模块状态与功放延时，操作结果与主界面实时同步。": "Manage device state and amplifier timing. Results stay in sync with the workspace.",
  "查询状态": "Query status", "进入休眠": "Sleep", "唤醒模块": "Wake", "无回传睡眠": "Sleep without reply", "读取版本并断开": "Read version & disconnect",
  "睡眠命令已发送；该命令没有确认回传": "Sleep command sent; this command has no acknowledgement",
  "已采集版本响应并断开，可重新连接设备": "Version response captured. Disconnected; you can reconnect now.",
  "最近版本原始响应": "Last raw version response", "版本查询采集 2 秒原始响应，随后断开。": "Capture raw version bytes for 2 seconds, then disconnect.",
  "功放延时": "Amplifier timing", "毫秒 / ms": "Milliseconds / ms", "上电 POP": "Power-on POP", "句首丢音": "Speech start", "句尾 POP": "Speech end POP",
  "上电 POP延时": "Power-on POP delay", "句首丢音延时": "Speech start delay", "句尾 POP延时": "Speech end POP delay",
  "休眠需 POPEN 高电平。": "Sleep requires POPEN high.", "请填写全部延时值": "Enter all delay values", "保存延时": "Save delays",
  "延时参数已保存并读回": "Delays saved and read back", "设备参数点击保存后写入模块；关闭窗口会保留尚未保存的编辑值。": "Click Save to write to the device. Closing this window keeps unsaved edits.",
  "本机偏好": "Local preferences", "四时蝉声，一方工作台。选择适合此刻的光线。": "A workspace inspired by cicadas. Choose the light that suits your moment.",
  "初鸣": "First Song", "林鸣": "Grove", "夜鸣": "Nocturne", "明翼": "Clearwing",
  "晨光暖白 · 日间专注": "Warm white · Daytime focus", "叶影浅绿 · 柔和自然": "Leaf green · Soft and natural",
  "月下深青 · 夜间工作": "Deep teal · Night work", "墨底亮金 · 高对比": "Ink and gold · High contrast",
  "动态效果": "Motion", "跟随系统": "Follow system",
  "减少动态效果": "Reduce motion", "外观即时生效并自动保存在本机。": "Appearance updates instantly and is saved locally.",
  "界面语言": "Interface language", "语言切换不改变播报文本与设备参数。": "Changing language does not alter speech text or device parameters.",
  "通信记录": "Communication log", "条": "entries", "搜索日志": "Search logs", "搜索报文": "Search messages", "日志方向": "Log direction",
  "全部方向": "All directions", "暂停显示": "Freeze log display", "导出日志": "Export logs", "清空日志": "Clear logs",
  "知了1号-通信.log": "CICADA-1-communication.log", "连接设备后，在这里查看命令和回传。": "Connect a device to see commands and replies here.",
  "最近 500 条 ·": "Last 500 entries ·", "显示已暂停，后台继续接收": "Display frozen; reception continues", "实时收发": "Live traffic", "原始报文": "raw messages",
  "发送预览": "Frame preview", "输入文本后生成报文": "Enter text to preview its frame", "FD 帧头 · 大端长度 · 01 合成 · 编码 + 文本": "FD header · BE length · 01 speech · encoding + text",
  "未连接": "Disconnected", "等待同步": "Synchronizing", "空闲": "Idle", "播报中": "Speaking", "已暂停": "Paused", "已停止": "Stopped",
  "已休眠": "Asleep", "休眠待确认": "Sleep unconfirmed", "命令失败": "Command failed", "尚未开始": "Not started",
  "设备回传": "Device reply", "发送命令": "Send command", "模拟设备已连接（仅模拟协议，不播放真实语音）": "Simulator connected (protocol only; no real audio)",
  "连接正在使用": "Connection is already in use", "真实串口请使用桌面程序": "Use the desktop app for real serial devices", "连接已断开": "Connection closed",
  "设备拒绝命令（45）": "Device rejected the command (45)", "设备返回 45：请检查文本与通信参数": "Device returned 45: check text and communication settings",
  "请先连接设备": "Connect a device first", "上一条命令尚未完成": "The previous command has not completed",
  "设备响应超时，结果不确定；请重新连接后读取状态": "Device response timed out; result unknown. Reconnect and read the status.",
  "请先连接空闲设备": "Connect an idle device first", "版本查询：独立采集2秒原始响应": "Version query: isolated 2-second raw capture",
  "版本原始响应（不假定固定长度）": "Raw version response (length unspecified)", "无回传睡眠命令": "Sleep command without reply",
  "请先停止播报再保存参数": "Stop playback before saving parameters", "延时参数超出范围": "Delay values are out of range",
  "请先停止播报": "Stop playback first", "请先停止当前播报或唤醒设备": "Stop the current playback or wake the device first", "请先停止播报再休眠": "Stop playback before sleeping",
  "不支持此编码": "Unsupported encoding", "文本包含不完整 Unicode 字符": "Text contains an incomplete Unicode character",
  "芯片字库不支持补充平面字符，请移除表情等字符": "The chip does not support supplementary Unicode characters. Remove emoji and similar characters.",
  "文本包含无法用 GBK 无损编码的字符": "Text contains characters that cannot be encoded losslessly in GBK",
  "文本超出 GB2312 字符范围，请选择 GBK 或 UTF-8": "Text is outside GB2312. Choose GBK or UTF-8.",
  "未知命令": "Unknown command", "帧数据无效": "Invalid frame data", "请输入播报文本": "Enter speech text",
  "控制标记缺少右方括号": "A control tag is missing its closing bracket", "单个控制标记超过帧容量": "A single control tag exceeds the frame capacity",
  "无效命令帧": "Invalid command frame", "文本不能为空": "Text cannot be empty", "编码不支持": "Unsupported encoding",
  "文本超过400字节安全帧容量，请分段发送": "Text exceeds the 400-byte safe frame capacity. Split it into segments.",
  "参数配置必须使用GBK": "Parameter configuration must use GBK", "特殊参数长度错误": "Invalid special parameter length",
  "特殊参数超出范围": "Special parameters are out of range", "不支持的命令": "Unsupported command", "波特率不支持": "Unsupported baud rate",
  "请先断开当前串口": "Disconnect the current port first", "串口未连接": "Serial port is not connected",
  "版本响应过长，已关闭会话": "Version response is too long; the session was closed",
  "2秒内未收到版本响应，会话已关闭": "No version response within 2 seconds; the session was closed",
};

export function translate<T>(value: T, language: Language): T {
  if (language === "zh" || typeof value !== "string") return value;
  const key = value.trim();
  let translated = english[key];
  if (!translated) {
    const progress = key.match(/^(\d+) \/ (\d+) 段已完成$/);
    if (progress) translated = `${progress[1]} / ${progress[2]} segments complete`;
    else if (key.startsWith("插入 ")) translated = `Insert ${key.slice(3)}`;
    else if (key.endsWith(" 已连接")) translated = `${key.slice(0, -4)} connected`;
    else if (key.startsWith("Error: ")) translated = `Error: ${translate(key.slice(7), language)}`;
  }
  return (translated ? value.replace(key, translated) : value) as T;
}

const I18nContext = createContext({ language: "zh" as Language, setLanguage: (_value: Language) => {}, t: <T,>(value: T): T => value });
export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try { return localStorage.getItem("zhiliao.language") === "en" ? "en" : "zh"; } catch { return "zh"; }
  });
  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = language === "zh" ? "知了1号 · CICADA-1" : "Cicada One · CICADA-1";
    if (isTauri()) void getCurrentWindow().setTitle(document.title).catch(() => {});
    try { localStorage.setItem("zhiliao.language", language); } catch { /* Preferences are optional. */ }
  }, [language]);
  const t = useCallback(<T,>(value: T): T => translate(value, language), [language]);
  return <I18nContext.Provider value={{ language, setLanguage, t }}>{children}</I18nContext.Provider>;
}
export const useI18n = () => useContext(I18nContext);
