# CICADA-1 v1.0.0

知了1号串口语音工作台：中英文界面、四种主题、文本分段播报、语音参数管理和通信日志。

- 修复串口旧任务跨越重连、版本采集取消和写入失败后的会话状态。
- 防止导入期间覆盖新草稿，参数保存和读回期间锁定输入。
- 优化深色原生控件、连接状态、键盘报文阅读及串口搜索的辅助技术语义。
- 更新构建和测试依赖，提供跨平台安装包、便携包、SHA-256 校验和与构建来源记录。

## Downloads / 下载

| Platform | Installer | Portable |
| --- | --- | --- |
| Windows x64 | `*-windows-x64-setup.exe` | `*-windows-x64-portable.zip` |
| Linux x64 | `*-linux-x64-installer.deb` | `*-linux-x64-portable.AppImage` / `*-portable.tar.gz` |
| macOS | `*-macos-*-installer.dmg` | `*-macos-*-portable.zip`（内含 `.app`） |

`-local` 文件来自 Windows 本机或本机 WSL；不带 `-local` 的文件由 GitHub Actions 构建。各平台的 `SHA256SUMS.txt` 可验证下载内容，`build.json` 记录源码提交和工具链。

Windows 需要 WebView2 Runtime（安装器会检查并安装）；Linux 需要 GTK 3、WebKitGTK 4.1 和串口访问权限，AppImage 可使用 `--appimage-extract-and-run` 避免 FUSE 依赖。Linux tar.gz 是免安装的本机依赖版本。macOS 构建未使用 Apple 开发者证书签名或公证，需要在系统安全设置中允许运行。

模拟器只演示协议与界面；真实声音需要模块和扬声器。自动测试不代表真实模块在所有平台上完成了硬件验证。
