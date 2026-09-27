<p align="center">
  <img src="docs/assets/cicada-logo.svg" alt="CICADA-1 logo" width="152" height="152">
  &nbsp;&nbsp;&nbsp;&nbsp;
  <img src="docs/assets/ninedrive-logo.jpg" alt="玖驱科技 · NINEDRIVE TECH SHANGHAI" width="152" height="152">
</p>

<h1 align="center">知了1号 · CICADA-1</h1>

<p align="center">
  <a href="README.md"><img src="https://img.shields.io/badge/语言-简体中文-22314E?style=for-the-badge" alt="简体中文"></a>
  <a href="docs/README.en.md"><img src="https://img.shields.io/badge/Language-English-3776AB?style=for-the-badge" alt="English documentation"></a>
  <a href="docs/README.fr.md"><img src="https://img.shields.io/badge/Langue-Français-0055A4?style=for-the-badge" alt="Documentation française"></a>
</p>

<p align="center">
  面向知了1号语音合成模块的开源串口工作台
</p>

<p align="center">
  <a href="https://v2.tauri.app/"><img src="https://img.shields.io/badge/Tauri-2-24C8D8?style=flat-square&amp;logo=tauri&amp;logoColor=white" alt="Tauri 2"></a>
  <a href="https://www.rust-lang.org/"><img src="https://img.shields.io/badge/Rust-000000?style=flat-square&amp;logo=rust&amp;logoColor=white" alt="Rust"></a>
  <a href="https://react.dev/"><img src="https://img.shields.io/badge/React-19-149ECA?style=flat-square&amp;logo=react&amp;logoColor=white" alt="React 19"></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.8-3178C6?style=flat-square&amp;logo=typescript&amp;logoColor=white" alt="TypeScript 5.8"></a>
  <img src="https://img.shields.io/badge/Version-1.0.0-22314E?style=flat-square" alt="Version 1.0.0">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache--2.0-blue?style=flat-square&amp;logo=apache&amp;logoColor=white" alt="Apache License 2.0"></a>
</p>

知了1号（CICADA-1）通过 UART 连接语音合成模块，让你在一个窗口里编辑播报文本、配置声音、插入提示音，并查看原始通信报文。桌面端使用 Tauri、Rust 与 React/TypeScript，声音由模块及其扬声器输出。

## 功能

- **串口连接**：设备名称与端口搜索、手动输入端口，支持 9600 / 57600 / 115200 / 460800 波特率。
- **文本播报**：GB2312、GBK、UTF-16LE、UTF-16BE、UTF-8 编码，自动分段与连续播放，支持暂停、继续和停止。
- **声音配置**：八种发音人、音量、语速、语调及中文读法设置，保存、读取和恢复默认参数。
- **文本工具**：13 种内置提示音、控制标记、UTF-8 文本导入和本机草稿保存。
- **通信记录**：HEX 收发记录、搜索、方向筛选、日志导出和逐段报文预览。
- **设备与外观**：功放延时、休眠、唤醒、版本响应读取，四种主题及中英文应用界面。

<p align="center"><img src="docs/screenshots/dashboard-night.png" alt="知了1号工作台：文本编辑、声音参数和通信记录" width="960"></p>

## 四种主题

初鸣、林鸣、夜鸣、明翼，分别呈现暖白、浅绿、深青与高对比配色。在设置中切换主题，偏好自动保存。

<p align="center">
  <a href="docs/screenshots/themes-overview.png"><img src="docs/screenshots/themes-overview.png" alt="四主题对照：初鸣、林鸣、夜鸣、明翼" width="1200"></a>
</p>

## 快速开始

### 环境

桌面使用环境为 Windows 10/11。准备 Node.js 20 或更新的 LTS 版本、Rust stable（MSVC 工具链）、Microsoft C++ Build Tools（含“使用 C++ 的桌面开发”组件及 Windows SDK），以及 Microsoft Edge WebView2 Runtime。Tauri 的依赖安装说明见[官方环境指南](https://v2.tauri.app/start/prerequisites/)。

### 从源码启动

在项目根目录运行：

```powershell
npm ci
npm run desktop
```

仅浏览界面时可运行：

```powershell
npm run dev
```

打开 <http://127.0.0.1:1430> 并选择模拟设备。浏览器模式不访问真实串口，也不合成声音。

### 连接并播报

1. 将 USB 转 UART 的 TX 接模块 RX、RX 接模块 TX，并连接 GND；按模块要求供电并连接扬声器。
2. 选择实际串口及与 BAUD0/BAUD1 引脚配置一致的波特率，点击连接。
3. 输入文本、选择编码，确认字节数和分段预览后点击“开始播报”。
4. 在“语音参数”调整声音，点击保存写入模块；在通信记录中查看收发内容。

UART 电平必须与模块匹配。软件选择波特率只配置主机串口，不会改变模块引脚配置。模块支持中文字库和英文字母，不提供英文单词语音合成；表情等补充平面字符不能发送。

## 文档

| 文档 | 内容 |
| --- | --- |
| [使用指南](docs/USER_GUIDE.md) | 接线、连接、播报、声音设置、提示音、日志及常见问题 |
| [通信协议](docs/PROTOCOL.md) | UART 参数、帧结构、命令、回传、编码及控制标记 |

每段文本最多 **400 字节**，工作台收到上一段的 `4F` 完成回传后才发送下一段。文本中的控制标记会全局生效并掉电保存；恢复全部默认参数使用 `[d][m3]`。

README 提供[中文](README.md)、[English](docs/README.en.md) 和 [Français](docs/README.fr.md) 三种版本；详细指南与协议为中文，应用界面支持中文和英文。

## 许可证

本项目采用 [Apache License 2.0](LICENSE)。第三方组件的许可证与声明见 [THIRD-PARTY-NOTICES.txt](THIRD-PARTY-NOTICES.txt)。
