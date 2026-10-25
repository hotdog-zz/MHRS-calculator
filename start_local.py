#!/usr/bin/env python3
"""Serve the app on loopback only. Python standard library, no installation."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
import threading
import webbrowser

class Handler(SimpleHTTPRequestHandler):
    extensions_map={**SimpleHTTPRequestHandler.extensions_map,'.wasm':'application/wasm','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8'}
    def log_message(self,*args):pass
    def end_headers(self):
        self.send_header('Cache-Control','no-store')
        super().end_headers()

def main():
    parser=argparse.ArgumentParser(description='Sunbreak Forge local launcher')
    parser.add_argument('--port',type=int,default=8787)
    parser.add_argument('--no-browser',action='store_true')
    args=parser.parse_args()
    handler=partial(Handler,directory=str(Path(__file__).resolve().parent/'dist'))
    try:server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
    except OSError:
        if args.port==0:raise
        server=ThreadingHTTPServer(('127.0.0.1',0),handler)
    url=f'http://127.0.0.1:{server.server_port}/'
    print('Sunbreak Forge is running locally.',flush=True)
    print(url,flush=True)
    print('Keep this window open. Press Ctrl+C to stop.',flush=True)
    if not args.no_browser:
        opener=threading.Timer(0.5,webbrowser.open,args=(url,));opener.daemon=True;opener.start()
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
