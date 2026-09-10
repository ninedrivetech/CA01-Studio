# 软件验证记录

验证环境：Windows x64、Node.js 24.13.0、Rust 1.96.0、Microsoft Edge / WebView2。日期：2026-09-10 至 2026-09-11。

| 项目 | 结果 | 覆盖范围 |
| --- | --- | --- |
| TypeScript + Vite 生产构建 | 通过 | React界面、编码表、IPC调用代码编译 |
| Vitest | 21项通过 | 原有协议与会话19项；动态进度/错误翻译和原始文本保留，串口描述不重复附加COM号 |
| Playwright | 7组通过 | 原有工作台、参数、播放、延时、休眠、日志、主题与布局5组；新增完整英文界面、状态/错误/日志翻译、语言持久化及草稿/参数保留；串口描述、搜索、键盘选择和手动输入。中文1100×760/1280×820/1920×1080首屏与两种密度通过，英文1100/375宽度无水平溢出 |
| Rust测试 | 4项通过 | 非法命令/长度、400字节安全容量、功放延时上下界；USB友好名称与原始串口路径分别保留 |
| Rust Clippy | 通过 | 全部目标，warnings作为错误 |
| Tauri release | 通过 | Windows x64原生程序编译、打包嵌入前端离线资源 |
| 原生WebView2验证 | 通过 | 离线页面、真实串口枚举、后端命令拒绝、模拟播放、日志导出内容、窗口最大化还原及关闭、错误端口可见反馈 |

截图：`screenshots/dashboard-amber.png`、`dashboard-night.png`、`dashboard-mobile.png`、`settings-amber.png`、`settings-night.png`、`settings-forest.png`、`settings-contrast.png`、`settings-mobile.png`、`native-release.png`、`native-settings.png`。原生验证详情以 `screenshots/native-report.json` 为准。

最新界面版本使用CICADA-1代号；顶部状态栏齿轮打开设置子窗口，语言图标和设置窗口均可切换中文/English。串口接口返回name/description/manufacturer，列表显示系统友好名称并只将name用于连接。截图新增dashboard-en.png、settings-en.png、native-ports.png、native-settings-en.png。协议发送与400字节长文本队列没有修改，以下COM9实机播放记录来自本次界面重构之前的已验证版本。

本次发布程序实际枚举5个端口：COM9为USB-SERIAL CH340 (COM9)，厂家wch.cn；COM3–COM6为蓝牙链接上的标准串行，厂家Microsoft。原生截图验证了列表完整名称、当前设备定位、顶部设置齿轮和中英文子窗口；系统窗口标题也随语言切换。枚举与界面测试未向这些实际端口发送命令，语音操作使用模拟会话。详情见screenshots/native-report.json。

## 证据边界

COM9、115200、8N1已执行真实协议测试：五种编码短文本、八种发音人播放回传、暂停/恢复/停止/状态查询、参数保存读回。容量扫描发现五种编码500字节接收成功而512字节拒绝；软件使用400字节安全分段。报告为`com9-hardware-report.json`、`com9-capacity-report.json`、`com9-boundary-report.json`。测试完成恢复原始配置（m56/v6/s22/t9，特殊延时0/0/50ms）。

长文本修复前后使用同一段792字符、2376字节UTF-8文本。旧版按2000字节容量发送，收到45拒绝（`com9-long-before-report.json`）；新版发布程序分为6段，2026-09-11北京时间01:01:09至01:02:57自然完成全部分段，约109秒，无错误。测试临时使用m3/v3/s30/t5，结束后保存并读回恢复m56/v6/s22/t9。结果见`com9-long-report.json`及`screenshots/com9-long-completed.png`。先前一次并行原生窗口测试导致长文本窗口关闭，未计为通过；恢复原参数后，上述独立重测通过。

上述实机测试依据收发报文和完成回传，未人工听评音色与内容。尚未验证电气波形、精确字节间隔、功放POP效果、物理拔插以及掉电参数保持。此类项目保留在实机验收表中。软件发送采用完整帧写入及帧间隔约束。

版本号58按独立2秒窗口采集原始字节，查询后关闭会话，避免未定义长度的版本响应残留影响后续状态解析；结果不假定为完整或结构化版本号。无回传睡眠22仅显示“休眠待确认”，不把写入成功当作设备睡眠确认；88则等待4B。BIG5不在型号支持列表中，不提供其发送选项。
