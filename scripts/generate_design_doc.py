from copy import deepcopy
from datetime import date
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
import argparse
import textwrap
import xml.etree.ElementTree as ET


W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture"
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XML_NS = "http://www.w3.org/XML/1998/namespace"

ET.register_namespace("w", W_NS)
NS = {
    "w": W_NS,
    "a": A_NS,
    "pic": PIC_NS,
    "wp": WP_NS,
    "r": R_NS,
}

DESKTOP = Path.home() / "Desktop"
DEFAULT_TEMPLATE = DESKTOP / "Web Serial Studio网页版监测系统设计说明书.docx"
DEFAULT_OUTPUT = DESKTOP / "Web Serial Studio网页版监测系统设计说明书-新版.docx"

FIGURE_SPECS = {
    "FIGURE_1": {"embed_id": "rId6", "media_name": "image1.png", "size": (5274310, 2611120)},
    "FIGURE_2": {"embed_id": "rId7", "media_name": "image2.png", "size": (5274310, 2960000)},
    "FIGURE_3": {"embed_id": "rId8", "media_name": "image3.png", "size": (5050000, 2920000)},
    "FIGURE_4": {"embed_id": "rId9", "media_name": "image4.png", "size": (5050000, 2920000)},
    "FIGURE_5": {"embed_id": "rId10", "media_name": "image5.png", "size": (5050000, 2920000)},
    "FIGURE_6": {"embed_id": "rId11", "media_name": "image6.png", "size": (5050000, 2920000)},
    "FIGURE_7": {"embed_id": "rId12", "media_name": "image7.png", "size": (5250471, 2680000)},
}


