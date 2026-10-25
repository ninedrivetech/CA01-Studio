# 构建与发布

所有平台使用 Node.js 22.12+、Rust stable 和已提交的 npm/Cargo 锁文件。前端依赖使用 `npm ci`，Rust 命令使用 `--locked`。

## 本地检查

```sh
npm ci
npm audit --audit-level=moderate
npm test
npm run build
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo test --locked --manifest-path src-tauri/Cargo.toml
cargo clippy --locked --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
```

Windows 的浏览器测试使用 Microsoft Edge；Linux/macOS 先运行 `npx playwright install --with-deps chromium`，再运行 `npm run test:e2e`。测试独立启动 Vite，Windows 使用 1431 端口，Linux/macOS 使用 1432，避免本机与 WSL 并行测试共用服务器。可通过 `CICADA_TEST_PORT` 指定其他端口。测试截图、失败 trace 和报告位于 `test-results/`，不会改写文档截图。

Windows 原生测试：构建后运行 `npm run test:native`，直接启动 release 可执行程序，通过 WebView2 检查界面、IPC、模拟播放与本机日志保存。Linux 原生测试使用 `tauri-driver` 和 WebKitWebDriver，见下文。真实设备播报仍需模块、USB-UART 和扬声器验证。

## Windows

安装 MSVC Build Tools、Windows SDK 及 WebView2 Runtime。

```powershell
node scripts/build-desktop.mjs --bundles nsis --ci
npm run test:native
node scripts/package-release.mjs --local
node scripts/build-provenance.mjs --local
node scripts/verify-release.mjs
```

NSIS 安装器与包含 exe、许可证及文档的便携 ZIP 输出到 `release/`。省略 `--local` 可生成标准发布文件名。

## Linux / 本机 WSL

推荐 Ubuntu 22.04 或更新版本。WSL 使用 Linux 自己的 Node/Rust 工具链，将源码复制到 WSL 的 ext4 文件系统；避免复用 Windows `node_modules` 或 `target`。

```sh
sudo apt-get update
sudo apt-get install -y build-essential libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libudev-dev libfuse2
npm ci
npm test
npm run build
cargo test --locked --manifest-path src-tauri/Cargo.toml
node scripts/build-desktop.mjs --bundles deb,appimage --ci
node scripts/package-release.mjs --local
node scripts/build-provenance.mjs --local
node scripts/verify-release.mjs
```

输出 Debian 安装包、AppImage 和免安装 tar.gz。tar.gz 依赖系统 GTK 3 / WebKitGTK 4.1；AppImage 支持 `--appimage-extract-and-run`。串口权限可通过加入 `dialout` 用户组后重新登录获得。

原生自动测试需要 `webkit2gtk-driver`、`xvfb`、`dbus-x11` 及 `cargo install tauri-driver --locked --version 2.1.0`，然后运行 `xvfb-run -a dbus-run-session -- node scripts/linux-native-smoke.mjs`。

## macOS

安装 Xcode Command Line Tools 后运行本地检查，再构建：

```sh
node scripts/build-desktop.mjs --bundles app,dmg --ci
npm run package:release
node scripts/build-provenance.mjs
```

输出 DMG 与包含 `.app` 的便携 ZIP，架构由运行构建的 Mac 决定。当前流程不使用 Apple 开发者证书签名或公证。

正式打包要求工作树干净：先完成测试并 commit，再运行上述构建脚本。脚本会在成功构建后记录源码提交、版本和输入文件哈希；打包时检查记录，拒绝使用旧二进制或未提交源码。`build.json` 也计入发布校验和。

Tauri 会在 Windows 上以 LF 序列化 `Cargo.toml`；仓库通过 `.gitattributes` 固定该文件使用 LF，云端 Windows 也使用 LF 检出，避免仅由 CRLF → LF 转换触发源码状态门禁。该门禁仍拒绝真实内容变化。

## GitHub Actions

[发布工作流](../.github/workflows/release.yml)支持推送 `v*` 标签和手动触发。标签必须等于 `package.json` 与 Tauri 的版本，且构建提交必须与标签一致。

工作流在 Windows、Ubuntu 和 macOS 分别运行依赖审计、单元测试、浏览器测试、Rust 测试、fmt/Clippy 检查，再打包各平台产物；Windows 和 Linux 另运行打包程序原生冒烟。所有构建成功后，发布任务下载并验证 SHA-256，才上传到 Release。任意平台失败都会阻止自动发布。

Windows 托管 runner 以管理员身份运行时，WebView2 会忽略环境变量中的浏览器参数。原生测试因此只对 `zhiliao-studio.exe` 临时设置 HKLM 的 `AdditionalBrowserArguments`，在本机调试端口进行验证，测试结束后恢复原有值。发布程序没有内置调试端口。该行为见 [Microsoft 的高权限 WebView2 说明](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/security#for-an-elevated-host-app-use-appropriate-override-flags)。

Linux 原生脚本会等待控件可用，避免设备同步与后台编码完成时间不同造成抢先点击。云端脚本从工作流自身的固定提交读取到 runner 临时目录，报告记录 `harnessCommit`；应用和安装包仍绑定发布标签的源码，测试脚本不会改动构建工作树。

在仓库中手动触发：

```sh
gh workflow run release.yml --ref main -f tag=v1.0.0
gh run list --workflow release.yml
```

第三方声明覆盖 Windows、Linux 与 macOS 的依赖。更新锁文件后先运行 `npm run notices` 再构建安装包。各产物附校验和及 `build.json`，其中包含源码提交、工作树状态、架构、工具链与 Actions 运行编号。

回退：恢复上一个验证通过的发布标签；修复前保留旧版 Release 文件，不把未完成验证的产物覆盖到旧版本。源码改动通过 revert 对应提交回退，无数据格式迁移。
