import os
import datetime
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy_utils import database_exists, create_database
from pangres import upsert
from cassiopeia.core.match import MatchData
# create_table.py は同じapiディレクトリにあることを想定
from .create_table import (
    create_game_table,
    create_team_table,
    create_bans_table,
    create_player_table,
    create_stats_table,
    create_participants_table,
)


def get_engine():
    """環境変数から接続情報を読み込み、DBエンジンを作成して返す"""
    # Vercelの環境変数から接続情報を取得
    user = os.environ.get('MYSQL_USER')
    password = os.environ.get('MYSQL_PASSWORD')
    host = os.environ.get('MYSQL_HOST')
    db = os.environ.get('MYSQL_DATABASE')
    
    if not all([user, password, host, db]):
        raise ValueError("Database environment variables are not fully set.")

    # ポートは固定または環境変数で指定
    port = os.environ.get('MYSQL_PORT', 3306)
    
    return create_engine(f'mysql+pymysql://{user}:{password}@{host}:{port}/{db}')


def initialize_database(engine):
    """データベースとテーブルが存在しない場合に作成する"""
    if not database_exists(engine.url):
        try:
            create_database(engine.url)
            print("Database created.")
        except Exception as e:
            print(f"Database creation failed: {e}")
            raise

    with engine.connect() as conn:
        try:
            # テーブル作成
            conn.execute(text(create_game_table))
            conn.execute(text(create_team_table))
            conn.execute(text(create_bans_table))
            conn.execute(text(create_player_table))
            conn.execute(text(create_stats_table))
            conn.execute(text(create_participants_table))
            print("Tables created or already exist.")
        except Exception as e:
            print(f"Error creating tables: {e}")
            raise


def upload_match_data(d, engine):
    """
    受け取った辞書データをPandas DataFrameに変換し、DBにupsertする
    """
    try:
        # 初期化
        df_player = pd.DataFrame([])
        df_participants = pd.DataFrame([])
        df_stats = pd.DataFrame([])
        df_teams = pd.DataFrame([])
        df_bans = pd.DataFrame([])

        # データフレームに変換
        d["region"] = 'JP'
        matchdata = MatchData()
        d = matchdata(**d).to_dict()
        d.pop('participantIdentities', None)
        participants = d.pop('participants', None)
        teams = d.pop('teams', None)

        df_game = pd.json_normalize(d)
        df_game['duration'] = str(d.get('duration'))
        if d.get('creation'):
            df_game['creation'] = d['creation'].datetime.strftime('%Y-%m-%d %H:%M:%S.%f')
        if d.get('gameCreationDate'):
            df_game['gameCreationDate'] = str(datetime.datetime.strptime(d['gameCreationDate'], '%Y-%m-%dT%H:%M:%S.%fZ'))
        
        gameId = d.get('id')
        if not gameId:
            raise ValueError("gameId is missing from match data")

        # teamデータ処理
        for team in teams:
            team['gameId'] = gameId
            
            # teamId(100/200)に基づいてsideを設定し、teamIdを0/1に正規化
            is_blue_team = team.get('teamId') == 100
            normalized_team_id = 0 if is_blue_team else 1

            team['side'] = 'blue' if is_blue_team else 'red'
            team['teamId'] = normalized_team_id

            bans = team.pop('bans', None)
            team.pop('participants', None) # 不要なキーを削除
            df_teams = pd.concat([df_teams, pd.json_normalize(team)])
            if bans:
                for ban in bans:
                    ban['teamId'] = normalized_team_id
                    ban['gameId'] = gameId
                    df_bans = pd.concat([df_bans, pd.json_normalize(ban)])
        
        # participantsデータ処理
        for p in participants:
            p['puuid'] = p.get('player', {}).get('puuid')
            p['gameId'] = gameId

            # teamId(100/200)に基づいてsideを設定し、teamIdを0/1に正規化
            is_blue_team = p.get('teamId') == 100
            p['side'] = 'blue' if is_blue_team else 'red'
            p['teamId'] = 0 if is_blue_team else 1
            
            participantId = p.get('participantId')
            
            stats = p.pop('stats', {})
            stats['participantId'] = participantId
            stats['gameId'] = gameId
            stats['puuid'] = p.get('puuid')
            
            player = p.pop('player', {})
            p.pop('timeline', None)
            
            df_participants = pd.concat([df_participants, pd.json_normalize(p)])
            if player:
                df_player = pd.concat([df_player, pd.json_normalize(player)])
            df_stats = pd.concat([df_stats, pd.json_normalize(stats)])

        # インデックスを設定
        df_game = df_game.set_index('id')
        if not df_player.empty:
            df_player.drop_duplicates(subset=['puuid'], keep='first', inplace=True)
            df_player = df_player.set_index('puuid')
        if not df_teams.empty:
            df_teams.drop_duplicates(subset=['gameId', 'teamId'], keep='first', inplace=True)
            df_teams = df_teams.set_index(['gameId', 'teamId'])
        if not df_bans.empty:
            df_bans.drop_duplicates(subset=['gameId', 'teamId', 'pickTurn'], keep='first', inplace=True)
            df_bans = df_bans.set_index(['gameId', 'teamId', 'pickTurn'])
        if not df_stats.empty:
            df_stats.drop_duplicates(subset=['participantId', 'gameId'], keep='first', inplace=True)
            df_stats = df_stats.set_index(['participantId', 'gameId'])
        if not df_participants.empty:
            df_participants.drop_duplicates(subset=['participantId', 'gameId'], keep='first', inplace=True)
            df_participants = df_participants.set_index(['participantId', 'gameId'])

        # データフレームをデータベースに登録
        upsert(con=engine, df=df_game, table_name='game', if_row_exists='update', add_new_columns=True, create_table=False)
        if not df_player.empty:
            upsert(con=engine, df=df_player, table_name='player', if_row_exists='update', add_new_columns=True, create_table=False)
        if not df_teams.empty:
            upsert(con=engine, df=df_teams, table_name='team', if_row_exists='update', add_new_columns=True, create_table=False)
        if not df_bans.empty:
            upsert(con=engine, df=df_bans, table_name='bans', if_row_exists='update', add_new_columns=True, create_table=False)
        if not df_stats.empty:
            upsert(con=engine, df=df_stats, table_name='stats', if_row_exists='update', add_new_columns=True, create_table=False)
        if not df_participants.empty:
            upsert(con=engine, df=df_participants, table_name='participants', if_row_exists='update', add_new_columns=True, create_table=False)
        
        return True

    except Exception as e:
        print(f"Upload process failed: {e}")
        # エラーを再発生させて、呼び出し元でトランザクションをロールバックできるようにする
        raise
