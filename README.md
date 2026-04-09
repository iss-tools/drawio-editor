# Drawio Editor

一个基于 [react-drawio](https://github.com/puttikan/react-drawio) 的在线流程图编辑器，使用 React + TypeScript + Vite 构建。

## 功能特性

- 🎨 **Draw.io 集成** - 基于 react-drawio，提供完整的 Draw.io 绘图功能
- 🌓 **主题切换** - 支持亮色/暗色主题切换
- 🌍 **多语言支持** - 支持中文（zh）等语言
- 💾 **本地存储** - 自动保存绘图数据到 localStorage
- 📤 **多种导出格式** - 支持导出为 PNG、SVG、XML 格式
- 🖼️ **缩略图生成** - 支持生成绘图缩略图
- 🔌 **消息总线集成** - 通过 `@iss-ai/window-message-bus` 实现与父窗口的通信
- 🔄 **自动保存** - 支持自动保存功能

## 技术栈

- **框架**: React 19.2.4
- **语言**: TypeScript 5.9.3
- **构建工具**: Vite 8.0.1
- **绘图库**: react-drawio 1.0.7
- **消息总线**: @iss-ai/window-message-bus 0.0.8

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

```bash
pnpm dev
```

启动开发服务器，访问 `http://localhost:5173`

### 构建生产版本

```bash
pnpm build
```

### 代码检查

```bash
pnpm lint
```

### 预览生产构建

```bash
pnpm preview
```

## 项目结构

```
drawio-editor/
├── src/
│   ├── App.tsx          # 主应用组件
│   ├── main.tsx         # 应用入口
│   ├── index.css        # 全局样式
│   └── App.css          # 应用样式
├── public/
│   ├── favicon.svg      # 网站图标
│   └── icons.svg        # 图标资源
├── example/
│   ├── index.html       # 示例页面
│   └── index.umd.js     # 示例脚本
├── index.html           # HTML 模板
├── package.json         # 项目配置
├── tsconfig.json        # TypeScript 配置
└── vite.config.ts       # Vite 配置
```

## API 集成

### EditorMessageBus 事件

编辑器通过 `EditorMessageBus` 与父窗口进行通信，支持以下事件：

#### 接收事件（从父窗口）

| 事件名 | 描述 | 参数 |
|--------|------|------|
| `setData` | 设置绘图数据 | `{ xml: string }` |
| `save` | 保存当前绘图 | - |
| `export` | 导出绘图 | `{ format: 'png' \| 'svg' \| 'xml', name?: string }` |
| `thumbnail` | 生成缩略图 | - |
| `setConfig` | 设置配置 | `{ theme: 'light' \| 'dark', langCode?: string }` |

#### 发送事件（到父窗口）

| 事件名 | 描述 | 参数 |
|--------|------|------|
| `isReady` | 编辑器就绪 | `{ version: string }` |
| `change` | 内容变更 | `{ data: string }` |
| `save` | 保存完成 | - |
| `exportData` | 导出完成 | `{ format: string, data: string }` |
| `thumbnailData` | 缩略图数据 | `{ data: string }` |

## 使用示例

### 在 iframe 中嵌入编辑器

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Drawio Editor Demo</title>
</head>
<body>
  <iframe 
    id="drawio-editor"
    src="http://localhost:5173"
    style="width: 100%; height: 100vh; border: none;"
  ></iframe>
  
  <script type="module">
    import { EditorMessageBus } from '@iss-ai/window-message-bus';
    
    const editorBus = new EditorMessageBus({
      sourceId: 'parent-app',
      targetId: 'drawio-editor',
      debug: true
    });
    
    // 监听编辑器就绪
    editorBus.on('isReady', (data) => {
      console.log('Editor ready:', data);
      
      // 设置初始数据
      editorBus.setData({ xml: '<mxGraphModel></mxGraphModel>' });
    });
    
    // 监听内容变更
    editorBus.on('change', (data) => {
      console.log('Content changed:', data);
    });
    
    // 导出为 PNG
    editorBus.export({ format: 'png', name: 'my-diagram' });
    
    // 监听导出完成
    editorBus.on('exportData', (data) => {
      console.log('Export completed:', data);
    });
  </script>
</body>
</html>
```

### 核心功能

#### 保存图表

```javascript
// 触发保存
editorBus.save();

// 监听保存完成
editorBus.on('save', () => {
  console.log('Save completed');
});
```

#### 导出图表

```javascript
// 导出为 PNG
editorBus.export({ format: 'png', name: 'diagram' });

// 导出为 SVG
editorBus.export({ format: 'svg', name: 'diagram' });

// 导出为 XML
editorBus.export({ format: 'xml', name: 'diagram' });
```

#### 生成缩略图

```javascript
// 请求缩略图
editorBus.thumbnail();

// 监听缩略图数据
editorBus.on('thumbnailData', (data) => {
  console.log('Thumbnail:', data.data);
});
```

#### 主题和语言配置

```javascript
// 设置暗色主题
editorBus.setConfig({ theme: 'dark' });

// 设置语言为中文
editorBus.setConfig({ langCode: 'zh' });

// 同时设置主题和语言
editorBus.setConfig({ 
  theme: 'light',
  langCode: 'zh'
});
```

## 本地存储

编辑器会自动将绘图数据保存到 `localStorage` 中，键名为 `drawio-scene`。这使得用户可以在关闭浏览器后恢复之前的工作。

## 示例页面

项目包含一个完整的示例页面，位于 `example/index.html`。该示例展示了如何使用 `EditorMessageBus` 与编辑器进行通信。

运行示例：

```bash
# 使用任意静态文件服务器托管 example 目录
# 或者直接在浏览器中打开 example/index.html
```

## 许可证

MIT