def build_doc_text() -> str:
    today = date.today()
    date_text = f"{today.year}年{today.month}月{today.day}日"
    return textwrap.dedent(
        f"""
        # Web Serial Studio网页版监测系统设计说明书
        部门：智能感知与设备监测项目组
        编制：项目协作组
        审核：待补充
        日期：{date_text}

        一、总体依据

        1.1 设计概要
        面向嵌入式设备联调、工业遥测采集、教学演示与轻量化在线监测场景，设计并实现一套运行于浏览器端的 Web Serial Studio 网页版监测平台。系统以静态前端部署为基础，以多协议数据接入、实时帧解析、项目化界面配置和可视化展示为核心，构建从数据接收、协议处理、状态管理到仪表盘呈现的完整闭环。
        当前版本在保留 STM32 轴承监测案例支持的同时，已扩展为通用遥测平台。平台可用于串口设备调试、WebSocket 和 MQTT 数据接入、项目文件驱动的仪表盘装配、控制台日志观察、CSV 会话导出以及多语言主题化展示，具备较强的复用性与演示价值。

        1.2 功能设计
        本系统围绕“接入、解析、配置、展示、导出、部署”六条主线组织功能，形成浏览器端单页应用框架下的完整监测能力体系。
        （1）多协议接入功能
        系统已实现 Serial、WebSocket、MQTT 三类接入方式。串口模式面向本地 Web Serial API 环境，WebSocket 模式面向局域网与云端转发场景，MQTT 模式面向 Broker 发布订阅链路。界面同时预留 Bluetooth 入口与配置说明，用于后续 Web Bluetooth 驱动扩展，但当前版本尚未接入实际蓝牙驱动。
        （2）数据解析与模式切换功能
        系统支持 Quick Plot、Device Sends JSON、Project File、STM32 Binary 四种工作模式。Quick Plot 用于逗号分隔数值的快速绘图；Device Sends JSON 用于设备自描述界面布局；Project File 用于通过 JSON 项目文件定义仪表盘；STM32 Binary 用于对专用二进制帧进行解析。针对 MQTT 场景，解析层还增加了边界对齐、十六进制 ASCII 负载识别以及直接载荷解析机制，以提升非标准消息输入下的稳定性。
        （3）项目化配置与编辑功能
        系统支持项目文件打开、保存与 JSON 应用，当前版本新增项目编辑器弹窗，可在浏览器内对项目标题、分组、数据集、量程、控件类型及启用特性进行编辑，并即时应用到仪表盘。结合 `projects/stm32-bearing.json`，可快速复现 STM32 轴承监测案例页面。
        （4）可视化与调试辅助功能
        平台提供 Dashboard 与 Console 双工作区。Dashboard 用于展示折线图、仪表、柱状图、指南针、数据表和加速度控件；Console 用于查看收发日志、切换十六进制显示、暂停滚动、导出控制台记录和发送指令。底部任务栏用于切换工作区并显示当前模式与项目状态。
        （5）偏好设置与数据导出功能
        偏好设置弹窗支持主题、语言、绘图历史点数、串口默认参数、分帧方式以及 CSV/控制台导出偏好设置。CSV 会话管理模块支持连接结束后自动保存到目录，也支持在浏览器能力不足时自动回退为下载导出，满足轻量化部署条件下的数据留存需求。

        1.3 适用范围与性能指标
        本系统适用于浏览器端串口调试、实验平台数据观测、远程 Broker 数据监测、教学演示、轻量级在线仪表盘发布等场景。当前版本的主要性能与能力指标如下：
        - 支持 Serial、WebSocket、MQTT 三类实际可用接入方式；
        - 支持 Quick Plot、Device Sends JSON、Project File、STM32 Binary 四种工作模式；
        - 支持 Dashboard / Console 双工作区、任务栏状态显示和 Toast 提示；
        - 支持项目文件加载、浏览器内项目编辑、JSON 结构应用和多控件组合展示；
        - 支持 CSV 会话自动保存、手动导出与下载回退；
        - 支持中英文切换、浅色/深色主题切换及静态站点部署；
        - 支持 STM32 轴承监测专用项目文件与专用二进制解析案例。

        二、核心技术架构

        2.1 总体技术路线
        本系统采用纯前端静态架构，入口页面为 `index.html`，各功能模块通过 ES Modules 方式组织。系统不依赖后端业务服务，可直接运行在本地 HTTP 服务或 GitHub Pages 等静态托管环境中。总体上可划分为数据输入层、接入管理层、状态与解析层、界面与交互层、部署与访问层五个部分。
        状态与配置由 `AppState.js` 统一管理，模块间通过 `EventBus.js` 实现松耦合通信；连接层由 `ConnectionManager.js` 调度不同驱动接入原始数据；解析层由 `FrameParser.js` 识别 CSV、JSON 与 STM32 Binary 帧；项目结构由 `ProjectModel.js` 负责抽象；会话导出由 `CsvSessionManager.js` 管理；最终通过 Dashboard、Console、PreferencesDialog 与 ProjectEditorDialog 构成完整交互界面。

        [[FIGURE_1]]
        图1 Web Serial Studio 平台总体架构图

        2.2 数据流与运行流程
        运行过程中，外部设备、项目文件或演示模拟器产生数据与配置输入；ConnectionManager 根据当前总线类型选择 SerialDriver、WebSocketDriver 或 MqttDriver 完成连接；FrameParser 对接收到的原始数据进行帧识别与协议解析；解析结果通过事件总线分发给 Dashboard、Console 与 CSV 会话管理器；AppState 持续保存运行模式、连接状态、总线类型、主题语言和导出偏好等信息；界面层根据项目模型和实时数据更新控件视图。
        在 STM32 案例中，项目文件 `projects/stm32-bearing.json` 预先定义了高频振动、应变与温度等分组和控件布局；当二进制帧进入解析器后，系统会提取加速度、三路应变及两路温度数据，并映射到 Plot、Gauge、DataGrid 等组件中，形成与通用平台一致的可视化工作流。

        三、系统结构设计

        3.1 设计方案

        3.1.1 总体界面结构
        当前系统采用单页应用结构。页面自上而下由顶部工具栏、主体工作区和底部任务栏组成。主体工作区左侧为设备设置侧栏，右侧为 Dashboard 或 Console 内容区域。顶部工具栏承担项目打开、保存、导出、接口切换、演示模拟、偏好设置与项目编辑器入口等功能；左侧设备设置栏承担模式切换、驱动参数配置、JSON 编辑、CSV 导出开关和状态显示等功能；底部任务栏用于切换 Dashboard 与 Console 工作区并展示当前模式与项目状态。

        [[FIGURE_2]]
        图2 系统主界面与仪表盘首页

        3.1.2 主要技术参数
        系统主要技术参数如下：
        - 前端技术栈：HTML、CSS、Vanilla JavaScript、ES Modules；
        - 图表绘制：Chart.js；
        - MQTT 接入：mqtt.js 浏览器版；
        - 状态管理：AppState + EventBus；
        - 已实现总线：Serial、WebSocket、MQTT；
        - 预留总线：Bluetooth；
        - 已实现模式：Quick Plot、Device Sends JSON、Project File、STM32 Binary；
        - 主要界面模块：Toolbar、Sidebar、Dashboard、Console、PreferencesDialog、ProjectEditorDialog；
        - 部署方式：本地 HTTP 服务、GitHub Pages 静态部署。

        3.2 系统组成

        3.2.1 状态管理与事件机制设计
        `AppState.js` 统一维护操作模式、总线类型、连接状态、串口配置、WebSocket 配置、MQTT 配置、分帧配置、项目对象、主题语言、CSV 导出开关、任务栏工作区等核心信息。模块间不直接强耦合调用，而是通过 `EventBus.js` 分发 `state:*`、`project:*`、`ui:*`、`frame:*`、`console:*` 等事件，实现主界面、侧栏、控制台、仪表盘和导出模块之间的松耦合联动。

        3.2.2 连接与通信设计
        `ConnectionManager.js` 根据当前总线类型调度相应驱动建立连接并接收原始数据。串口驱动基于浏览器 Web Serial API；WebSocket 驱动面向远程实时数据流；MQTT 驱动通过 WebSocket 端点接入 Broker，并在侧栏中提供协议版本、主题、路径、SSL、QoS 等配置项及浏览器端点预览。Bluetooth 当前仅提供 UI 入口和配置文案，用于后续接入，不纳入当前已实现驱动范围。

        3.2.3 解析与项目模型设计
        `FrameParser.js` 是数据处理核心。该模块既可对文本帧按分隔符解析，也可在 Device Sends JSON 模式下提取由 `/* ... */` 包裹的 JSON 结构，还可针对 STM32 Binary 模式执行专用二进制帧识别、载荷切片和工程量换算。对于 MQTT 输入，解析器同时支持直接二进制负载、十六进制 ASCII 负载以及跨消息边界的对齐处理。`ProjectModel.js` 则负责项目标题、分组、数据集及量程定义的验证、增删改和导出。

        3.2.4 界面与交互设计
        `Dashboard.js` 负责空状态引导、自适应布局、项目化控件生成和实时数据显示；`Console.js` 负责日志流查看、十六进制切换、自动滚动与日志下载；`PreferencesDialog.js` 负责主题、语言、串口默认值与导出偏好设置；`ProjectEditorDialog.js` 负责项目树编辑与即时应用。任务栏用于切换工作区，顶部工具栏提供演示模拟、偏好设置、项目编辑器和项目操作入口，共同构成浏览器端完整交互链路。

        [[FIGURE_3]]
        图3 项目编辑器界面

        [[FIGURE_4]]
        图4 偏好设置界面

        3.2.5 项目配置、导出与部署设计
        `projects/stm32-bearing.json` 作为当前重点案例项目文件，定义了振动、应变、温度等监测组及控件组织方式。`CsvSessionManager.js` 负责根据连接生命周期收集帧数据，生成 CSV 表头与行记录，并在连接结束时尝试写入目录；若浏览器不支持目录写入或权限不足，则自动回退为文件下载。部署方面，仓库通过 `.github/workflows/deploy.yml` 直接将项目根目录发布到 GitHub Pages，适合静态网页场景。

        [[FIGURE_5]]
        图5 MQTT 配置界面

        [[FIGURE_6]]
        图6 控制台工作区界面

        四、系统调试与验证

        4.1 本地运行验证
        项目采用 ES Modules 组织代码，需通过 HTTP 服务运行。实际验证中，可使用 `python -m http.server 8000` 在项目根目录启动本地服务，并通过浏览器访问 `http://localhost:8000`。经验证，页面能够正确加载工具栏、侧栏、任务栏、Dashboard 与 Console，支持项目打开、偏好设置弹窗、项目编辑器弹窗和控制台日志展示。

        4.2 多协议接入与 MQTT 约束验证
        当前版本已验证 Serial、WebSocket、MQTT 三种接入链路。其中 MQTT 场景要求浏览器端必须连接 Broker 暴露的 `ws://` 或 `wss://` 端点，不能直接连接原始 TCP 端口；在 HTTPS 环境下必须使用 `wss://`。界面中已增加端点预览和更明确的连接错误提示，用于帮助用户定位主机、端口、路径、Topic 或协议版本配置问题。

        4.3 配置、导出与界面功能验证
        系统已验证项目文件加载与保存、Device Sends JSON 应用、项目编辑器修改后即时应用到仪表盘、偏好设置中的主题与语言切换、Dashboard / Console 双工作区切换、任务栏状态展示、CSV 自动保存与下载回退、控制台日志下载等功能。浅色与深色主题均可正常生效；中英文切换在保存后可刷新页面完成整体文案同步。

        4.4 STM32 轴承监测案例验证
        结合 `projects/stm32-bearing.json` 与 `FrameParser.js` 中的 STM32 Binary 解析逻辑，当前平台已能够作为 STM32 轴承监测案例的前端展示界面。系统可提取加速度、三路应变与两路温度数据，并将其映射到总览曲线、仪表和数据表中。在 MQTT 与项目文件模式结合使用时，仍可保持统一的状态管理与界面呈现方式，体现出平台化设计对专项场景的适配能力。

        [[FIGURE_7]]
        图7 加载 STM32 项目后的监测仪表盘

        五、结论与后续规划

        本说明书基于当前代码实现，对 Web Serial Studio 网页版监测平台的总体目标、技术架构、系统结构、关键模块、专项案例和调试验证过程进行了系统说明。当前版本已经具备多协议接入、项目化配置、控制台日志、CSV 会话导出、偏好设置、任务栏工作区切换和静态发布等平台能力，同时保留了 STM32 轴承监测这一重点应用案例，能够满足实验调试、在线展示和教学演示等多种使用需求。
        后续可在以下方向继续演进：
        - 接入真正的 Bluetooth 驱动，完成当前 UI 预留能力的闭环实现；
        - 增加更多行业项目模板与项目文件示例，形成通用模板库；
        - 增强历史回放、采样回看和数据复盘能力；
        - 完善自动化测试、版本管理与文档生成链路；
        - 继续优化移动端适配、控件组合方式和交互细节。
        """
    ).strip()


