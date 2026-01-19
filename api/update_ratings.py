from http.server import BaseHTTPRequestHandler
import json
from .db_handler import get_engine, update_player_ratings

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
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = self.rfile.read(content_length)
            data = json.loads(post_data)

            ratings_data = data.get('ratings')
            if not ratings_data:
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self._send_cors_headers()
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'No ratings data provided'}).encode('utf-8'))
                return

            engine = get_engine()
            update_player_ratings(engine, ratings_data)

            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'message': 'Ratings updated successfully'}).encode('utf-8'))

        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self._send_cors_headers()
            self.end_headers()
            self.wfile.write(json.dumps({'error': str(e)}).encode('utf-8'))