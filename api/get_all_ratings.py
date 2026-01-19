from flask import Flask, jsonify
import pandas as pd
from sqlalchemy import text
import sys
import os

from .db_handler import get_engine

app = Flask(__name__)

def get_all_player_ratings():
    """
    DBから全プレイヤーの最新レーティング情報を取得する
    """
    engine = get_engine()
    with engine.connect() as conn:
        # playerテーブルからプレイヤー情報を取得
        player_query = text("""
            SELECT puuid, gameName, tagLine
            FROM player
        """)
        player_df = pd.read_sql(player_query, conn)

        # player_ratingsテーブルから最新のレート情報を取得
        # puuidとlaneごとに最新のレコードを取得
        ratings_query = text("""
            SELECT pr.puuid, pr.lane, pr.mu
            FROM player_ratings pr
        """)
        ratings_df = pd.read_sql(ratings_query, conn)
        
        if ratings_df.empty:
            return []

        # player_dfとratings_dfをマージ
        merged_df = pd.merge(player_df, ratings_df, on='puuid', how='left')
        
        # レーンごとにmuをピボット
        pivot_df = merged_df.pivot_table(index=['puuid', 'gameName', 'tagLine'], columns='lane', values='mu').reset_index()

        # レーンのリスト
        lanes = ['top', 'jg', 'mid', 'bot', 'sup']
        for lane in lanes:
            if lane not in pivot_df.columns:
                pivot_df[lane] = 1500.0 # レートが存在しない場合はデフォルト値
        
        pivot_df.fillna(1500.0, inplace=True)

        # 辞書のリストに変換
        result_list = pivot_df.to_dict(orient='records')
        
        return result_list

@app.route('/api/get_all_ratings', methods=['GET'])
def get_all_ratings_endpoint():
    """
    全プレイヤーのレート情報を返すエンドポイント
    """
    try:
        all_ratings = get_all_player_ratings()
        return jsonify(all_ratings)
    except Exception as e:
        print(f"An error occurred while fetching all ratings: {e}")
        return jsonify({"error": "An internal error occurred."}), 500

# ローカルテスト用
if __name__ == '__main__':
    app.run(debug=True, port=5002)
