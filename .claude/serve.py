# Local dev server: like `python -m http.server`, but tells the browser never to cache,
# so edits to css/js always show up on a normal reload.
import http.server
import sys


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    http.server.ThreadingHTTPServer(('127.0.0.1', port), NoCacheHandler).serve_forever()
