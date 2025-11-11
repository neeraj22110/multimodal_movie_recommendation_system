// app.js (UPDATED)
// Emotion Analysis & Movie Recommendation System JavaScript
// - Sends text/image/audio to backend /analyze_emotion
// - Displays per-modality confidences (only for provided inputs)
// - Displays final emotion + confidence
// - Shows recommendations returned by backend
// - Falls back to local sampleMovies if backend not reachable

let isRecording = false;
let mediaRecorder = null;
let audioChunks = [];

// Sample fallback data (used only if backend fails)
const sampleMovies = [
    { id: 1, title: "The Shawshank Redemption", genre: "Drama", rating: 9.3, year: 1994, thumbnail: "https://via.placeholder.com/300x450/1a1a2e/eee?text=Movie+1" },
    { id: 2, title: "The Dark Knight", genre: "Action", rating: 9.0, year: 2008, thumbnail: "https://via.placeholder.com/300x450/16213e/eee?text=Movie+2" },
    { id: 3, title: "Pulp Fiction", genre: "Crime", rating: 8.9, year: 1994, thumbnail: "https://via.placeholder.com/300x450/0f3460/eee?text=Movie+3" },
    { id: 4, title: "Forrest Gump", genre: "Drama", rating: 8.8, year: 1994, thumbnail: "https://via.placeholder.com/300x450/533483/eee?text=Movie+4" },
    { id: 5, title: "Inception", genre: "Sci-Fi", rating: 8.8, year: 2010, thumbnail: "https://via.placeholder.com/300x450/2c3e50/eee?text=Movie+5" },
    { id: 6, title: "The Godfather", genre: "Crime", rating: 9.2, year: 1972, thumbnail: "https://via.placeholder.com/300x450/8b4513/eee?text=Movie+6" }
];

document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    hideAllSections();
    setupEventListeners();
    addResetButton();
}

// ---------------- Event Listeners ----------------
function setupEventListeners() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (analyzeBtn) analyzeBtn.addEventListener('click', (e) => { e.preventDefault(); handleAnalyze(); });

    const recordBtn = document.getElementById('recordBtn');
    if (recordBtn) recordBtn.addEventListener('click', (e) => { e.preventDefault(); toggleRecording(); });

    const imageInput = document.getElementById('imageInput');
    if (imageInput) imageInput.addEventListener('change', handleImageUpload);

    const audioInput = document.getElementById('audioInput');
    if (audioInput) audioInput.addEventListener('change', handleAudioUpload);

    const closeModal = document.getElementById('closeModal');
    if (closeModal) closeModal.addEventListener('click', closeMovieModal);

    const backToRecommendations = document.getElementById('backToRecommendations');
    if (backToRecommendations) backToRecommendations.addEventListener('click', closeMovieModal);

    const closeToast = document.getElementById('closeToast');
    if (closeToast) closeToast.addEventListener('click', hideToast);

    const movieModal = document.getElementById('movieModal');
    if (movieModal) {
        movieModal.addEventListener('click', function(e) {
            if (e.target === movieModal) closeMovieModal();
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeMovieModal();
        if (e.ctrlKey && e.key === 'Enter') handleAnalyze();
    });
}

// ---------------- UI Helpers ----------------
function hideAllSections() {
    ['loadingSection', 'resultsSection', 'moviesSection'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function showLoadingState() {
    hideAllSections();
    const loadingSection = document.getElementById('loadingSection');
    if (loadingSection) loadingSection.classList.remove('hidden');
}

function showResultsState() {
    const loadingSection = document.getElementById('loadingSection');
    if (loadingSection) loadingSection.classList.add('hidden');

    const resultsSection = document.getElementById('resultsSection');
    if (resultsSection) resultsSection.classList.remove('hidden');

    const moviesSection = document.getElementById('moviesSection');
    if (moviesSection) moviesSection.classList.remove('hidden');
}

function showError(message) {
    const errorToast = document.getElementById('errorToast');
    const errorMessage = document.getElementById('errorMessage');
    if (errorMessage && errorToast) {
        errorMessage.textContent = message;
        errorToast.classList.remove('hidden');
        setTimeout(hideToast, 5000);
    }
    console.error(message);
}
function hideToast() {
    const errorToast = document.getElementById('errorToast');
    if (errorToast) errorToast.classList.add('hidden');
}

// ---------------- File handlers ----------------
function handleImageUpload(event) {
    const file = event.target.files[0];
    const imagePreview = document.getElementById('imagePreview');
    if (!imagePreview) return;
    imagePreview.innerHTML = '';
    imagePreview.classList.remove('active');

    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            imagePreview.innerHTML = `
                <div style="display:flex;align-items:center;gap:12px">
                    <img src="${e.target.result}" alt="Preview" style="max-width:100px;max-height:100px;border-radius:8px">
                    <div><p><strong>Selected:</strong> ${file.name}</p><p><strong>Size:</strong> ${(file.size/1024/1024).toFixed(2)} MB</p></div>
                </div>
            `;
            imagePreview.classList.add('active');
        };
        reader.readAsDataURL(file);
    } else if (file) {
        showError('कृपया एक valid image file select करें');
        event.target.value = '';
    }
}

