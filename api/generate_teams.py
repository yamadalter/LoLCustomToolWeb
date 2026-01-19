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
    指定されたpuuidリストのプレイヤーの全レーンレーティングをDBから取得する
    """
    if not puuids:
        return []

    engine = get_engine()
    with engine.connect() as conn:
        # playerテーブルからプレイヤー情報を取得
        player_query = text("""
            SELECT puuid, gameName, tagLine
            FROM player
            WHERE puuid IN :puuids
        """)
        player_df = pd.read_sql(player_query, conn, params={'puuids': tuple(puuids)})

        # player_ratingsテーブルからレート情報を取得
        ratings_query = text("""
            SELECT puuid, lane, mu
            FROM player_ratings
            WHERE puuid IN :puuids
        """)
        ratings_df = pd.read_sql(ratings_query, conn, params={'puuids': tuple(puuids)})

        # 結果を格納するリスト
        result_list = []
        
        # 全てのレーンを定義
        lanes = ['top', 'jg', 'mid', 'bot', 'sup']

        for _, player_row in player_df.iterrows():
            puuid = player_row['puuid']
            player_data = {
                'puuid': puuid,
                'gameName': player_row['gameName'],
                'tagLine': player_row['tagLine']
            }
            
            player_ratings_df = ratings_df[ratings_df['puuid'] == puuid]
            
            for lane in lanes:
                lane_rating = player_ratings_df[player_ratings_df['lane'] == lane]
                # レートが存在すればそのmuを、なければ1500をセット
                player_data[lane] = float(lane_rating['mu'].iloc[0]) if not lane_rating.empty else 1500.0
            
            result_list.append(player_data)

        return result_list

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
            lanes = ['top', 'jg', 'mid', 'bot', 'sup']
            for puuid in missing_puuids:
                player_data = {
                    'puuid': puuid,
                    'gameName': 'Unknown',
                    'tagLine': 'NA',
                }
                for lane in lanes:
                    player_data[lane] = 1500.0
                player_ratings.append(player_data)

        return jsonify(player_ratings)

    except Exception as e:
        print(f"An unexpected error occurred: {e}")
        return jsonify({"error": "An internal error occurred."}), 500

# Vercelではこの部分は不要だが、ローカルテスト用に残す
if __name__ == '__main__':
    app.run(debug=True, port=5001)