def w_tag(name: str) -> str:
    return f"{{{W_NS}}}{name}"


def add_text_run(parent, text: str, *, bold=False, size=24):
    run = ET.SubElement(parent, w_tag("r"))
    rpr = ET.SubElement(run, w_tag("rPr"))
    fonts = ET.SubElement(rpr, w_tag("rFonts"))
    fonts.set(w_tag("ascii"), "Times New Roman")
    fonts.set(w_tag("hAnsi"), "Times New Roman")
    fonts.set(w_tag("eastAsia"), "宋体")
    if bold:
        ET.SubElement(rpr, w_tag("b"))
        ET.SubElement(rpr, w_tag("bCs"))
    if size is not None:
        sz = ET.SubElement(rpr, w_tag("sz"))
        sz.set(w_tag("val"), str(size))
        szcs = ET.SubElement(rpr, w_tag("szCs"))
        szcs.set(w_tag("val"), str(size))

    text_node = ET.SubElement(run, w_tag("t"))
    if text.startswith(" ") or text.endswith(" "):
        text_node.set(f"{{{XML_NS}}}space", "preserve")
    text_node.text = text


def make_paragraph(
    text="",
    *,
    bold=False,
    size=24,
    center=False,
    before=0,
    after=120,
    first_line=None,
    page_break=False,
):
    paragraph = ET.Element(w_tag("p"))
    props = ET.SubElement(paragraph, w_tag("pPr"))
    spacing = ET.SubElement(props, w_tag("spacing"))
    spacing.set(w_tag("before"), str(before))
    spacing.set(w_tag("after"), str(after))
    spacing.set(w_tag("line"), "360")
    spacing.set(w_tag("lineRule"), "auto")

    if center:
        justification = ET.SubElement(props, w_tag("jc"))
        justification.set(w_tag("val"), "center")
    if first_line is not None:
        indent = ET.SubElement(props, w_tag("ind"))
        indent.set(w_tag("firstLine"), str(first_line))

    if page_break:
        run = ET.SubElement(paragraph, w_tag("r"))
        br = ET.SubElement(run, w_tag("br"))
        br.set(w_tag("type"), "page")
    if text:
        add_text_run(paragraph, text, bold=bold, size=size)
    return paragraph


