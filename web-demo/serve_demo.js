// ===========================================================================
//  serve_demo.js -- 演示用静态服务 + /api 反向代理（Node 版）
// ---------------------------------------------------------------------------
//  用法：
//      node web-demo/serve_demo.js               # 8090 -> 后端 8080
//      node web-demo/serve_demo.js 8081 8080     # 自定义 端口 / 后端端口
//
//  为什么需要它：
//      网页版默认「与页面同源」找后端，这样本地、内网 IP、内网穿透三种
//      场景都不用改代码。但纯静态服务器（python -m http.server、http-server 等）
//      收到 POST /api/... 只会返回 501，页面就崩了。
//      本脚本把 /api/** 转发到后端，其余请求返回 web-demo 下的静态文件。
//
//  优势：浏览器视角只有一个源 —— 不需要 CORS，也不需要跨域预检。
//        内网穿透只需暴露这一个端口。
//
//  只用 Node 内置模块，无需 npm install。
// ===========================================================================

const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = parseInt(process.argv[2], 10) || parseInt(process.env.PORT, 10) || 8090;
const BACKEND_PORT = parseInt(process.argv[3], 10) || parseInt(process.env.BACKEND_PORT, 10) || 8080;
// 后端主机名可通过环境变量指定。
// 为什么需要：在 docker-compose 里后端是另一个容器，必须用服务名（如 backend）
// 访问，写死 127.0.0.1 会连不上自己所在的容器。
const BACKEND_HOST = process.env.BACKEND_HOST || '127.0.0.1';
const WEB_ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8'
};

/* ------------------------------- 静态文件 ------------------------------- */
function serveStatic(req, res, pathname) {
  let rel = decodeURIComponent(pathname);
  if (rel === '/' || rel === '') rel = '/index.html';

  // 防目录穿越：解析后必须仍在 WEB_ROOT 之内
  const target = path.resolve(WEB_ROOT, '.' + rel);
  if (!target.startsWith(WEB_ROOT)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('403 Forbidden');
  }

  fs.stat(target, (err, st) => {
    if (err || !st.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('404 Not Found: ' + rel);
    }
    const type = MIME[path.extname(target).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Content-Length': st.size, 'Cache-Control': 'no-cache' });
    fs.createReadStream(target).pipe(res);
  });
}

/* -------------------------------- API 代理 ------------------------------- */
function proxy(req, res) {
  const options = {
    host: BACKEND_HOST,
    port: BACKEND_PORT,
    method: req.method,
    path: req.url,
    headers: Object.assign({}, req.headers, { host: BACKEND_HOST + ':' + BACKEND_PORT })
  };

  const upstream = http.request(options, up => {
    const headers = Object.assign({}, up.headers);
    delete headers['transfer-encoding'];   // 交给 Node 重新计算长度
    res.writeHead(up.statusCode, headers);
    up.pipe(res);
  });

  upstream.on('error', err => {
    const body = JSON.stringify({
      code: 502,
      message: '无法连接后端 http://' + BACKEND_HOST + ':' + BACKEND_PORT + ' —— ' + err.message,
      data: null
    });
    res.writeHead(502, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body)
    });
    res.end(body);
  });

  req.pipe(upstream);
}

/* --------------------------------- 启动 --------------------------------- */
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;

  if (pathname === '/api' || pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
      });
      return res.end();
    }
    console.log('  [api] ' + req.method + ' ' + req.url);
    return proxy(req, res);
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  web-demo 已启动');
  console.log('  ---------------------------------------------');
  console.log('   页面地址    : http://127.0.0.1:' + PORT + '/');
  console.log('   后端代理    : /api/**  ->  http://' + BACKEND_HOST + ':' + BACKEND_PORT);
  console.log('   静态文件目录: ' + WEB_ROOT);
  console.log('');
  console.log('  停止服务    : Ctrl+C');
  console.log('');
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('端口 ' + PORT + ' 已被占用，请换一个端口，或先关掉占用它的程序。');
  } else {
    console.error('服务启动失败: ' + err.message);
  }
  process.exit(1);
});