function handleAudioUpload(event) {
    const file = event.target.files[0];
    const audioPreview = document.getElementById('audioPreview');
    if (!audioPreview) return;
    audioPreview.innerHTML = '';
    audioPreview.classList.remove('active');

    if (file && file.type.startsWith('audio/')) {
        audioPreview.innerHTML = `
            <div style="display:flex;align-items:center;gap:12px">
                <audio controls style="width:200px;">
                    <source src="${URL.createObjectURL(file)}" type="${file.type}">
                </audio>
                <div><p><strong>Selected:</strong> ${file.name}</p><p><strong>Size:</strong> ${(file.size/1024/1024).toFixed(2)} MB</p></div>
            </div>
        `;
        audioPreview.classList.add('active');
    } else if (file) {
        showError('कृपया एक valid audio file select करें');
        event.target.value = '';
    }
}

// ---------------- Audio recording ----------------
async function toggleRecording() {
    const recordBtn = document.getElementById('recordBtn');
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = e => audioChunks.push(e.data);
            mediaRecorder.onstop = () => {
                const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                const audioURL = URL.createObjectURL(audioBlob);
                const audioPreview = document.getElementById('audioPreview');
                if (audioPreview) {
                    audioPreview.innerHTML = `
                        <div style="display:flex;align-items:center;gap:12px">
                            <audio controls style="width:200px;"><source src="${audioURL}" type="audio/webm"></audio>
                            <div><p><strong>Recorded Audio</strong></p><p><strong>Size:</strong> ${(audioBlob.size/1024).toFixed(1)} KB</p></div>
                        </div>
                    `;
                    audioPreview.classList.add('active');
                }
                // convert to File and put into a hidden input for submission
                const file = new File([audioBlob], 'recorded_audio.webm', { type: 'audio/webm' });
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(file);
                const audioInput = document.getElementById('audioInput');
                if (audioInput) audioInput.files = dataTransfer.files;
                stream.getTracks().forEach(t => t.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            if (recordBtn) { recordBtn.textContent = '⏹️ Stop Recording'; recordBtn.classList.add('recording'); }
        } catch (err) {
            showError('Microphone access denied या उपलब्ध नहीं है');
        }
    } else {
        if (mediaRecorder) mediaRecorder.stop();
        isRecording = false;
        if (recordBtn) { recordBtn.textContent = '🎤 Record Audio'; recordBtn.classList.remove('recording'); }
    }
}

// ---------------- Main analyze flow ----------------
async function handleAnalyze() {
    try {
        const textInput = document.getElementById('textInput');
        const imageInput = document.getElementById('imageInput');
        const audioInput = document.getElementById('audioInput');

        const text = textInput ? textInput.value.trim() : '';
        const imageFile = (imageInput && imageInput.files && imageInput.files.length) ? imageInput.files[0] : null;
        const audioFile = (audioInput && audioInput.files && audioInput.files.length) ? audioInput.files[0] : null;

        if (!text && !imageFile && !audioFile) {
            showError('कृपया कम से कम एक input provide करें (text, image, या audio)');
            return;
        }

        showLoadingState();

        // Build FormData
        const formData = new FormData();
        if (text) formData.append('text', text);
        if (imageFile) formData.append('image', imageFile);
        if (audioFile) formData.append('audio', audioFile);

        // Send to backend
        let responseJson = null;
        try {
            const resp = await fetch('/analyze_emotion', {
                method: 'POST',
                body: formData
            });
            if (!resp.ok) throw new Error(`Server returned ${resp.status}`);
            responseJson = await resp.json();
        } catch (err) {
            console.warn('Backend request failed, falling back to local mock. Error:', err);
            // Fallback: create a mock response shaped like backend
            responseJson = {
                success: false,
                session_id: null,
                emotion_analysis: {
                    final_emotion: text ? 'happy' : 'neutral',
                    final_confidence: 0.75,
                    face: imageFile ? { emotion: 'happy', confidence: 0.7 } : null,
                    audio: audioFile ? { emotion: 'happy', confidence: 0.6 } : null,
                    text: text ? { emotion: 'happy', confidence: 0.8 } : null
                },
                recommendations: sampleMovies.slice(0,4)
            };
        }

        // parse fusion result & recommendations
        const fusion = responseJson.emotion_analysis || {};
        const recs = responseJson.recommendations || [];

        // Display results with attention to which inputs were provided
        displayFusionResults(fusion, { textProvided: !!text, imageProvided: !!imageFile, audioProvided: !!audioFile });

        // Display recommendations (prefer backend recs; fallback to our sample if empty)
        const moviesToShow = (recs && recs.length) ? recs : sampleMovies.slice(0,4);
        displayMovieRecommendations(moviesToShow);

        showResultsState();

    } catch (err) {
        console.error('Error in handleAnalyze:', err);
        hideAllSections();
        showError('Analysis में कोई error आई है। कृपया दोबारा try करें।');
    }
}