def scale_drawing(paragraph, cx: int, cy: int):
    for extent in paragraph.findall(".//wp:extent", NS):
        extent.set("cx", str(cx))
        extent.set("cy", str(cy))
    for ext in paragraph.findall(".//a:xfrm/a:ext", NS):
        ext.set("cx", str(cx))
        ext.set("cy", str(cy))


def build_figure_paragraph(template_body, embed_id: str, size: tuple[int, int]):
    for paragraph in template_body.findall("w:p", NS):
        props = paragraph.find("w:pPr", NS)
        for run in paragraph.findall("w:r", NS):
            blip = run.find(".//a:blip", NS)
            if blip is None:
                continue
            if blip.attrib.get(f"{{{R_NS}}}embed") != embed_id:
                continue

            new_paragraph = ET.Element(w_tag("p"))
            if props is not None:
                new_paragraph.append(deepcopy(props))
            else:
                props_el = ET.SubElement(new_paragraph, w_tag("pPr"))
                jc = ET.SubElement(props_el, w_tag("jc"))
                jc.set(w_tag("val"), "center")

            new_paragraph.append(deepcopy(run))
            scale_drawing(new_paragraph, size[0], size[1])
            return new_paragraph

    raise RuntimeError(f"Could not find drawing placeholder for {embed_id}")


