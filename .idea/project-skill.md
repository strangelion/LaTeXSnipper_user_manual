---
name: latexsnipper-manual
description: LaTeXSnipper 用户手册项目维护。涵盖 Cloudflare Worker 部署、R2 配额管理、OCR Demo 功能、静态页面维护、GitHub Actions 工作流。当需要修改 worker.js、wrangler.toml、ocr_demo.html、download.html、配额系统或部署流程时使用。
metadata:
  type: project
  paths:
    - C:\Users\strangelion\Documents\GitHub\LaTeXSnipper_user_manual
---

# LaTeXSnipper 用户手册 — 项目维护参考

## 项目架构

```
浏览器 → Cloudflare Worker (worker.js) → GitHub raw.githubusercontent.com (静态文件)
                                       → Cloudflare R2 (模型 / 发布二进制文件)
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `worker.js` | Cloudflare Worker 入口，路由、CSP、配额管理、代理模型和下载 |
| `wrangler.toml` | Wrangler 配置，环境变量、KV 绑定、observability |
| `public/ocr_demo.html` | OCR Demo 源码（图片/PDF/拍照/手写识别） |
| `dist/ocr_demo.html` | OCR Demo 构建输出（Worker 从此目录提供服务） |
| `download.html` | 下载页面源码，SHA256 + `/dl/` 代理链接 |
| `dist/download.html` | 下载页面构建输出 |
| `styles/styles.css` | 全局样式，CSS 变量，主题定义 |
| `.github/workflows/sync_release.yml` | 每12h 从上游 Release 下载二进制到 R2，同步 SHA256 |

## 部署

### 命令
```bash
npx wrangler deploy --env production    # 生产环境
npx wrangler deploy                     # 默认环境
npx wrangler deploy --env preview       # 预览环境
```

### 部署前检查
- `wrangler.toml` 中 `R2_MODEL_BASE` 已移除（改用 Secret）
- Cloudflare Dashboard 确认 Secret `R2_MODEL_BASE` 存在
- Cloudflare Dashboard 确认 KV 绑定 `USAGE_KV` 存在
- `worker.js` 版本号递增

### Secret 配置（Cloudflare Dashboard → Workers → Settings → Variables）
| Name | Value | 类型 |
|------|-------|------|
| `R2_MODEL_BASE` | `https://release.interknot.dpdns.org` | Secret |
| `QUOTA_LIMIT_OPS` | `10000000`（可选） | Secret |

### KV 绑定（wrangler.toml 中配置，部署时自动绑定）
```
[[kv_namespaces]]
binding = "USAGE_KV"
id = "1afdc87d24624a80aa99722ebf7e1ec6"
```

## R2 配额管理系统

### 追踪维度
- **B 类操作次数**（GET 请求），非字节
- R2 免费额度：1000万次/月 B 类操作，出站流量免费
- 每次 `/models/*` 和 `/dl/*` 请求计 1 次
- **每次操作立即写入 KV**，防止部署重启丢数据

### 阈值行为
| 阈值 | 行为 |
|------|------|
| 正常 (<95%) | `/models/*` 正常服务，下载页链接走 `/dl/` 代理 |
| 警告 (95%) | `/models/*` 返回 503，OCR Demo 页面注入黄色横幅 |
| 阻断 (98%) | 下载页 `/dl/` 链接替换为 GitHub Releases URL，注入红色横幅 |

### 关键函数 (worker.js)
- `quotaGetStatus(env)` → `{opsUsed, limitOps, pctUsed, isWarn, isBlock}`
- `quotaTrackOp(env, ctx)` → 计数+1，立即写 KV
- `quotaEnsureLoaded(env)` → 加载 KV 数据，月初重置
- `/ping` 端点 → 返回 KV 绑定状态和用量诊断

### 环境变量
| 变量 | 默认值 | 说明 |
|------|--------|------|
| `QUOTA_LIMIT_OPS` | `10000000` | 月度 B 类操作限额 |

## Worker.js 关键路由

| 路径 | 处理 |
|------|------|
| `/ping` | JSON 健康检查 + KV 诊断 + 配额状态 |
| `/api/unlock` (POST) | TOTP 验证（6位数字，30s窗口） |
| `/models/*` | R2 模型代理，Referer 检查，配额检查 |
| `/dl/*` | 下载代理，配额阻断时 302 → GitHub Releases |
| `/*` | 从 GitHub raw 拉取 `dist/` 下静态文件 |

### CSP 策略
- `script-src`: `'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net blob:`
- `connect-src`: `'self' https: blob:`
- `worker-src`: `'self' blob:`
- `img-src`: `'self' data: blob: https:`
- COOP: `same-origin`, COEP: `credentialless`（启用 SharedArrayBuffer）

## OCR Demo (ocr_demo.html)

