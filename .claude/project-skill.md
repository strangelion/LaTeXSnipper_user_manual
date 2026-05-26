---
name: latexsnipper-manual
description: |
  LaTeXSnipper 官方网站完整维护指南。
  涵盖 Cloudflare Worker 部署、R2 配额管理、OCR Demo（公式/文字/混合识别）、
  下载页、Actions 工作流、主题系统、所有已知问题和修复方案。
  当修改此项目任何文件、排查部署问题、调整配额时使用。
metadata:
  type: project
---

# LaTeXSnipper 官方网站 — 完整项目维护参考

## 代码规范（重要）

- **保持代码结构清晰**：每文件分区块注释，CSS/HTML/JS 各归其位
- **修改后整理**：新增功能归到所属区块，不东插西塞
- **区块命名**：CSS `/* ── 区块名 ── */`，JS `// ═══ 区块名 ═══`
- **public/ ↔ dist/ 同步**：修改 public/ 必须同步到 dist/
- **提交前检查（必做）**：
  - 大括号 `{}` 成对、函数在被调用前定义、HTML 标签闭合
  - `diff public/ocr_demo.html dist/ocr_demo.html` 一致
  - 浅色/深色主题切换正常
- **部署前**：`worker.js` 版本号递增

---

## 项目架构

```
浏览器 → Cloudflare Worker (worker.js)
           ├─ GitHub raw (dist/*) → 静态页面
           ├─ Cloudflare R2 (release/*) → 模型+下载文件
           └─ Cloudflare KV (USAGE_KV) → 配额+PV统计
```

---

## 每个文件的作用

### 部署与配置

| 文件 | 用途 |
|------|------|
| `worker.js` | Worker 入口：路由、CSP/安全头、反爬虫、限流、R2代理、配额管理、PV统计、TOTP API |
| `wrangler.toml` | Wrangler 配置：环境变量、KV 绑定、observability |
| `package.json` | npm 包定义和部署脚本 |
| `vite.config.js` | Vite 构建配置（React SPA） |
| `.gitignore` | Git 忽略规则 |

### 静态页面

| 源文件 | dist输出 | 用途 |
|--------|---------|------|
| `index.html` | `dist/index.html` | React SPA 主页 |
| `download.html` | `dist/download.html` | 下载页：三平台+ SHA256 |
| `public/ocr_demo.html` | `dist/ocr_demo.html` | OCR Demo：图片/PDF/拍照/手写 |
| `user_manual.html` | `dist/user_manual.html` | 用户手册 |
| `public/error.html` | `dist/error.html` | 错误页模板 |

### OCR Demo 核心文件

| 文件 | 用途 |
|------|------|
| `public/js/ocr.js` | OCR Demo 全部 JS 逻辑（~1000行）：模型加载、推理、手写、相机、裁剪、主题 |
| `styles/styles.css` | 全局主题样式（CSS变量，浅色/深色） |

### 图片资源

| 文件 | 用途 |
|------|------|
| `public/icon.png` / `dist/icon.png` / `assets/images/icon.png` | 网站图标（需三处同步） |

### CI/CD

| 文件 | 用途 |
|------|------|
| `.github/workflows/sync_release.yml` | 每天检测上游 Release 文件更新 → 同步到 R2 + 更新 SHA256 |
| `.release_state.json` | 记录最新同步的 asset `updated_at` 时间戳 |

---

## Worker.js 详解

### 关键路由

| 路径 | 处理 |
|------|------|
| `/ping` | JSON 健康检查 + KV 诊断 + 配额 + PV 统计 |
| `/api/unlock` (POST) | TOTP 6位数字验证 (SHA-1, 30s, ±1窗口) |
| `/models/*` | R2 模型代理 (Referer检查 + 配额≥95%→503) |
| `/dl/*` | 下载代理 (配额≥98%→302 GitHub Releases) |
| `/*` | GitHub raw 代理 → `dist/{path}` |

### R2 配额管理

- 追踪 B 类操作次数（GET请求），非字节
- 默认限额 1000万次/月 (R2免费额度)
- 刷入策略：每 1000 次 OR 超 1 小时且有变化
- 95% → 模型 503 + OCR Demo 黄色横幅
- 98% → 下载链接切 GitHub Releases + 红色横幅
- 可配 `QUOTA_LIMIT_OPS` Secret

### 页面访问统计

- 按月份/路径记录 PV，内存+KV持久化
- 刷入策略：每 100 次 OR 超 1 小时且有变化
- 冷启动从 KV 加载（`pvEnsureLoadedBeforeTrack`）

### CSP 策略

```
script-src: 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' cdn.jsdelivr.net blob:
connect-src: 'self' https: blob:
worker-src: 'self' blob:
COOP: same-origin, COEP: credentialless (启用 SharedArrayBuffer)
```

### 缓存策略

