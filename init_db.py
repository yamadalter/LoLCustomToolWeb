from dotenv import load_dotenv
import os

# .envファイルから環境変数を読み込む
load_dotenv()

# apiディレクトリ内のモジュールをインポートするためにパスを追加
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), 'api'))

from db_handler import get_engine, initialize_database

def main():
    """
    データベースを初期化する
    """
    print("Initializing database...")
    try:
        engine = get_engine()
        initialize_database(engine)
        print("Database initialization complete.")
    except ValueError as e:
        print(f"Error: {e}")
        print("Please make sure all required environment variables are set in your .env file.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == "__main__":
    main()
