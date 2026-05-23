/**
 * LaTeXSnipper 用户手册 - Cloudflare Worker
 * 从 GitHub 仓库获取静态文件并智能缓存
 */

const GITHUB_OWNER = "strangelion";
const GITHUB_REPO = "LaTeXSnipper_user_manual";

// 允许的文件扩展名白名单（防止路径遍历和信息泄露）
const ALLOWED_EXTENSIONS = new Set([
  "html", "css", "js", "json", "png", "jpg", "jpeg", "gif", "svg",
  "ico", "wasm", "mp4", "webm", "otf", "ttf", "woff2", "typ", "pdf",
]);

// 禁止的路径模式
const BLOCKED_PATH_PATTERNS = [
  /\.\./,           // 路径遍历
  /~/,              // 用户目录
  /^\//,            // 已在前面处理
  /\.env/i,         // 环境文件
  /\.git/i,         // Git 文件
  /\/\./,           // 隐藏文件
  /node_modules/i,  // 依赖目录
];

function getBranch(env) {
  const branch = env.GITHUB_BRANCH || env.CF_PAGES_BRANCH || "master";
  // 分支名只允许字母、数字、横线、下划线、斜线、点
  return branch.replace(/[^a-zA-Z0-9\-_/.]/g, "").slice(0, 100);
}

function isPreview(env) {
  return env.DEPLOY_ENV === "preview" || getBranch(env) !== "master";
}

// HTML 转义，防止 XSS
function escapeHtml(str) {
  const map = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return str.replace(/[&<>"']/g, (c) => map[c]);
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
  otf: "font/otf",
  ttf: "font/ttf",
  woff2: "font/woff2",
};

function getMimeType(p) {
  const ext = p.split(".").pop().toLowerCase();
  return MIME_TYPES[ext] || "text/plain; charset=utf-8";
}

function isHashedAsset(p) {
  return /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.\w+$/.test(p);
}

function isStaticAsset(p) {
  return /\.(png|jpe?g|gif|svg|ico|otf|ttf|woff2|pdf|wasm)$/i.test(p);
}

function cacheControl(p) {
  if (isHashedAsset(p)) {
    return "public, max-age=31536000, immutable";
  }
  if (isStaticAsset(p)) {
    return "public, max-age=86400, s-maxage=604800";
  }
  if (p.endsWith(".html")) {
    return "public, max-age=0, s-maxage=600, must-revalidate";
  }
  return "public, max-age=0, s-maxage=3600, must-revalidate";
}

// 验证文件路径安全性
function isSafePath(p) {
  // 检查禁止模式
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(p)) return false;
  }
  // 检查扩展名白名单
  const ext = p.split(".").pop().toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) return false;
  // 路径长度限制
  if (p.length > 256) return false;
  return true;
}

function securityHeaders(isHtml) {
  const headers = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "SAMEORIGIN",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-XSS-Protection": "0",  // 已废弃但保留以兼容旧浏览器
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  };
  if (isHtml) {
    // CSP：限制脚本和样式来源
    headers["Content-Security-Policy"] = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self' https:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'none'",
    ].join("; ");
  }
  return headers;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  };
}

function jsonResponse(data) {
  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(),
      ...securityHeaders(false),
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 只允许 GET 和 OPTIONS
    if (request.method !== "GET" && request.method !== "OPTIONS" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          Allow: "GET, HEAD, OPTIONS",
          ...corsHeaders(),
          ...securityHeaders(false),
        },
      });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    // HEAD 请求复用 GET 逻辑但只返回头
    const isHead = request.method === "HEAD";

    if (path === "/ping") {
      return jsonResponse({
        status: "ok",
        service: "LaTeXSnipper User Manual",
        version: "2.3.5",
        timestamp: new Date().toISOString(),
      });
    }

    // 路径解析
    let filePath;
    if (path === "/") {
      filePath = "dist/index.html";
    } else {
      const ext = path.split(".").pop() || "";
      const hasExt = /^[a-zA-Z0-9]+$/.test(ext) && ext.length <= 10;
      const rawPath = hasExt ? path.slice(1) : path.slice(1) + ".html";
      if (rawPath.startsWith("assets/") || rawPath === "index.html") {
        filePath = "dist/" + rawPath;
      } else {
        filePath = rawPath;
      }
    }

    // 安全检查
    if (!isSafePath(filePath)) {
      return new Response("Bad Request", {
        status: 400,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...corsHeaders(),
          ...securityHeaders(false),
        },
      });
    }

    const branch = getBranch(env);
    const githubUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${branch}/${filePath}`;
    const resp = await fetch(githubUrl);

    if (!resp.ok) {
      // favicon 回退到 icon.png
      if (path.endsWith(".ico")) {
        const pngUrl = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${branch}/public/icon.png`;
        const pngResp = await fetch(pngUrl);
        if (pngResp.ok) {
          return new Response(isHead ? null : await pngResp.arrayBuffer(), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=86400",
              ...corsHeaders(),
              ...securityHeaders(false),
            },
          });
        }
        return new Response(null, { status: 204, headers: corsHeaders() });
      }
      return new Response("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          ...corsHeaders(),
          ...securityHeaders(false),
        },
      });
    }

    const mimeType = getMimeType(filePath);
    const isHtml = filePath.endsWith(".html");
    const isBinary = /\.(png|jpe?g|gif|svg|ico|otf|ttf|woff2|wasm|pdf)$/i.test(filePath);
    const content = isBinary ? await resp.arrayBuffer() : await resp.text();

    const headers = {
      "Content-Type": mimeType,
      "Cache-Control": cacheControl(filePath),
      ...corsHeaders(),
      ...securityHeaders(isHtml),
    };

    // 预览分支 HTML 注入横幅（分支名已在上层转义）
    if (isPreview(env) && isHtml && typeof content === "string") {
      headers["X-Deploy-Env"] = "preview";
      headers["X-Branch"] = branch;
      const safeBranch = escapeHtml(branch);
      const previewBanner = `
<div style="
  position: fixed; top: 0; left: 0; right: 0; z-index: 9999;
  background: linear-gradient(135deg, #f97316, #dc2626);
  color: #fff; text-align: center; padding: 6px 12px;
  font-family: system-ui, -apple-system, sans-serif; font-size: 13px;
  display: flex; align-items: center; justify-content: center; gap: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.3);
">
  <span style="font-weight: 700;">预览分支</span>
  <code style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 4px;">${safeBranch}</code>
  <span style="opacity: 0.8;">仅用于测试</span>
  <a href="/" style="color: #fff; text-decoration: underline; opacity: 0.8;">切换到正式版</a>
</div>`;
      const modified = content.replace("<body>", `<body>${previewBanner}`);
      return new Response(isHead ? null : modified, { headers });
    }

    return new Response(isHead ? null : content, { headers });
  },
};
