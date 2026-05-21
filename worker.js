/**
 * LaTeXSnipper 用户手册 - Cloudflare Worker
 * 从 GitHub 仓库获取静态文件
 */

const GITHUB_OWNER = "strangelion";
const GITHUB_REPO = "LaTeXSnipper_user_manual";

/**
 * 获取当前使用的 GitHub 分支：
 * 1. 优先使用环境变量（由 wrangler 的 env 传入或 --branch 指定）
 * 2. 回退到 "master"
 * 
 * 非 master 分支自动视为预览部署，用于测试效果。
 */
function getBranch(env) {
  return env.GITHUB_BRANCH || env.CF_PAGES_BRANCH || "master";
}

function isPreview(env) {
  return env.DEPLOY_ENV === "preview" || getBranch(env) !== "master";
}

const MIME_TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  json: "application/json; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  wasm: "application/wasm",
  mp4: "video/mp4",
  webm: "video/webm",
};

const BINARY_TYPES = ["png", "jpg", "jpeg", "gif", "svg", "ico", "wasm"];

function getMimeType(path) {
  const ext = path.split(".").pop().toLowerCase();
  return MIME_TYPES[ext] || "text/plain; charset=utf-8";
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", ...corsHeaders() },
  });
}

function errorResponse(message, status = 500) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", ...corsHeaders() },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (path === "/ping") {
      return jsonResponse({
        status: "ok",
        service: "LaTeXSnipper User Manual",
        version: "2.3.5",
        timestamp: new Date().toISOString(),
      });
    }

    let filePath;
    if (path === "/") {
      filePath = "dist/index.html";
    } else {
      const ext = path.split(".").pop() || "";
      const hasExt = /^[a-zA-Z0-9]+$/.test(ext) && ext.length <= 10;
      const rawPath = hasExt ? path.slice(1) : path.slice(1) + ".html";
      // Vite 构建产物（index.html 和 assets/*）在 dist/ 目录下
      if (rawPath.startsWith("assets/") || rawPath === "index.html") {
        filePath = "dist/" + rawPath;
      } else {
        filePath = rawPath;
      }
    }

    // WASM + 字体走 R2（release 桶，同域避免跨域问题）
    if (filePath.endsWith(".wasm") || filePath.endsWith(".otf") || filePath.endsWith(".ttf")) {
      const r2Url = `https://release.interknot.dpdns.org/${filePath}`;
      const r2Resp = await fetch(r2Url);
      if (!r2Resp.ok) {
        // R2 没有，回退到 GitHub
        console.log(`[worker] R2 miss, fallback to GitHub: ${filePath}`);
      } else {
        const mimeType = getMimeType(filePath);
        const headers = {
          "Content-Type": mimeType,
          "Cache-Control": "public, max-age=604800, immutable",
          ...corsHeaders(),
        };
        // 写入 Cloudflare 边缘缓存
        const cached = new Response(r2Resp.body, { headers });
        ctx.waitUntil(caches.default.put(new Request(url.toString(), { method: "GET" }), cached.clone()));
        return cached;
      }
    }

    // favicon 返回 icon.png（从 public/ 目录获取）
    if (filePath.endsWith(".ico")) {
      const branch = getBranch(env);
      const pngUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${branch}/public/icon.png`;
      const icoResp = await fetch(pngUrl);
      if (!icoResp.ok) {
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      const icoContent = await icoResp.arrayBuffer();
      return new Response(icoContent, {
        headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=86400", ...corsHeaders() },
      });
    }

    // 其他文件从 GitHub 获取
    const branch = getBranch(env);
    const githubUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${branch}/${filePath}`;
    const response = await fetch(githubUrl);

    if (!response.ok) {
      return errorResponse(`404 Not Found: ${path}`, 404);
    }

    const ext = filePath.split(".").pop().toLowerCase();
    const isBinary = BINARY_TYPES.includes(ext);
    const mimeType = getMimeType(filePath);
    
    // 大文件（WASM、字体、图片）缓存更长时间
    const isLargeAsset = filePath.endsWith(".wasm") || filePath.endsWith(".otf") || filePath.endsWith(".ttf") || filePath.endsWith(".png") || filePath.endsWith(".jpg") || filePath.endsWith(".jpeg");
    let cacheControl;
    if (filePath.endsWith(".html") || filePath.endsWith(".css") || filePath.endsWith(".js")) {
      // HTML/CSS/JS：浏览器不缓存（max-age=0），Cloudflare CDN 缓存 10 分钟，并要求重新验证
      cacheControl = "public, max-age=0, s-maxage=600, must-revalidate";
    } else if (isLargeAsset) {
      cacheControl = "public, max-age=86400, s-maxage=604800, immutable";
    } else {
      cacheControl = "public, max-age=3600, s-maxage=86400";
    }
    
    const headers = {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl,
      ...corsHeaders(),
      "X-Content-Type-Options": "nosniff",
    };

    const content = isBinary ? await response.arrayBuffer() : await response.text();

    // ── 预览分支标识 ──
    // 非 master 分支在响应中添加预览标记，方便识别
    if (isPreview(env)) {
      headers["X-Deploy-Env"] = "preview";
      headers["X-Branch"] = getBranch(env);

      // HTML 页面注入预览横幅
      if (filePath.endsWith(".html") && typeof content === "string") {
        const branchName = getBranch(env);
        const previewBanner = `
<div style="
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: linear-gradient(135deg, #f97316, #dc2626);
  color: #fff; text-align: center; padding: 6px 12px;
  font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
">
  <span style="font-weight: 700;">🔬 预览分支</span>
  <code style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">${branchName}</code>
  <span style="opacity: 0.8;">· 仅用于测试</span>
  <a href="/" style="color: #fff; text-decoration: underline; opacity: 0.8;">切换到正式版 →</a>
</div>
`;
        // 在 <body> 后插入横幅
        const modified = content.replace("<body>", `<body>${previewBanner}`);
        return new Response(modified, { headers });
      }
    }

    return new Response(content, { headers });
  },
};

