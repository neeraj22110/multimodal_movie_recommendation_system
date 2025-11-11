import sqlite3
import pandas as pd
import os
import ast
from config import Config

def create_database():
    """Create SQLite database and tables for movies"""
    conn = sqlite3.connect(Config.DATABASE_PATH)
    cursor = conn.cursor()

    # Create movies table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS movies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imdb_id TEXT UNIQUE,
            title TEXT NOT NULL,
            genre TEXT,
            year INTEGER,
            rating REAL,
            votes INTEGER,
            runtime_minutes INTEGER,
            emotion_tags TEXT,
            file_path TEXT,
            thumbnail TEXT,
            description TEXT
        )
    """)

    # Create user_sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS user_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT,
            face_emotion TEXT,
            audio_emotion TEXT,
            text_emotion TEXT,
            final_emotion TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()
    print("✅ Database created successfully!")

def parse_genres_field(g):
    """Parse genres field which might be JSON list of dicts or a string like 'Action,Drama'"""
    if pd.isna(g) or g == "":
        return ""
    # If it's already a comma-separated string, return cleaned string
    if isinstance(g, str):
        # Try to detect JSON-like structure
        s = g.strip()
        if s.startswith("[") and ("name" in s or "id" in s):
            try:
                parsed = ast.literal_eval(s)
                if isinstance(parsed, list):
                    names = [x.get('name') if isinstance(x, dict) else str(x) for x in parsed]
                    return ",".join([n for n in names if n])
            except Exception:
                pass
        # Otherwise assume it's a simple comma separated string (or plain genre name)
        # Normalize separators and whitespace
        return ",".join([part.strip() for part in s.replace(";", ",").split(",") if part.strip()])
    # If it's list-like already
    if isinstance(g, list):
        names = []
        for item in g:
            if isinstance(item, dict):
                names.append(item.get("name", "").strip())
            else:
                names.append(str(item).strip())
        return ",".join([n for n in names if n])
    return str(g)

def safe_extract_year(val):
    """Try to extract year (int) from various formats (YYYY or YYYY-MM-DD)"""
    if pd.isna(val) or val == "":
        return None
    try:
        s = str(val)
        # If full date like 2009-05-14
        if "-" in s:
            parts = s.split("-")
            year = int(parts[0])
            return year
        # If just year
        year = int(s)
        return year
    except Exception:
        return None

def load_dataset_into_db():
    """
    Load movies from CSV into the SQLite database.
    Uses Config.DATASET_CSV_PATH if set, otherwise tries common paths.
    """
    # Determine dataset path
    dataset_path = getattr(Config, "DATASET_CSV_PATH", None)
    fallback_paths = [
        dataset_path,
        "data/sample_movies.csv",
        "sample_movies.csv",
        "/mnt/data/sample_movies.csv"
    ]
    dataset_path = next((p for p in fallback_paths if p and os.path.exists(p)), None)

    if not dataset_path:
        raise FileNotFoundError("Movie dataset CSV not found. Set Config.DATASET_CSV_PATH or place sample_movies.csv in project folder or /mnt/data/.")

    print(f"Loading dataset from: {dataset_path}")
    df = pd.read_csv(dataset_path, low_memory=False)

    # Normalize common column names (detect)
    title_col = next((c for c in ['title', 'name'] if c in df.columns), None)
    id_col = next((c for c in ['imdb_id', 'imdbID', 'imdbId'], if_col := None), None)  # placeholder; we handle below
    # We'll treat TMDB numeric id as fallback for imdb if imdb_id not present
    tmdb_id_col = next((c for c in ['id', 'movie_id', 'tmdb_id'] if c in df.columns), None)
    overview_col = next((c for c in ['overview', 'description', 'tagline', 'summary'] if c in df.columns), None)
    genres_col = next((c for c in ['genres', 'genre', 'genres_x'] if c in df.columns), None)
    year_col = next((c for c in ['release_date', 'year', 'release_year'] if c in df.columns), None)
    rating_col = next((c for c in ['vote_average', 'rating', 'score'] if c in df.columns), None)
    votes_col = next((c for c in ['vote_count', 'votes'] if c in df.columns), None)
    runtime_col = next((c for c in ['runtime', 'runtime_minutes', 'length', 'duration'] if c in df.columns), None)
    file_path_col = next((c for c in ['file_path', 'file', 'filepath', 'video'] if c in df.columns), None)
    emotion_tags_col = next((c for c in ['emotion_tags', 'emotions', 'tags'] if c in df.columns), None)

    # Fallback: require title at least
    if not title_col:
        raise ValueError("No title/name column found in CSV. Please ensure your dataset has a 'title' or 'name' column.")

    # Fill defaults and create normalized columns
    df[title_col] = df[title_col].astype(str).fillna("").str.strip()
    df['imdb_id_norm'] = df.get('imdb_id') if 'imdb_id' in df.columns else None
    # If imdb_id exists (maybe named differently), try to use it
    possible_imdb_cols = [c for c in ['imdb_id', 'imdbID', 'imdbId'] if c in df.columns]
    if possible_imdb_cols:
        df['imdb_id_norm'] = df[possible_imdb_cols[0]].astype(str).fillna("").replace({'nan': ''})
    else:
        df['imdb_id_norm'] = ""

    # If imdb id empty, fallback to tmdb id prefixed
    if tmdb_id_col:
        df['tmdb_id_norm'] = df[tmdb_id_col].astype(str).fillna("")
    else:
        df['tmdb_id_norm'] = ""

    def make_imdb_id(row):
        if row['imdb_id_norm'] and str(row['imdb_id_norm']).strip() not in ['', 'nan', 'None']:
            return str(row['imdb_id_norm']).strip()
        if row['tmdb_id_norm'] and str(row['tmdb_id_norm']).strip() not in ['', 'nan', 'None']:
            return f"tmdb_{str(row['tmdb_id_norm']).strip()}"
        return None

    df['imdb_id_final'] = df.apply(make_imdb_id, axis=1)

    # Description/overview
    if overview_col:
        df['description_norm'] = df[overview_col].astype(str).fillna("")
    else:
        df['description_norm'] = ""

    # Genres parse
    if genres_col:
        df['genre_norm'] = df[genres_col].apply(parse_genres_field)
    else:
        df['genre_norm'] = ""

    # Year parse
    if year_col:
        df['year_norm'] = df[year_col].apply(safe_extract_year)
    else:
        # Try to extract year from 'release_date' if present as fallback already handled; else None
        df['year_norm'] = None

    # Rating, votes, runtime
    df['rating_norm'] = df[rating_col] if rating_col and rating_col in df.columns else None
    df['votes_norm'] = df[votes_col] if votes_col and votes_col in df.columns else None
    df['runtime_norm'] = df[runtime_col] if runtime_col and runtime_col in df.columns else None

    # Emotion tags and file path
    df['emotion_tags_norm'] = df[emotion_tags_col].astype(str).fillna("") if emotion_tags_col and emotion_tags_col in df.columns else ""
    df['file_path_norm'] = df[file_path_col].astype(str).fillna("") if file_path_col and file_path_col in df.columns else ""

    # Connect to DB and insert rows
    conn = sqlite3.connect(Config.DATABASE_PATH)
    cursor = conn.cursor()

    inserted = 0
    for _, row in df.iterrows():
        imdb_id = row.get('imdb_id_final')
        title = row.get(title_col, "")
        genre = row.get('genre_norm', "")
        year = row.get('year_norm', None)
        rating = row.get('rating_norm', None)
        votes = row.get('votes_norm', None)
        runtime_minutes = row.get('runtime_norm', None)
        emotion_tags = row.get('emotion_tags_norm', "")
        file_path = row.get('file_path_norm', "")
        description = row.get('description_norm', "")

        cursor.execute("""
            INSERT OR REPLACE INTO movies
            (imdb_id, title, genre, year, rating, votes, runtime_minutes, emotion_tags, file_path, description)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (imdb_id, title, genre, year, rating, votes, runtime_minutes, emotion_tags, file_path, description))
        inserted += 1

    conn.commit()
    conn.close()
    print(f"✅ Loaded {inserted} movies into the database from {dataset_path}.")

if __name__ == '__main__':
    # Ensure folders exist
    os.makedirs('data', exist_ok=True)
    os.makedirs('static/movies', exist_ok=True)

    # Create DB and tables
    create_database()

    # Load dataset into DB
    try:
        load_dataset_into_db()
    except Exception as e:
        print("❌ Error while loading dataset:", str(e))
        print("If you don't have a CSV, the old sample data insertion can be used. To use a CSV, either:")
        print(" - Put your CSV at 'data/sample_movies.csv' or 'sample_movies.csv',")
        print(" - Or set Config.DATASET_CSV_PATH to the CSV full path.")
    print("🎉 Database setup complete!")
