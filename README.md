# MEMS-CMS

MEMS-CMS 是面向东北大学机械工程与自动化学院 MEMS 实验室的状态监测上位机系统。系统基于 Web 技术和 Electron 封装，支持串口、WebSocket、MQTT、UDP 等多种数据接入方式，可通过项目 JSON 文件定义协议解析、公式换算和仪表盘显示，用于轴承、轴瓦、齿轮箱等实验设备的实时数据采集、解析、绘图和导出。

## 下载软件

请前往 Releases 页面下载最新安装包：

https://github.com/victoray4ever/web-serial-studio-smart-bearing/releases

## 主要功能

- 实时监测仪表盘：支持折线图、仪表盘、柱状图、FFT、数据表格等控件。
- 项目 JSON 解析：通过项目文件定义帧头帧尾、字段偏移、字节序、数组长度、换算公式和显示方式。
- 完整帧解析模式：协议字段按完整数据帧填写，帧头、帧尾和有效载荷均可在项目编辑器中统一定义。
- 多数据源接入：支持多 MQTT 主题、多 UDP sourceId、不同协议项目分流解析和分开显示。
- 串口接入：支持常用波特率和自定义波特率，桌面端提供更完整的串口选择信息。
- MQTT 接入：Electron 软件端支持直接连接 `mqtt://host:1883` 或启用 SSL/TLS 后连接 `mqtts://host:port`，不依赖浏览器 WebSocket MQTT 端口。
- UDP 接入：Electron 内置 Node.js UDP 网关，普通用户无需安装 Python 环境即可使用 UDP 桥接或多 UDP 网关。
- 数据导出：支持全局 CSV 导出，也支持在单个图表中导出当前图表解析数据或对应原始帧数据。
- FFT 分析：支持采样率配置、FFT 点数选择、Hann 窗函数、Hz 横轴、峰值频率和幅值标注。
- 项目编辑器：提供字段编辑器、公式编辑器、显示编辑器，可在界面中配置解析字段、换算公式和绘图控件。
- 主题和语言：支持浅色/深色主题与中英文界面。
- 自动更新：桌面软件支持基于 GitHub Releases 的更新检查和安装。

## 技术栈

- Electron
- 原生 JavaScript ES Modules
- HTML / CSS
- Chart.js
- MQTT.js
- Node.js UDP / MQTT 驱动
- electron-builder
- electron-updater

## 目录结构

```text
.
|-- electron/                 # Electron 主进程、预加载脚本、内置 UDP 网关、串口选择窗口
|-- src/
|   |-- core/                 # 应用状态、解析器、事件总线、国际化
|   |-- io/                   # 串口、WebSocket、MQTT、UDP 驱动
|   |-- ui/                   # 工具栏、侧边栏、项目编辑器、偏好设置
|   |-- widgets/              # Plot、Gauge、FFT、DataGrid 等仪表盘控件
|   `-- styles/               # 界面样式
|-- scripts/                  # 兼容旧版的 Python UDP 桥接脚本和网关配置
|-- build/                    # 软件图标等构建资源
|-- dist/                     # 打包输出目录
|-- index.html                # 渲染进程入口
|-- package.json              # npm 脚本和 electron-builder 配置
`-- frame_parsing_guide.md    # 协议解析说明
```

## 本地开发运行

先安装依赖：

```bash
npm install
```

启动 Electron 桌面版：

```bash
npm start
```

运行基础冒烟测试：

```bash
npm run smoke
```

## 打包软件

生成当前平台的安装包：

```bash
npm run dist
```

仅生成 Windows 安装包：

```bash
npm run dist:win
```

仅生成 Linux 安装包：

```bash
npm run dist:linux
```

仅生成 macOS 安装包：

```bash
npm run dist:mac
```

生成未压缩的本地调试版本：

```bash
npm run pack
```

打包结果输出到 `dist/`。注意：修改源码后，`dist/win-unpacked/MEMS-CMS.exe` 不会自动更新，需要重新执行打包命令。

## GitHub 发布和自动更新

