import os

class Config:
    """Application configuration settings"""
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'your-secret-key-here'

    # Database settings
    DATABASE_PATH = 'data/sample_movies.csv'

    # Upload settings
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16MB max file size

    # Emotion detection settings
    FACIAL_MODEL = 'deepface'
    AUDIO_MODEL_PATH = 'models/audio_emotion_model.pkl'

    # Recommendation settings
    MIN_RATING = 6.0
    MAX_RECOMMENDATIONS = 10

    # File paths
    FER2013_PATH = 'data/fer2013.csv'
    IMDB_BASICS_PATH = 'data/title.basics.tsv'
    IMDB_RATINGS_PATH = 'data/title.ratings.tsv'
