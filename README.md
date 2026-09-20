# 知了1号 · CICADA-1

作者：**Mzee** · 联系邮箱：**xiemaths@outlook.com**

公司：**上海玖驱科技有限公司**

参考 `D:\Desktop\df01-studio` 的 Tauri 2 + Rust + React/TypeScript 架构，构建知了1号语音合成模块工作台。英文代号 **CICADA-1**，取自知了的英文 cicada。支持简体中文与English界面；首页集中展示连接、文本与提示音、语音参数、日志和发送预览，顶部状态栏的齿轮图标打开设置子窗口。

## 启动

需要 Node.js 20+、Rust stable、Windows C++ Build Tools 与 WebView2。

```powershell
npm install
npm run desktop
```

只预览界面与模拟协议：`npm run dev`，访问 http://127.0.0.1:1430 。浏览器不访问真实串口；模拟器不合成声音，真实声音由知了1号模块及其扬声器输出。

Windows 便携程序位于 `release/zhiliao-1.0.0-windows-x64-portable.zip`，解压后运行 `zhiliao-studio.exe`，需要系统安装 WebView2。使用步骤见 [使用指南](docs/USER_GUIDE.md)。

重新发布：`npm run bundle` → `npm run test:native` → `npm run notices` → `npm run package:portable`（打包脚本需要 PowerShell 7）。当前提供免安装便携包，不生成安装器；原始发布程序位于 `src-tauri/target/release/zhiliao-studio.exe`。

## 功能

- 串口选择器显示系统设备名称，例如USB-SERIAL CH340 (COM9)，支持名称/端口搜索、键盘选择、手动输入端口。9600/57600/115200/460800波特率，固定8N1无流控。
- 顶部语言图标及设置中的界面语言选项切换中英文，记住本机偏好；菜单、状态、应用错误和日志说明同步翻译，播报文本、设备名称和HEX报文原样保留。
- GB2312、GBK、UTF-16LE、UTF-16BE、UTF-8 编码与字节计数；统一采用400字节安全分段，尽量在句末分段，保护控制标记与提示音名称，收到上一段4F后才发送下一段。
- 开始、暂停、继续、停止、状态查询；断开清除队列，超时断开并提示结果不确定。
- 八种发音人、音量、语速、语调及八项中文读法设置；显式保存、读取确认、恢复默认。
- 13种提示音插入、示例文本、UTF-8文本文件导入、草稿保存、控制标记示例。
- 功放特殊延时设置和读取，有回传/无回传两种休眠与唤醒，版本原始响应采集。
- 原始HEX收发记录、搜索与方向过滤、暂停显示、清空、日志下载、待发送帧预览。
- 文本在后台线程编码与分段，快速改写时只接受最新结果；UTF-8 导入严格校验，失败保留草稿；草稿防抖保存并在页面关闭时写入最新值。
- 分段进度条、可展开日志、筛选恢复入口与逐段报文预览；手机首页扩大点击区域，短窗口支持滚动。
- 初鸣 / First Song、林鸣 / Grove、夜鸣 / Nocturne、明翼 / Clearwing 四主题，保留原有主题偏好；设置子窗口支持键盘焦点循环、Esc关闭及返回设置按钮，外观即时保存。

## 验证

```powershell
npm test
npm run build
npm run test:e2e
cargo test --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

协议依据、型号专属限制与文档冲突处理见 [docs/PROTOCOL.md](docs/PROTOCOL.md)。浏览器流程测试默认使用 Microsoft Edge，截图写入 `docs/screenshots/`。

已执行的软件验证结果见 [验证记录](docs/VERIFICATION.md)，实际模块验收见 [实机验收表](docs/ACCEPTANCE.md)。原生测试使用隔离 WebView2 配置目录及固定本地调试端口9236，验证后关闭其自行启动的进程。

## 目录

`src/lib/device.ts` 会话状态、队列、模拟器；`src-tauri/src/main.rs` 原生串口及帧校验；`src/Dashboard.tsx` 首页工作台；`src/components/SettingsDialog.tsx` 设置子窗口；`tests/` 浏览器工作流测试。

`src/lib/protocolCore.ts` 为轻量帧定义与回传解析，`src/lib/protocol.ts` 负责文字编码与安全分段，`src/lib/speech.worker.ts` 在后台处理文本。设置中的“关于”区域展示作者与公司信息。

## 使用边界

电脑的UART电平须与模块匹配，TX/RX交叉连接且共地。波特率由模块 BAUD0/BAUD1 引脚决定，软件选择不能替代硬件配置。模块支持中文字库及英文字母，不是英文单词语音引擎。不支持补充平面字符（如表情），软件会阻止发送。

控制标记全局生效并掉电保存；[d]不恢复发音人，[d][m3]才恢复全部默认。COM9已执行真实协议测试，报告见docs目录；模拟器不替代实际硬件的音色、串口电气及时序验收。实听效果仍需人工确认。