def classify_line(line: str):
    if not line:
        return "blank"
    if line.startswith("# "):
        return "title"
    if line.startswith("[[FIGURE_") and line.endswith("]]"):
        return "figure"
    if line.startswith("- "):
        return "bullet"
    if line.startswith(("部门：", "编制：", "审核：", "日期：")):
        return "meta"
    if "、" in line[:3]:
        return "section"
    if line[:5].count(".") == 2 and line[0].isdigit():
        return "subsub"
    if line[:3].count(".") == 1 and line[0].isdigit():
        return "subsection"
    if line.startswith(("（", "(")):
        return "item"
    if line.startswith("图") and len(line) > 2:
        return "caption"
    return "para"


def build_body(template_body):
    paragraphs = []
    title_rendered = False
    for raw_line in build_doc_text().splitlines():
        line = raw_line.rstrip()
        kind = classify_line(line)

        if kind == "title":
            paragraphs.append(make_paragraph(line[2:].strip(), bold=True, size=36, center=True, before=600, after=520))
            title_rendered = True
            continue

        if not title_rendered:
            continue

        if kind == "blank":
            paragraphs.append(make_paragraph("", after=100))
            continue

        if kind == "meta":
            paragraphs.append(make_paragraph(line, size=24, center=True, before=0, after=150))
            if line.startswith("日期："):
                paragraphs.append(make_paragraph(page_break=True, after=0))
            continue

        if kind == "section":
            paragraphs.append(make_paragraph(line, bold=True, size=28, before=260, after=180))
            continue

        if kind == "subsection":
            paragraphs.append(make_paragraph(line, bold=True, size=26, before=180, after=120))
            continue

        if kind == "subsub":
            paragraphs.append(make_paragraph(line, bold=True, size=24, before=120, after=110))
            continue

        if kind == "item":
            paragraphs.append(make_paragraph(line, bold=True, size=24, before=110, after=70))
            continue

        if kind == "bullet":
            paragraphs.append(make_paragraph(f"• {line[2:].strip()}", size=24, before=0, after=60))
            continue

        if kind == "figure":
            spec = FIGURE_SPECS[line[2:-2]]
            paragraphs.append(build_figure_paragraph(template_body, spec["embed_id"], spec["size"]))
            continue

        if kind == "caption":
            paragraphs.append(make_paragraph(line, size=22, center=True, before=0, after=140))
            continue

        paragraphs.append(make_paragraph(line, size=24, before=0, after=80, first_line=420))

    return paragraphs


def replace_images(files: dict[str, bytes], image_dir: Path):
    for spec in FIGURE_SPECS.values():
        image_path = image_dir / spec["media_name"]
        if not image_path.exists():
            raise FileNotFoundError(f"Missing image asset: {image_path}")
        files[f"word/media/{spec['media_name']}"] = image_path.read_bytes()


def parse_args():
    parser = argparse.ArgumentParser(description="Generate the updated Web Serial Studio design document.")
    parser.add_argument("--template", default=str(DEFAULT_TEMPLATE), help="Path to the source DOCX template.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Path to write the generated DOCX.")
    parser.add_argument("--image-dir", help="Directory containing image1.png to image7.png for placeholder replacement.")
    return parser.parse_args()


def main():
    args = parse_args()
    template_path = Path(args.template).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    image_dir = Path(args.image_dir).expanduser().resolve() if args.image_dir else None

    if not template_path.exists():
        raise FileNotFoundError(f"Template not found: {template_path}")

    with ZipFile(template_path, "r") as zip_in:
        files = {name: zip_in.read(name) for name in zip_in.namelist()}

    document_root = ET.fromstring(files["word/document.xml"])
    body = document_root.find("w:body", NS)
    if body is None:
        raise RuntimeError("Template DOCX is missing word/document.xml body")

    original_body = deepcopy(body)
    section_props = body.find("w:sectPr", NS)
    section_copy = deepcopy(section_props) if section_props is not None else None

    for child in list(body):
        body.remove(child)

    for paragraph in build_body(original_body):
        body.append(paragraph)

    if section_copy is not None:
        body.append(section_copy)

    if image_dir is not None:
        replace_images(files, image_dir)

    files["word/document.xml"] = ET.tostring(document_root, encoding="utf-8", xml_declaration=True)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(output_path, "w", ZIP_DEFLATED) as zip_out:
        for name, data in files.items():
            zip_out.writestr(name, data)

    print(output_path)


if __name__ == "__main__":
    main()
