import os
import datetime
import pandas as pd
from sqlalchemy import create_engine, text
from sqlalchemy_utils import database_exists, create_database
from pangres import upsert
import trueskill
from cassiopeia.core.match import MatchData
# create_table.py は同じapiディレクトリにあることを想定
from .create_table import (
    create_game_table,
    create_team_table,
    create_bans_table,
    create_player_table,
    create_player_ratings_table, # 追加
    create_rating_history_table, # 追加
    create_stats_table,
    create_participants_table,
)
ROLES = ['TOP', 'JUNGLE', 'MIDDLE', 'BOTTOM', 'UTILITY']
ROLE_MAP = {
    'TOP': 'top',
    'JUNGLE': 'jg',
    'MIDDLE': 'mid',
    'BOTTOM': 'bot',
    'UTILITY': 'sup'
}
trueskill.setup(mu=1500., sigma=450., beta=1500., tau=10.)
trueskill.global_env()
MIN_SIGMA = 350.0  # sigmaの下限値


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
            conn.execute(text(create_player_ratings_table)) # 追加
            conn.execute(text(create_rating_history_table)) # 追加
            conn.execute(text(create_stats_table))
            conn.execute(text(create_participants_table))
            conn.commit()
            print("Tables created or already exist.")
        except Exception as e:
            print(f"Error creating tables: {e}")
            raise