本项目使用 `electron-builder` 和 `electron-updater` 支持 GitHub Releases 更新。

发布新版本的一般流程：

1. 修改 `package.json` 中的 `version`，例如从 `1.0.1` 改为 `1.0.2`。
2. 提交并推送源码。
3. 设置 GitHub Token：

```powershell
$env:GH_TOKEN="你的 GitHub Token"
```

4. 发布 Windows 安装包：

```bash
npm run release:win
```

该命令会构建安装包并上传到 `package.json` 中 `build.publish` 指定的 GitHub Release。用户安装正式版后，软件可在后续版本发布时检查并下载安装更新。

说明：

- 自动更新依赖 GitHub Release 中的安装包和 `latest.yml`。
- `win-unpacked` 主要用于本地调试，不适合作为自动更新发行版本。
- 如果只是运行 `dist/win-unpacked/MEMS-CMS.exe`，没有更新元数据时软件会跳过更新检查。

## 数据接入方式

### 串口

适合直接连接 USB 转串口、CH343、虚拟串口等设备。用户在软件中选择串口后，根据左侧串口配置设置波特率、数据位、停止位和校验位。

### WebSocket

适合已有 WebSocket 服务或外部桥接程序。浏览器版和桌面版均可使用。

### MQTT

桌面版支持直接连接标准 MQTT Broker：

```text
mqtt://主机:1883
```

启用 SSL/TLS 后使用：

```text
mqtts://主机:端口
```

支持单主题和多主题订阅。多主题可绑定不同 `sourceId`，再由项目文件中的 `sources` 配置分流到不同解析器。

### UDP

桌面版内置 UDP 网关，支持两种典型模式：

- 兼容 UDP 桥接：单个 UDP 数据源通过内置网关转入系统。
- 多 UDP 网关：多个 UDP 设备汇入网关，通过 `sourceId` 区分来源，并按不同项目配置解析。

浏览器环境不能直接打开 UDP 端口，因此网页部署时仍需要外部桥接；桌面软件不需要用户额外安装 Python。

## 项目 JSON 解析

项目 JSON 是系统实现通用解析的核心。它用于描述：

- 项目名称和协议模式
- 帧头、帧尾、帧长度等完整帧结构
- 字段类型，例如 `uint8`、`int16`、`int24`、`uint32`、定长数组、变长数组
- 字节序，例如 BE 高字节在前、LE 低字节在前
- 字段偏移和数量
- FIFO 通道、数组拆分方式和通道公式
- 数据集公式，例如温度、电压、应变、振动加速度换算
- 显示控件类型、量程、单位、索引和是否启用 Plot / Gauge / FFT / DataGrid
- 多 MQTT / 多 UDP 数据源与项目解析器的映射关系

因此接入新设备时，优先通过项目编辑器或新建项目 JSON 完成协议描述。只有当设备协议出现项目文件无法表达的新结构时，才需要修改程序代码。

## 常见使用流程

1. 启动 MEMS-CMS。
2. 选择通信接口：串口、WebSocket、MQTT 或 UDP。
3. 配置连接参数。
4. 打开或编辑项目 JSON。
5. 点击连接，查看仪表盘实时数据。
6. 根据需要调整图表量程、FFT 参数、历史点数和布局。
7. 使用全局 CSV 导出或单个图表导出保存数据。

## 注意事项

- 串口、MQTT、UDP 的硬件参数必须与设备端一致。
- 项目文件采用完整帧偏移，字段位置应从帧头第 0 字节开始计算。
- MQTT 多主题解析时，主题和 `sourceId` 映射必须与项目文件中的 `sources` 保持一致。
- UDP 多设备接入时，应确保每个设备有稳定的 `sourceId` 或固定 IP 映射。
- 打包前如果 `dist/win-unpacked` 中的文件被正在运行的软件占用，需要先关闭 MEMS-CMS 再重新打包。

## 推荐仓库简介

```text
MEMS-CMS desktop condition monitoring system with Serial, MQTT, UDP, project JSON parsing, real-time charts, FFT and data export.
```
