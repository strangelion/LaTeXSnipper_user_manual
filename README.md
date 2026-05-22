# LaTeXSnipper 用户手册

LaTeXSnipper 用户手册的交互式网站，包含 React 重构的主页、Typst 实时编辑器和自动生成的用户手册。

## 功能特性

### 1. 交互式主页
- React 组件化架构
- 暗色/亮色主题切换
- 响应式设计，支持移动设备
- 滚动驱动的卡片动画

### 2. 用户手册 (`user_manual.html`)
- 由 Python 脚本 `build_manual.py` 从 `user_manual.typ` 自动生成
- 不加载视频背景，专注于内容
- 支持主题切换和代码块复制

### 3. Typst 编辑器
- 实时 Typst 到 HTML 转换
- 支持上传 `.typ` 文件
- 分屏编辑和预览
- 导出为 HTML

## 项目结构

```
.
├── src/
│   ├── main.jsx              # React 入口
│   ├── App.jsx               # 主应用组件
│   ├── App.css               # 应用样式
│   ├── index.css             # 全局样式
│   ├── components/
│   │   ├── Header.jsx        # 导航和主题切换
│   │   ├── HeroSection.jsx   # 英雄区域（打字效果）
│   │   ├── CardSlide.jsx     # 卡片滑动动画
│   │   ├── EndingSection.jsx # 结尾区域
│   │   ├── BackToTop.jsx     # 回到顶部按钮
│   │   ├── MathBackground.jsx # 数学公式背景
│   │   ├── TypstEditor.jsx   # Typst 编辑器
│   │   └── TypstEditor.css   # 编辑器样式
│   └── utils/
│       └── typstParser.js    # Typst 解析器
├── assets/                   # 静态资源
├── fonts/                    # 字体文件
├── styles/                   # 样式文件
├── js/                       # JavaScript 文件
├── wasm/                     # WASM 模块
├── index.html                # 主页
├── user_manual.html          # 生成的用户手册
├── user_manual.typ           # Typst 源文件
├── build_manual.py           # 手册生成脚本
├── sync_manual.py            # Typst 源文件双向同步脚本
├── vite.config.js            # Vite 配置
├── package.json              # 项目依赖
├── worker.js                 # Cloudflare Worker
└── wrangler.toml             # Cloudflare 部署配置
```

## 安装和运行

### 开发环境

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 访问 http://localhost:5173
```

### Typst 源文件同步

`user_manual.typ` 源文件同时在根目录和 `public/` 下存在，Vite dev server 使用 `public/` 下的版本。
使用 `sync_manual.py` 保持两者一致：

```bash
# 单向：根目录 → public（默认）
python sync_manual.py

# 双向：按修改时间，较新的覆盖较旧的
python sync_manual.py --both

# 监听模式（推荐），自动检测变更双向同步
python sync_manual.py --watch

# 反向：public → 根目录
python sync_manual.py --reverse

# 仅显示差异，不动文件
python sync_manual.py --diff
```

也可以通过 npm scripts：

```bash
# 监听模式
npm run sync

# 单次同步（根目录 → public）
npm run sync:once
```

> `npm run build` 已内置同步步骤，build 前会自动同步。

### 生成用户手册

```bash
python build_manual.py
```

打开 `user_manual.html` 查看效果。

### 生产构建

```bash
# 构建项目
npm run build       # 输出到 dist/

# 预览构建结果
npm run preview
```

### 部署到 Cloudflare Workers

```bash
npm run deploy
```

## 功能测试

| 模块 | 测试项 |
|------|--------|
| 主页 | 主题切换、卡片动画、回到顶部 |
| 用户手册 | 主题切换、代码复制、无视频加载 |
| Typst 编辑器 | 实时预览、文件上传、HTML 导出 |
| 文件同步 | `npm run sync` 监听同步、`python sync_manual.py --diff` 差异检查 |

## 常见问题

### 如何修改主题颜色？

编辑 `src/index.css` 中的 CSS 变量：

```css
:root {
  --accent: #2563eb;
  --accent-hover: #1d4ed8;
  --bg: #f8fafc;
  --fg: #0f172a;
}
```

### 如何添加新的卡片？

编辑 `src/App.jsx` 中的 `CARDS` 数组。

### 如何扩展 Typst 解析器？

编辑 `src/utils/typstParser.js`，添加新的正则表达式规则。

## 主题系统

支持三种主题模式：
1. **亮色模式**：`data-theme="light"`
2. **暗色模式**：`data-theme="dark"`
3. **系统默认**：无 `data-theme` 属性，跟随系统设置

主题偏好保存在 `localStorage`，键为 `latexSnipper-theme`。

## 性能优化

- Vite 构建，支持代码分割和懒加载
- CSS 变量用于主题切换
- `will-change` 优化动画性能
- 被动事件监听器减少主线程阻塞

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移动浏览器（iOS Safari, Chrome Mobile）

## 相关链接

- [LaTeXSnipper GitHub](https://github.com/SakuraMathcraft/LaTeXSnipper)
- [Typst 文档](https://typst.app)
- [React 文档](https://react.dev)
- [Vite 文档](https://vitejs.dev)

## 许可证

MIT License
