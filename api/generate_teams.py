import os
import pandas as pd
from sqlalchemy import text
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# 親ディレクトリのdb_handlerをインポート
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from api.db_handler import get_engine

load_dotenv()

app = Flask(__name__)

def get_player_ratings(puuids):
    """
    指定されたpuuidリストのプレイヤーレーティングをDBから取得する
    """
    engine = get_engine()
    with engine.connect() as conn:
        # レーンごとに最新のmuを取得するクエリ
        # player_ratingsにないプレイヤーはデフォルト値(mu=25.0)を使用
        query = text("""
            SELECT 
                p.puuid,
                p.gameName,
                p.tagLine,
                COALESCE(pr.lane, 'DEFAULT') as lane,
                COALESCE(pr.mu, 25.0) as mu
            FROM 
                player p
            LEFT JOIN 
                player_ratings pr ON p.puuid = pr.puuid
            WHERE 
                p.puuid IN :puuids
        """)
        
        df = pd.read_sql(query, conn, params={'puuids': tuple(puuids)})
        
        # 各プレイヤーの最高レートを代表値として使用
        best_ratings = df.loc[df.groupby('puuid')['mu'].idxmax()]
        
        # puuidをカラムとして残すためにインデックスをリセット
        return best_ratings.reset_index(drop=True).to_dict('records')

@app.route('/api/get_ratings', methods=['POST'])
def get_ratings_endpoint():
    """
    POSTリクエストからpuuidリストを受け取り、プレイヤーのレート情報を返すエンドポイント
    """
    data = request.get_json()
    puuids = data.get('puuids')

    if not puuids:
        return jsonify({"error": "puuids not provided"}), 400

    try:
        player_ratings = get_player_ratings(puuids)
        
        # DBに存在しなかったプレイヤーを特定
        found_puuids = {p['puuid'] for p in player_ratings}
        missing_puuids = set(puuids) - found_puuids
        
        if missing_puuids:
            print(f"Warning: Players not found in DB, using default rating: {missing_puuids}")
            # 不明なプレイヤー情報を追加
            for puuid in missing_puuids:
                player_ratings.append({
                    'puuid': puuid,
                    'gameName': 'Unknown',
                    'tagLine': 'NA',
                    'lane': 'DEFAULT',
                    'mu': 25.0
                })

        return jsonify(player_ratings)

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal error occurred."}), 500

# Vercelではこの部分は不要だが、ローカルテスト用に残す
if __name__ == '__main__':
    app.run(debug=True, port=5001)
