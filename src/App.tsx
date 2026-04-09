import { useState, useEffect, useRef, useCallback } from "react";
import {
  DrawIoEmbed,
  type EventAutoSave,
  type EventSave,
  type EventExport,
} from "react-drawio";
import type { DrawIoEmbedRef, ActionExport } from "react-drawio";
import {
  EditorMessageBus,
  type EditorConfig,
  type ExportOptions,
} from "@iss-ai/window-message-bus";

// 创建 EditorMessageBus 实例用于与外部通信
const editorBus = new EditorMessageBus({
  sourceId: "drawio-editor",
  debug: false,
});

// 保存场景到 localStorage 并通过 bus 通知
const handleSave = (xml: string): string | null => {
  if (!xml) return null;

  localStorage.setItem("drawio-scene", xml);
  return xml;
};

// 从 localStorage 加载初始数据
const loadInitialData = (): string => {
  const savedScene = localStorage.getItem("drawio-scene");
  return savedScene ?? "";
};

type ExportFormat = "svg" | "png" | "xml";

function App() {
  const apiRef = useRef<DrawIoEmbedRef | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [langCode, setLangCode] = useState<string>("zh");
  // 使用初始化函数从 localStorage 加载数据，避免在 effect 中调用 setState
  const [xmlData] = useState<string>(loadInitialData);
  const [isReady, setIsReady] = useState(false);
  // 用于跟踪导出请求的 resolver
  const saveResolverRef = useRef<{
    resolver: ((data: string) => void) | null;
    format: ExportFormat | null;
  }>({ resolver: null, format: null });
  // 用于获取缩略图的 resolver
  const thumbnailResolverRef = useRef<((data: string) => void) | null>(null);

  // 处理导出回调
  const handleExportCallback = useCallback((exportData: EventExport) => {
    // 如果有待处理的缩略图请求，优先处理
    if (thumbnailResolverRef.current) {
      thumbnailResolverRef.current(exportData.data);
      thumbnailResolverRef.current = null;
      return;
    }

    // 如果有待处理的文件保存请求，优先处理
    if (saveResolverRef.current.resolver) {
      const format = saveResolverRef.current.format;
      saveResolverRef.current.resolver(exportData.data);
      saveResolverRef.current = { resolver: null, format: null };

      // 对于 png/svg 格式，处理完毕后直接返回
      if (format === "png" || format === "svg") {
        return;
      }
    }

    // 通过 bus 通知导出完成
    editorBus.exportData({ format: exportData.format, data: exportData.data });
  }, []);

  // 保存图表到文件的核心函数
  const saveDiagramToFile = useCallback(
    (filename: string, format: ExportFormat) => {
      if (!apiRef.current || !isReady) {
        console.warn("Draw.io editor not ready");
        return;
      }
      console.log("saveDiagramToFile");
      // 设置 resolver，在导出回调中处理
      saveResolverRef.current = {
        resolver: (exportData: string) => {
          let href: string;
          let extension: string;

          if (format === "png") {
            // PNG 数据是 base64 data URL
            if (exportData.startsWith("data:")) {
              href = exportData;
            } else {
              href = `data:image/png;base64,${exportData}`;
            }
            extension = ".png";
          } else if (format === "svg") {
            // SVG 格式
            if (exportData.startsWith("data:")) {
              href = exportData;
            } else if (
              exportData.startsWith("<svg") ||
              exportData.startsWith("<?xml")
            ) {
              // 原始 SVG 内容 - 创建 blob URL
              const blob = new Blob([exportData], { type: "image/svg+xml" });
              href = URL.createObjectURL(blob);
            } else {
              // 假设是 base64 编码的 SVG
              href = `data:image/svg+xml;base64,${exportData}`;
            }
            extension = ".svg";
          } else {
            // XML 格式
            const data = localStorage.getItem("drawio-scene") || "";
            const blob = new Blob(
              [
                `<?xml version="1.0" encoding="UTF-8"?>
${data}`,
              ],
              { type: "application/xml" },
            );
            href = URL.createObjectURL(blob);
            extension = ".xml";
          }

          // 执行下载
          const link = document.createElement("a");
          link.href = href;
          link.download = `${filename}${extension}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          // 延迟释放 blob URL
          if (href.startsWith("blob:")) {
            setTimeout(() => URL.revokeObjectURL(href), 100);
          }
        },
        format,
      };

      // 触发导出 - 回调会在 handleExportCallback 中处理
      apiRef.current.exportDiagram({ format } as ActionExport);
    },
    [isReady],
  );

  // 导出为 PNG
  const handleExportPNG = useCallback(
    async (name?: string) => {
      saveDiagramToFile(`diagram-${name || Date.now()}`, "png");
    },
    [saveDiagramToFile],
  );

  // 导出为 SVG
  const handleExportSVG = useCallback(
    async (name?: string) => {
      saveDiagramToFile(`diagram-${name || Date.now()}`, "svg");
    },
    [saveDiagramToFile],
  );

  // 导出为 XML
  const handleExportXML = useCallback(
    async (name?: string) => {
      saveDiagramToFile(`diagram-${name || Date.now()}`, "xml");
    },
    [saveDiagramToFile],
  );

  // 获取缩略图
  const getThumbnail = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (!apiRef.current || !isReady) {
        resolve("");
        return;
      }

      // 设置超时，防止无限等待
      const timeout = setTimeout(() => {
        thumbnailResolverRef.current = null;
        resolve("");
      }, 5000);

      thumbnailResolverRef.current = (exportData: string) => {
        clearTimeout(timeout);
        // 确保返回的是 data URL 格式
        if (exportData.startsWith("data:")) {
          resolve(exportData);
        } else if (exportData && /^[A-Za-z0-9+/=]+$/.test(exportData)) {
          // 有效的 base64 字符串
          resolve(`data:image/png;base64,${exportData}`);
        } else {
          resolve("");
        }
      };

      // 触发 PNG 导出
      apiRef.current.exportDiagram({ format: "png" } as ActionExport);
    });
  }, [isReady]);

  // 处理生成缩略图
  const handleThumbnail = useCallback(async () => {
    console.log("收到生成缩略图指令");
    const thumbnail = await getThumbnail();
    if (thumbnail) {
      editorBus.thumnail({ data: thumbnail }, window.parent);
    }
  }, [getThumbnail]);

  // 处理导出命令
  const handleExport = useCallback(
    async (options?: ExportOptions) => {
      if (!apiRef.current) return;

      console.log("收到导出指令:", options);
      // 从 options 中提取 format 和 name
      const format = options?.type || options?.format;
      const name = options?.name;

      if (!format) return;

      switch (format.toLowerCase()) {
        case "png":
          await handleExportPNG(name);
          break;
        case "svg":
          await handleExportSVG(name);
          break;
        case "xml":
          await handleExportXML(name);
          break;
        default:
          break;
      }
    },
    [handleExportPNG, handleExportSVG, handleExportXML],
  );

  // 处理自动保存事件
  const handleAutoSave = useCallback((data: EventAutoSave) => {
    console.log("AutoSave event:", data);
    const savedData = handleSave(data.xml);
    if (savedData) {
      editorBus.change({ data: savedData });
    }
  }, []);

  // 处理保存事件
  const handleSaveEvent = useCallback((data: EventSave) => {
    console.log("Save event:", data);
    const savedData = handleSave(data.xml);
    if (savedData) {
      editorBus.change({ data: savedData });
    }
  }, []);

  // 处理加载完成事件
  const handleLoad = useCallback(() => {
    setIsReady(true);
    // editorBus.isReady({ version: "1.0.0" });
    console.log("Diagram loaded");
  }, []);

  // 设置 EditorMessageBus 的事件监听器
  useEffect(() => {
    // 监听设置数据事件
    editorBus.onSetData((data) => {
      console.log("收到设置数据指令:", data);
      const xml = data.xml || data;
      if (xml && xml.startsWith("<mx")) {
        apiRef.current?.load({ xml: data.xml || data });
        localStorage.setItem("drawio-data", xml);
      }
    });
    if (isReady) {
      editorBus.isReady({ version: "1.0.0" });
    }

    // 监听保存事件
    editorBus.onSave(async () => {
      console.log("收到保存指令");
      // 保存逻辑在 onAutoSave 中处理
    });

    // 导出事件
    editorBus.onExport(async (options) => {
      console.log("收到导出指令:", options);
      await handleExport(options);
    });

    // 监听生成缩略图事件
    editorBus.onThumnail(async () => {
      await handleThumbnail();
    });

    // 监听设置配置事件（主题和语言）
    editorBus.onSetConfig((config: EditorConfig) => {
      console.log("收到设置配置指令:", config);
      // 从 config 中提取 theme 和 langCode
      if (
        config.theme?.mode &&
        (config.theme.mode === "light" || config.theme.mode === "dark")
      ) {
        setTheme(config.theme.mode);
      }
      if ((config as Record<string, unknown>).langCode) {
        setLangCode((config as Record<string, unknown>).langCode as string);
      }
    });

    return () => {
      editorBus.off("setData");
      editorBus.off("save");
      editorBus.off("export");
      editorBus.off("setConfig");
    };
  }, [handleExport, handleThumbnail]);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <DrawIoEmbed
        ref={apiRef}
        xml={xmlData}
        autosave={true}
        urlParameters={{
          ui: theme === "dark" ? "dark" : "min",
          dark: theme === "dark",
          lang: langCode,
          libraries: true,
          grid: true,
          spin: true,
          saveAndExit: false,
          noExitBtn: true,
          noSaveBtn: true,
        }}
        configuration={{
          enableDivText: true,
          defaultFontFamily: "Helvetica",
          css: `.geFooterContainer, .geTabContainer, .geTabbedDiagram { display: none !important; }
          .geMenubarContainer {background:#fff !important; }`,
        }}
        onAutoSave={handleAutoSave}
        onSave={handleSaveEvent}
        onExport={handleExportCallback}
        onLoad={handleLoad}
      />
    </div>
  );
}

export default App;
