import socket
import platform

# Vercel's dev server on Windows lacks AF_UNIX. This patch prevents a crash in the Vercel runtime.
if platform.system() == "Windows":
    if not hasattr(socket, 'AF_UNIX'):
        socket.AF_UNIX = -1

from http.server import BaseHTTPRequestHandler
import json
import traceback
from .db_handler import get_engine, initialize_database, upload_match_data

class handler(BaseHTTPRequestHandler):

    def _send_cors_headers(self):
        """CORSヘッダーを送信する"""
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')

    def do_OPTIONS(self):
        """CORSプリフライトリクエストに応答する"""
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_POST(self):
        """POSTリクエストを処理し、マッチデータをDBにアップロードする"""
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            match_data = json.loads(post_data)
        except (TypeError, json.JSONDecodeError):
            self.send_response(400)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Invalid JSON'}).encode('utf-8'))
            return
        
        engine = None
        try:
            # DB接続と初期化
            engine = get_engine()
            # 本番環境では毎回呼び出すべきではありませんが、ここでは利便性のために含めます
            initialize_database(engine) 
            
            # データアップロード
            updated_ratings = upload_match_data(match_data, engine)
            
            # 成功レスポンス
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            response = {
                'message': 'Match data uploaded successfully',
                'updated_ratings': updated_ratings
            }
            self.wfile.write(json.dumps(response).encode('utf-8'))

        except Exception as e:
            # エラーレスポンス
            print(traceback.format_exc()) # Vercelのログで詳細を確認できるようにする
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Failed to upload match data', 'details': str(e)}).encode('utf-8'))
        
        finally:
            if engine:
                engine.dispose()
