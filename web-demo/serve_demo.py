#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
serve_demo.py -- 演示用静态服务 + /api 反向代理

为什么需要它：
    网页版默认「与页面同源」找后端（这样本地、内网 IP、内网穿透三种场景
    都不用改代码）。但纯静态服务器（python -m http.server）收到
    POST /api/... 时只会返回 501，页面就崩了。

    本脚本把 /api/** 反向代理到后端（默认 127.0.0.1:8080），
    其余请求照常返回 web-demo 目录下的静态文件。这样：
      * 浏览器视角只有一个源，不需要 CORS，也不会有跨域预检问题
      * 换 IP / 换穿透域名时什么都不用改
      * 穿透工具只需要指向这一个端口

用法：
    python web-demo/serve_demo.py                 # 监听 8081，后端 8080
    python web-demo/serve_demo.py 8081 8080       # 自定义端口
    python web-demo/serve_demo.py 8081 8080 0.0.0.0   # 允许局域网访问

    （第二个参数是后端端口；只影响代理目标，不影响页面。）
"""

import os
import sys
import http.server
import socketserver
import urllib.request
import urllib.error
from urllib.parse import urlsplit

WEB_DIR = os.path.dirname(os.path.abspath(__file__))

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8081
BACKEND_PORT = int(sys.argv[2]) if len(sys.argv) > 2 else 8080
BIND = sys.argv[3] if len(sys.argv) > 3 else '0.0.0.0'
BACKEND = 'http://127.0.0.1:%d' % BACKEND_PORT

# 不希望被代理出去的请求头
_HOP_BY_HOP = {
    'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailers', 'transfer-encoding', 'upgrade', 'host', 'content-length',
}


class Handler(http.server.SimpleHTTPRequestHandler):

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    # ---- 代理 /api/** ----
    def _proxy(self):
        body = None
        length = self.headers.get('Content-Length')
        if length:
            body = self.rfile.read(int(length))

        target = BACKEND + self.path
        headers = {k: v for k, v in self.headers.items()
                   if k.lower() not in _HOP_BY_HOP}
        # 不要让后端压缩：我们只是原样转发，压缩会让 Content-Length 对不上
        headers['Accept-Encoding'] = 'identity'

        req = urllib.request.Request(target, data=body, headers=headers,
                                     method=self.command)
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                payload = resp.read()
                self.send_response(resp.status)
                for k, v in resp.getheaders():
                    lk = k.lower()
                    if lk in _HOP_BY_HOP or lk == 'content-encoding':
                        continue
                    self.send_header(k, v)
                self.send_header('Content-Length', str(len(payload)))
                self.end_headers()
                self.wfile.write(payload)
        except urllib.error.HTTPError as e:
            # 后端返回 4xx/5xx 也要原样透传，否则前端拿不到 body.code
            payload = e.read()
            self.send_response(e.code)
            for k, v in (e.headers.items() if e.headers else []):
                if k.lower() not in _HOP_BY_HOP:
                    self.send_header(k, v)
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)
        except Exception as ex:
            msg = ('{"code":502,"message":"无法连接后端 %s：%s",'
                   '"data":null}' % (BACKEND, ex)).encode('utf-8')
            self.send_response(502)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def _is_api(self):
        return urlsplit(self.path).path.startswith('/api')

    def do_GET(self):
        if self._is_api():
            return self._proxy()
        return super().do_GET()

    def do_POST(self):
        if self._is_api():
            return self._proxy()
        self.send_error(405, 'only /api/** accepts POST')

    def do_PUT(self):
        if self._is_api():
            return self._proxy()
        self.send_error(405)

    def do_DELETE(self):
        if self._is_api():
            return self._proxy()
        self.send_error(405)

    def do_OPTIONS(self):
        if self._is_api():
            return self._proxy()
        self.send_response(204)
        self.end_headers()

    def log_message(self, fmt, *args):
        # 让演示时控制台干净一点；需要排查时把下面这行注释掉
        if self._is_api():
            sys.stderr.write("  [api] %s %s\n" % (self.command, self.path))


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == '__main__':
    with Server((BIND, PORT), Handler) as httpd:
        print('')
        print('  web-demo 已启动')
        print('  ---------------------------------------------')
        print('   页面地址    : http://127.0.0.1:%d/' % PORT)
        print('   后端代理    : /api/**  ->  %s' % BACKEND)
        print('   静态文件目录: %s' % WEB_DIR)
        print('')
        print('  局域网访问  : http://<本机IP>:%d/' % PORT)
        print('  停止服务    : Ctrl+C')
        print('')
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print('\n  已停止。')