// ---------------- Display fusion & per-modality ----------------
function displayFusionResults(fusion, provided = { textProvided: false, imageProvided: false, audioProvided: false }) {
    // Expected fusion format (example):
    // { final_emotion: 'happy', final_confidence: 0.85, face: {emotion:'happy', confidence:0.9}, audio: {...}, text: {...} }
    const finalEmotion = fusion.final_emotion || (fusion.finalEmotion || 'neutral');
    const finalConfidence = (fusion.final_confidence ?? fusion.finalConfidence ?? 0.0);

    // Final emotion box (create if not exists)
    let emotionHeader = document.getElementById('emotionHeader');
    if (!emotionHeader) {
        // create small header area inside resultsSection if missing
        const resultsCard = document.querySelector('#resultsSection .card__body');
        if (resultsCard) {
            const header = document.createElement('div');
            header.id = 'emotionHeader';
            header.style.marginBottom = '12px';
            resultsCard.prepend(header);
            emotionHeader = document.getElementById('emotionHeader');
        }
    }

    if (emotionHeader) {
        emotionHeader.innerHTML = `
            <h3>Final Emotion: <span style="display:inline-block;padding:6px 10px;background:#1e90ff;color:#fff;border-radius:6px">${(finalEmotion || '').toUpperCase()}</span></h3>
            <div style="margin-top:8px">
                Confidence: <strong>${Math.round(finalConfidence * 100)}%</strong>
                <div style="background:#eee;height:12px;border-radius:6px;overflow:hidden;margin-top:6px">
                    <div style="height:12px;width:${Math.round(finalConfidence * 100)}%;background:linear-gradient(90deg,#2b8aef,#60c3ff)"></div>
                </div>
            </div>
        `;
    }

    // Individual analysis container
    const emotionResults = document.getElementById('emotionResults');
    if (!emotionResults) return;
    emotionResults.innerHTML = '';

    // Helper to push an item
    function pushItem(name, info, visible) {
        if (!visible) return;
        const percentage = info && info.confidence ? Math.round(info.confidence * 100) : 0;
        const emoji = getEmotionEmoji(info && info.emotion ? info.emotion : name.toLowerCase());
        const item = document.createElement('div');
        item.className = 'emotion-item';
        item.style.marginBottom = '10px';
        item.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="font-size:20px">${emoji}</div>
                    <div><strong>${capitalizeFirst(name)}</strong></div>
                </div>
                <div style="text-align:right">
                    <div><strong>${percentage}%</strong></div>
                </div>
            </div>
            <div style="background:#f0f0f0;height:8px;border-radius:6px;margin-top:6px;overflow:hidden">
                <div style="height:8px;width:${percentage}%;background:#ffa500;"></div>
            </div>
        `;
        emotionResults.appendChild(item);
    }

    // Show only those modalities that were provided by user (or present in fusion)
    const textInfo = fusion.text || fusion.text_result || fusion.textResult || null;
    const faceInfo = fusion.face || fusion.face_result || fusion.faceResult || null;
    const audioInfo = fusion.audio || fusion.audio_result || fusion.audioResult || null;

    // If server returned modalities but user didn't provide them, we still show only those provided (as requested)
    pushItem('text', textInfo, provided.textProvided && !!textInfo);
    pushItem('face', faceInfo, provided.imageProvided && !!faceInfo);
    pushItem('audio', audioInfo, provided.audioProvided && !!audioInfo);

    // If none of the per-modality items were shown (e.g., only finalEmotion available), show text if present in fusion else final only
    const shown = emotionResults.querySelectorAll('.emotion-item').length;
    if (!shown) {
        // show the final only as fallback
        const fallback = { emotion: finalEmotion, confidence: finalConfidence };
        pushItem('final', fallback, true);
    }
}

// ---------------- Recommendations UI ----------------
function displayMovieRecommendations(movies) {
    const movieGrid = document.getElementById('movieGrid');
    if (!movieGrid) return;
    movieGrid.innerHTML = '';

    movies.forEach(movie => {
        // Some backend objects may have thumbnail, title, genre, rating fields; adjust safely
        const thumb = movie.thumbnail || movie.poster || movie.image || 'https://via.placeholder.com/300x450?text=No+Image';
        const title = movie.title || movie.name || 'Untitled';
        const genre = movie.genre || movie.genres || (movie.genre_names ? movie.genre_names.join(', ') : '');
        const rating = (movie.rating || movie.vote_average || '').toString();
        const year = movie.year || movie.release_year || '';

        const movieCard = document.createElement('div');
        movieCard.className = 'movie-card';
        movieCard.style.cursor = 'pointer';
        movieCard.innerHTML = `
            <div class="movie-thumbnail"><img src="${thumb}" alt="${title}" loading="lazy" style="width:100%;height:auto;border-radius:8px"></div>
            <div class="movie-info">
                <h3 class="movie-title">${title}</h3>
                <div class="movie-meta">
                    <span class="movie-genre">${genre}</span>
                    <span class="movie-rating">⭐ ${rating}</span>
                </div>
                <button class="watch-btn" type="button">🎬 Watch Now</button>
            </div>
        `;
        movieCard.querySelector('.watch-btn').addEventListener('click', () => {
            // open modal with details
            openMovieModalWithData({ id: movie.id || 0, title, genre, rating, year, thumbnail: thumb, description: movie.description || '' });
        });
        movieGrid.appendChild(movieCard);
    });
}

// slightly different modal opener that uses passed data
function openMovieModalWithData(movie) {
    const movieModal = document.getElementById('movieModal');
    const movieTitle = document.getElementById('movieTitle');
    const movieGenre = document.getElementById('movieGenre');
    const movieRating = document.getElementById('movieRating');
    const movieYear = document.getElementById('movieYear');

    if (movieTitle) movieTitle.textContent = movie.title || '';
    if (movieGenre) movieGenre.textContent = movie.genre || '';
    if (movieRating) movieRating.textContent = movie.rating || '';
    if (movieYear) movieYear.textContent = movie.year || '';

    if (movieModal) {
        movieModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    }
}

// original openMovieModal kept for compatibility (looks up sampleMovies)
function openMovieModal(movieId) {
    const movie = sampleMovies.find(m => m.id === movieId);
    if (!movie) return;
    openMovieModalWithData(movie);
}

function closeMovieModal() {
    const movieModal = document.getElementById('movieModal');
    if (movieModal) {
        movieModal.classList.add('hidden');
        document.body.style.overflow = 'auto';
    }
}

// ---------------- Utilities ----------------
function getEmotionEmoji(emotion) {
    const emojis = { happy: '😊', sad: '😢', angry: '😠', fear: '😨', neutral: '😐', surprise: '😲', romantic: '💕' };
    return emojis[emotion] || '😐';
}
function capitalizeFirst(str) { if (!str) return ''; return str.charAt(0).toUpperCase() + str.slice(1); }

// Reset form
function resetForm() {
    const textInput = document.getElementById('textInput');
    const imageInput = document.getElementById('imageInput');
    const audioInput = document.getElementById('audioInput');
    const imagePreview = document.getElementById('imagePreview');
    const audioPreview = document.getElementById('audioPreview');

    if (textInput) textInput.value = '';
    if (imageInput) imageInput.value = '';
    if (audioInput) audioInput.value = '';
    if (imagePreview) { imagePreview.innerHTML = ''; imagePreview.classList.remove('active'); }
    if (audioPreview) { audioPreview.innerHTML = ''; audioPreview.classList.remove('active'); }

    hideAllSections();
}

function addResetButton() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    if (!analyzeBtn) return;
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reset Form';
    resetBtn.className = 'btn btn--outline btn--full-width';
    resetBtn.style.marginTop = '12px';
    resetBtn.type = 'button';
    resetBtn.addEventListener('click', resetForm);
    analyzeBtn.parentNode.appendChild(resetBtn);
}

// expose for template if used inline
window.openMovieModal = openMovieModal;

console.log('🎭 Updated Emotion Analysis & Movie Recommendation JavaScript loaded!');