| 类型 | max-age | s-maxage |
|------|---------|----------|
| HTML | 0 | 600 (10min) |
| JS/CSS | 0 | 300 (5min) |
| 图片/字体/WASM | 86400 | 604800 (7天) |
| 带hash的资源 | 31536000 | immutable |

---

## OCR Demo 详解

### 识别模式（胶囊选择器）

```
[ 公式(蓝紫) | 文字(橙色) | 混合(绿色) ]
```

| 模式 | 行为 | 手写时 |
|------|------|--------|
| 公式 | 仅 MathCraft 公式模型 | 强制混合 |
| 文字 | 仅 PP-OCR 文字模型 | 强制混合 |
| 混合 | 公式→失败→文字降级 | 强制混合 |

### 模型文件（R2）

| 文件 | 大小 | 用途 |
|------|------|------|
| `encoder_model.onnx` | 84MB | DeiT 编码器 |
| `decoder_model.onnx` | 29MB | TrOCR 解码器 |
| `tokenizer.json` | 39KB | 分词器 |
| `generation_config.json` | 210B | 生成配置 |
| `ch_PP-OCRv4_rec_infer.onnx` | 11MB | 文字识别 |
| `ppocr_keys_v1.txt` | 26KB | 6622字中文词典 |

### 推理管线

```
图片 → isImageEmpty(动态阈值) → 通过 → preprocessImage(384×384) → encoder → decoder(greedy,512tokens) → repairLatex → 输出
                                                                                        ↓每8步yield主线程
```

### 手写板

- Canvas 透明 + CSS 方格底纹（识别时白底导出）
- 深色模式：笔迹反色（`#e2e8f0` → `#1d170f`）
- 橡皮：`destination-out` 真正擦除
- 撤销：ImageData 快照，最多 60 步
- 缩放：右下角手柄拖拽

### 相机拍照

1. 打开相机 → 拍照
2. 裁剪界面：矩形框选 / 自由绘制（套索）
3. 矩形模式：画框 → 拖动移动 → 四角缩放 → 四边拖拽
4. 自由模式：绘制路径 → 路径外填白 → 确认
5. 提示字波浪呼吸动画，动态适应图片尺寸

### 安全防护

| 层级 | 检测 | 时机 |
|------|------|------|
| isImageEmpty | 动态阈值 `max(16, range*0.3)` + `range≤20` | 推理前 |
| CONFIDENCE_MIN | 平均置信度 < 15% | 推理后 |
| recognizing 锁 | 防重复点击并发 | 推理中 |

### 主题切换

- `data-theme` 属性切换，localStorage 持久化
- `updateHwTheme()` JS 直设 style（绕过 CSS 重绘延迟）
- `hwPenColor()` 动态返回当前主题笔迹色

---

## 下载页

- 下载链接：`/dl/` 代理路径（R2 域名通过 Secret 注入，源码不可见）
- SHA256：Actions 每 12h 检测 asset `updated_at`，变化时同步
- Actions 检测逻辑：`jq '[.assets[].updated_at] | sort | last'` 文件级

## 已知问题及修复

| 问题 | 根因 | 修复 |
|------|------|------|
| KV绑定部署丢失 | Dashboard绑定被wrangler覆盖 | wrangler.toml配`[[kv_namespaces]]` |
| 配额部署清零 | 未达flush阈值不写KV | 1h兜底+有变化才写 |
| CSP阻止blob: | script-src缺blob: | CSP加blob: |
| ONNX detached ArrayBuffer | 无COOP/COEP多线程失败 | Worker加COOP+COEP |
| Actions SHA256正则报错 | \1+十六进制=非法引用 | \1→\g<1> |
| 主题切换不全 | checkerCache只缓存一次 | updateHwTheme设style.backgroundColor |
| 手写0%置信度 | fgRatio阈值过高 | 动态阈值max(16, range*0.3) |
| 深色手写白字无法识别 | 导出白字+白底 | 反色非纯白像素 |
| JS缓存7天 | s-maxage=604800 | JS/CSS降为s-maxage=300 |
| PV统计冷启动丢数据 | 未先加载KV | pvEnsureLoadedBeforeTrack |
| 拍照按钮触发文件选择器 | 事件冒泡 | stopPropagation+dropzone排除 |
| preprocessImage缺代码 | 整理代码时误删 | 补全像素处理+return |

## 部署检查清单

- [ ] public/ 改动已同步到 dist/
- [ ] worker.js 版本号已递增
- [ ] Cloudflare Dashboard: Secrets `R2_MODEL_BASE` 存在
- [ ] KV 绑定 `USAGE_KV` 在 wrangler.toml 中配置
- [ ] `/ping` 确认 `kv.bound: true` + 配额/PV 正常
- [ ] OCR Demo: 图片/PDF/拍照/手写 均可用
- [ ] 主题切换: 浅色↔深色 正常
- [ ] 下载页: `/dl/` 链接正常代理，SHA256 最新
