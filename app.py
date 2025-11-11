from flask import Flask, render_template, request, jsonify
import os, uuid
from werkzeug.utils import secure_filename

from models.facial_emotion import FacialEmotionDetector
from models.audio_emotion import AudioEmotionDetector
from models.text_sentiment import TextSentimentAnalyzer
from models.multimodal_fusion import MultimodalFusion
from models.recommendation_engine import MovieRecommendationEngine
from config import Config

app = Flask(__name__)
app.config.from_object(Config)

text_analyzer = TextSentimentAnalyzer()
facial_detector = FacialEmotionDetector()
audio_detector = AudioEmotionDetector()
fusion_engine = MultimodalFusion()
recommendation_engine = MovieRecommendationEngine()

os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze_emotion', methods=['POST'])
def analyze_emotion():
    session_id = str(uuid.uuid4())
    face_result = {'emotion':'neutral','confidence':0.5}
    audio_result = {'emotion':'neutral','confidence':0.5}
    text_result = {'emotion':'neutral','confidence':0.5}
    # TEXT
    text = request.form.get('text', '').strip()
    if text:
        text_result = text_analyzer.analyze(text)
    # IMAGE
    if 'image' in request.files:
        image_file = request.files['image']
        if image_file and image_file.filename != '':
            image_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}_image.jpg")
            image_file.save(image_path)
            face_result = facial_detector.detect_from_image(image_path)
            os.remove(image_path)
    # AUDIO
    if 'audio' in request.files:
        audio_file = request.files['audio']
        if audio_file and audio_file.filename != '':
            audio_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{session_id}_audio.wav")
            audio_file.save(audio_path)
            audio_result = audio_detector.detect_emotion(audio_path)
            os.remove(audio_path)
    fusion_result = fusion_engine.combine_emotions(face_result, audio_result, text_result)
    final_emotion = fusion_result.get('final_emotion', 'neutral')
    recommendations = recommendation_engine.get_movies_by_emotion(final_emotion, limit=10)
    if not recommendations:
        recommendations = recommendation_engine.get_random_movies(limit=10)
    return jsonify({
        'success': True,
        'session_id': session_id,
        'emotion_analysis': fusion_result,
        'recommendations': recommendations
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