### 架构
- ONNX Runtime Web 1.21.0 浏览器端推理
- 模型：MathCraft OCR（编码器 84MB + 解码器 29MB）
- 模型缓存：Cache API (`ocr-models-v1`)，二次访问秒开
- 推理后端：`['webgpu', 'wasm']` 优先 GPU，WASM 兜底
- 多线程：`crossOriginIsolated` 时启用 4 线程 + SIMD

### 模式切换
- **图片识别**：拖拽上传 / 拍照 / Ctrl+V 粘贴 / PDF 上传（≤100页）
- **手写识别**：Canvas 画板，笔/橡皮/撤销/清空，方格底纹跟随主题

### PDF 处理
- PDF.js 3.11.174 CDN 加载
- 最多 100 页限制
- 逐页提取文本 (`getTextContent`) + 渲染为图片 OCR
- 文本按行分组保持阅读顺序，输出按页分隔
- 自适应渲染分辨率（目标 768px），Canvas 直传 OCR 跳过编码往返

### 相机
- `getUserMedia` 后置摄像头 (`facingMode: 'environment'`)
- 全屏预览 → 拍照 → 直接送 OCR
- 点击遮罩/Esc/切后台自动关闭

### 手写板
- Canvas 透明 + CSS 方格底纹（识别时自动加白底导出）
- 笔迹颜色跟随主题（浅色 `#1e293b` / 深色 `#e2e8f0`）
- 橡皮用 `destination-out` 真正擦除
- 撤销最多 60 步，`hwPenColor()` 动态取色
- 主题切换时 JS 直接设 `style.backgroundColor` + dispatch `resize`

### 性能优化
- WebGPU > WASM 后端优先级
- `crossOriginIsolated` → 多线程 + SIMD
- PDF 渲染自适应分辨率替代固定 2x
- Canvas 直传 OCR 跳过 toBlob/URL/Image 往返

## 下载页 (download.html)

### 链接格式
- 源码中：`/dl/LaTeXSnipperSetup-2.3.2.exe`（不暴露 R2 域名）
- Worker 代理到 R2，98% 阈值时替换为 GitHub Releases URL

### SHA256 同步
- GitHub Actions (`sync_release.yml`) 每 12h 检查上游 Release
- 下载二进制到 R2，计算 SHA256，更新 `download.html` **和** `dist/download.html`
- 修复：用 `\g<1>` 命名的组引用替代 `\1`，避免十六进制冲突

## 主题系统

### CSS 变量（styles.css）
- 浅色默认：`:root { --bg: #f8fafc; --fg: #0f172a; ... }`
- 深色：`:root[data-theme="dark"] { --bg: #0f111a; --fg: #e2e8f0; ... }`
- 切换：JS 设 `document.documentElement.setAttribute('data-theme', next)`
- 持久化：`localStorage('latexSnipper-theme')`

### OCR Demo 主题修复
- `updateHwTheme(theme)` 直接设 `style.backgroundColor`（绕过 CSS 重绘延迟）
- `window.dispatchEvent(new Event('resize'))` 触发粒子背景重建
- `hwPenColor()` 动态返回当前主题对应的笔迹颜色

## 常见问题

### KV 绑定每次部署丢失
- **根因**：Dashboard 绑定的 KV 会被 `wrangler deploy` 覆盖
- **修复**：在 `wrangler.toml` 中配置 `[[kv_namespaces]]`（顶层+生产环境双份）

### 配额计数部署后清零
- **根因**：`QUOTA_KV_FLUSH_STEP=1000`，未达标不写 KV，重启丢数据
- **修复**：每次操作立即 `quotaSaveToKV()`

### CSP 阻止 blob: URL
- **根因**：ONNX WebGPU/WASM 动态模块加载使用 blob URL
- **修复**：`script-src` 和 `connect-src` 添加 `blob:`

### Actions SHA256 正则报错
- **根因**：十六进制 SHA 首数字与 `\1` 组成非法组引用（如 `\16`）
- **修复**：`\1` → `\g<1>`

### ONNX 超时 / detached ArrayBuffer
- **根因**：`SharedArrayBuffer` 可用但无 COOP/COEP 头
- **修复**：Worker 添加 COOP+COEP 头，前端用 `crossOriginIsolated` 判断

### 下载页 SHA256 不同步到 dist
- **根因**：Actions 工作流只更新根目录 `download.html`
- **修复**：工作流同时处理 `download.html` 和 `dist/download.html`

## 修改规范
- 语言：简体中文回复，代码注释英文
- `public/` 和 `dist/` 同名文件需同步修改
- 部署前确认 `npx wrangler deploy --env production`
- 配额相关改动需检查 `/ping` 端点验证
- OCR Demo 改动需测试浅色/深色主题切换