def upload_match_data(d, engine, update_rating=True):
    """
    受け取った辞書データをPandas DataFrameに変換し、DBにupsertする
    update_rating: Falseの場合、レート計算と更新をスキップする
    """
    # フロントエンドから渡される 'gameId' または Cassiopeia の 'id' を取得
    gameId_from_frontend = d.get('gameId')
    gameId_from_cass = d.get('id')
    gameId = gameId_from_frontend or gameId_from_cass

    if not gameId:
        raise ValueError("gameId is missing from match data")

    # DBに試合がすでに存在するかチェック
    with engine.connect() as conn:
        query = text("SELECT 1 FROM game WHERE id = :game_id")
        result = conn.execute(query, {'game_id': gameId}).scalar_one_or_none()
        if result is not None:
            print(f"Match {gameId} has already been processed. Skipping.")
            return []  # 空のリストを返して、更新がなかったことを示す

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
        participantIdentities = d.pop('participantIdentities', None)
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
            
            is_blue_team = 'blue' in str(team['side'])
            normalized_team_id = 0 if is_blue_team else 1

            team['side'] = 'blue' if is_blue_team else 'red'
            team['teamId'] = normalized_team_id

            bans = team.pop('bans', None)
            team.pop('participants', None)
            df_teams = pd.concat([df_teams, pd.json_normalize(team)])
            if bans:
                for ban in bans:
                    ban['teamId'] = normalized_team_id
                    ban['gameId'] = gameId
                    df_bans = pd.concat([df_bans, pd.json_normalize(ban)])
        
        # participantsデータ処理
        for i, p in enumerate(participants):
            for identity in participantIdentities:
                if p['participantId'] == identity['participantId']:
                    p['player'] = identity['player']
            p['position'] = ROLES[i % len(ROLES)]
            p['puuid'] = p.get('player', {}).get('puuid')
            p['gameId'] = gameId

            is_blue_team = 'blue' in str(p['side'])
            p['side'] = 'blue' if is_blue_team else 'red'
            p['teamId'] = 0 if is_blue_team else 1
            
            participantId = p.get('participantId')
            
            stats = p.pop('stats', None)
            stats['participantId'] = participantId
            stats['gameId'] = gameId
            stats['puuid'] = p.get('puuid')
            
            player = p.pop('player', None)
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

            df_player_ratings = pd.DataFrame([])
            df_rating_history = pd.DataFrame([])

            if update_rating:
                all_puuids = df_participants['puuid'].unique().tolist()
                
                # 既存プレイヤーの全レーンレートを取得
                query = text("SELECT puuid, lane, mu, sigma FROM player_ratings WHERE puuid IN :puuids")
                with engine.connect() as conn:
                    # all_puuidsが空でないことを確認
                    if all_puuids:
                        existing_ratings_df = pd.read_sql(query, conn, params={'puuids': tuple(all_puuids)})
                    else:
                        existing_ratings_df = pd.DataFrame(columns=['puuid', 'lane', 'mu', 'sigma'])

                # (puuid, lane)をキーとするRatingオブジェクトの辞書を作成
                existing_ratings = {
                    (row['puuid'], row['lane']): trueskill.Rating(mu=row['mu'], sigma=row['sigma'])
                    for _, row in existing_ratings_df.iterrows()
                }

                # 試合参加者のRatingオブジェクトを準備
                player_ratings = {
                    (row['puuid'], ROLE_MAP[row['position']]): existing_ratings.get((row['puuid'], ROLE_MAP[row['position']]), trueskill.Rating())
                    for _, row in df_participants.iterrows()
                }

                # チーム分け
                team0_ratings_dict = {
                    (puuid, lane): rating for (puuid, lane), rating in player_ratings.items()
                    if puuid in df_participants[df_participants['teamId'] == 0]['puuid'].values
                }
                team1_ratings_dict = {
                    (puuid, lane): rating for (puuid, lane), rating in player_ratings.items()
                    if puuid in df_participants[df_participants['teamId'] == 1]['puuid'].values
                }

                # 勝敗ランクを設定
                winning_team_row = df_teams[df_teams['isWinner'] == 'Win']
                if winning_team_row.empty:
                    raise ValueError("Winner team not found in match data. Remake game?")
                winner_team_id = winning_team_row.index.get_level_values('teamId')[0]
                ranks = [0, 1] if winner_team_id == 0 else [1, 0]

                # レート計算
                new_team0_ratings, new_team1_ratings = trueskill.rate([team0_ratings_dict, team1_ratings_dict], ranks=ranks)

                # 更新用DataFrame作成
                updated_ratings = {**new_team0_ratings, **new_team1_ratings}
                
                new_ratings_list = []
                for key, rating in updated_ratings.items():
                    new_sigma = max(rating.sigma, MIN_SIGMA)  # sigmaがMIN_SIGMA未満にならないように下限を設定
                    new_ratings_list.append({
                        'puuid': key[0],
                        'lane': key[1],
                        'mu': rating.mu,
                        'sigma': new_sigma
                    })
                
                df_player_ratings = pd.DataFrame(new_ratings_list)
                
                if not df_player_ratings.empty:
                    df_player_ratings.set_index(['puuid', 'lane'], inplace=True)

                    # レーティング履歴の記録
                    history_list = []
                    for (puuid, lane), new_rating in updated_ratings.items():
                        old_rating = player_ratings.get((puuid, lane), trueskill.Rating())
                        new_sigma = max(new_rating.sigma, MIN_SIGMA) # sigmaがMIN_SIGMA未満にならないように下限を設定
                        history_list.append({
                            'puuid': puuid,
                            'lane': lane,
                            'gameId': gameId,
                            'mu_before': old_rating.mu,
                            'sigma_before': old_rating.sigma,
                            'mu_after': new_rating.mu,
                            'sigma_after': new_sigma,
                        })
                    df_rating_history = pd.DataFrame(history_list)
                    if not df_rating_history.empty:
                        df_rating_history.set_index(['puuid', 'lane', 'gameId'], inplace=True)


        # データフレームをデータベースに登録
        with engine.connect() as conn:
            trans = conn.begin()
            try:
                upsert(con=conn, df=df_game, table_name='game', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_player.empty:
                    upsert(con=conn, df=df_player, table_name='player', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_teams.empty:
                    upsert(con=conn, df=df_teams, table_name='team', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_bans.empty:
                    upsert(con=conn, df=df_bans, table_name='bans', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_stats.empty:
                    upsert(con=conn, df=df_stats, table_name='stats', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_participants.empty:
                    upsert(con=conn, df=df_participants, table_name='participants', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_player_ratings.empty:
                    upsert(con=conn, df=df_player_ratings, table_name='player_ratings', if_row_exists='update', add_new_columns=True, create_table=False)
                if not df_rating_history.empty:
                    upsert(con=conn, df=df_rating_history, table_name='rating_history', if_row_exists='update', add_new_columns=True, create_table=False)
                trans.commit()
            except Exception:
                trans.rollback()
                raise
        
        if not df_player_ratings.empty:
            return df_player_ratings.reset_index().to_dict(orient='records')
        else:
            return []
    except Exception as e:
        print(f"An error occurred in upload_match_data: {e}")
        # 必要に応じて、ここでNoneや空の辞書を返すなどのエラーハンドリングを追加できます
        raise

def update_player_ratings(engine, ratings_data):
    """
    プレイヤーのレート情報を一括で更新する
    ratings_data: [{'puuid': str, 'lane': str, 'mu': float}] のリスト
    """
    if not ratings_data:
        return

    df = pd.DataFrame(ratings_data)
    
    # sigma はデフォルト値を設定
    df['sigma'] = trueskill.global_env().sigma

    # playerテーブルに存在しないpuuidを追加する
    all_puuids = df['puuid'].unique()
    df_players = pd.DataFrame(all_puuids, columns=['puuid']).set_index('puuid')

    df.set_index(['puuid', 'lane'], inplace=True)

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # プレイヤー情報をまずupsert
            upsert(con=conn, df=df_players, table_name='player', if_row_exists='update', create_table=False)
            # 次にplayer_ratingsをupsert
            upsert(con=conn, df=df, table_name='player_ratings', if_row_exists='update', create_table=False)
            trans.commit()
        except Exception as e:
            trans.rollback()
            print(f"Error updating player ratings: {e}")
            raise
