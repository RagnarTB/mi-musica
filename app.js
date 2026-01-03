// ==========================================
// MiMúsica v3 - Con Audio Mejorado
// ==========================================

const DB_NAME = 'MiMusicaDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let db = null;
let tracks = [];
let filteredTracks = [];
let currentTrackIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0;

// Audio Context y Nodos
let audioContext = null;
let sourceNode = null;
let gainNode = null;
let bassFilter = null;
let lowMidFilter = null;
let midFilter = null;
let highMidFilter = null;
let trebleFilter = null;
let compressor = null;
let preampGain = null;

// Configuración de audio actual
let audioSettings = {
    preset: 'bass-boost',
    volume: 100,
    boost: 100,
    bass: 6,
    lowMid: 2,
    mid: 0,
    highMid: 1,
    treble: 2
};

// Presets de ecualizador
const PRESETS = {
    'normal': { bass: 0, lowMid: 0, mid: 0, highMid: 0, treble: 0, boost: 100, name: 'Normal' },
    'bass-boost': { bass: 6, lowMid: 3, mid: 0, highMid: 1, treble: 2, boost: 110, name: 'Bass Boost' },
    'bass-heavy': { bass: 10, lowMid: 5, mid: -1, highMid: 0, treble: 1, boost: 115, name: 'Bass Heavy' },
    'club': { bass: 8, lowMid: 4, mid: 2, highMid: 3, treble: 4, boost: 120, name: 'Club' },
    'parlante': { bass: 9, lowMid: 4, mid: 1, highMid: 2, treble: 3, boost: 125, name: 'Parlante' },
    'audifonos': { bass: 5, lowMid: 2, mid: 1, highMid: 2, treble: 3, boost: 105, name: 'Audífonos' },
    'rock': { bass: 5, lowMid: 2, mid: -1, highMid: 3, treble: 4, boost: 110, name: 'Rock' },
    'electronica': { bass: 7, lowMid: 4, mid: 0, highMid: 2, treble: 5, boost: 115, name: 'Electrónica' },
    'custom': { bass: 6, lowMid: 2, mid: 0, highMid: 1, treble: 2, boost: 100, name: 'Personalizado' }
};

// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const fileInput = document.getElementById('fileInput');
const addMusicBtn = document.getElementById('addMusicBtn');
const libraryScreen = document.getElementById('libraryScreen');
const playerScreen = document.getElementById('playerScreen');
const trackList = document.getElementById('trackList');
const emptyState = document.getElementById('emptyState');
const miniPlayer = document.getElementById('miniPlayer');
const searchInput = document.getElementById('searchInput');
const searchClear = document.getElementById('searchClear');

// Player controls
const playBtn = document.getElementById('playBtn');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const repeatBtn = document.getElementById('repeatBtn');
const backBtn = document.getElementById('backBtn');
const deleteTrackBtn = document.getElementById('deleteTrackBtn');
const progressBar = document.getElementById('progressBar');
const volumeBar = document.getElementById('volumeBar');
const miniPlayBtn = document.getElementById('miniPlayBtn');
const eqBtn = document.getElementById('eqBtn');

// Audio controls
const eqPanel = document.getElementById('eqPanel');
const closeEqBtn = document.getElementById('closeEqBtn');
const presetBtns = document.querySelectorAll('.preset-btn');
const boostSlider = document.getElementById('boostSlider');
const boostValue = document.getElementById('boostValue');
const bassSlider = document.getElementById('bassSlider');
const bassValue = document.getElementById('bassValue');
const lowMidSlider = document.getElementById('lowMidSlider');
const lowMidValue = document.getElementById('lowMidValue');
const midSlider = document.getElementById('midSlider');
const midValue = document.getElementById('midValue');
const highMidSlider = document.getElementById('highMidSlider');
const highMidValue = document.getElementById('highMidValue');
const trebleSlider = document.getElementById('trebleSlider');
const trebleValue = document.getElementById('trebleValue');

// Display elements
const trackTitle = document.getElementById('trackTitle');
const trackArtist = document.getElementById('trackArtist');
const albumArt = document.getElementById('albumArt');
const currentTimeEl = document.getElementById('currentTime');
const durationEl = document.getElementById('duration');
const miniTitle = document.getElementById('miniTitle');
const miniArtist = document.getElementById('miniArtist');
const miniArt = document.getElementById('miniArt');
const miniProgress = document.getElementById('miniProgress');
const storageUsed = document.getElementById('storageUsed');
const storageText = document.getElementById('storageText');

// ==========================================
// Web Audio API Setup
// ==========================================

function initAudioContext() {
    if (audioContext) return;
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    // Crear nodos
    sourceNode = audioContext.createMediaElementSource(audioPlayer);
    
    // Preamp para boost general
    preampGain = audioContext.createGain();
    preampGain.gain.value = 1;
    
    // Filtros de ecualizador (BiquadFilter)
    // Bass: 60Hz
    bassFilter = audioContext.createBiquadFilter();
    bassFilter.type = 'lowshelf';
    bassFilter.frequency.value = 60;
    bassFilter.gain.value = audioSettings.bass;
    
    // Low-Mid: 250Hz
    lowMidFilter = audioContext.createBiquadFilter();
    lowMidFilter.type = 'peaking';
    lowMidFilter.frequency.value = 250;
    lowMidFilter.Q.value = 1;
    lowMidFilter.gain.value = audioSettings.lowMid;
    
    // Mid: 1kHz
    midFilter = audioContext.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1;
    midFilter.gain.value = audioSettings.mid;
    
    // High-Mid: 4kHz
    highMidFilter = audioContext.createBiquadFilter();
    highMidFilter.type = 'peaking';
    highMidFilter.frequency.value = 4000;
    highMidFilter.Q.value = 1;
    highMidFilter.gain.value = audioSettings.highMid;
    
    // Treble: 12kHz
    trebleFilter = audioContext.createBiquadFilter();
    trebleFilter.type = 'highshelf';
    trebleFilter.frequency.value = 12000;
    trebleFilter.gain.value = audioSettings.treble;
    
    // Compresor para evitar distorsión
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -6;
    compressor.knee.value = 30;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;
    
    // Gain final (volumen)
    gainNode = audioContext.createGain();
    gainNode.gain.value = audioSettings.volume / 100;
    
    // Conectar cadena de audio
    sourceNode
        .connect(preampGain)
        .connect(bassFilter)
        .connect(lowMidFilter)
        .connect(midFilter)
        .connect(highMidFilter)
        .connect(trebleFilter)
        .connect(compressor)
        .connect(gainNode)
        .connect(audioContext.destination);
    
    // Aplicar preset inicial
    applyPreset('bass-boost');
}

function resumeAudioContext() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume();
    }
}

// ==========================================
// Ecualizador Functions
// ==========================================

function applyPreset(presetName) {
    const preset = PRESETS[presetName];
    if (!preset) return;
    
    audioSettings.preset = presetName;
    audioSettings.bass = preset.bass;
    audioSettings.lowMid = preset.lowMid;
    audioSettings.mid = preset.mid;
    audioSettings.highMid = preset.highMid;
    audioSettings.treble = preset.treble;
    audioSettings.boost = preset.boost;
    
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
}

function updateAudioNodes() {
    if (!audioContext) return;
    
    // Aplicar valores a los filtros
    bassFilter.gain.value = audioSettings.bass;
    lowMidFilter.gain.value = audioSettings.lowMid;
    midFilter.gain.value = audioSettings.mid;
    highMidFilter.gain.value = audioSettings.highMid;
    trebleFilter.gain.value = audioSettings.treble;
    
    // Boost (preamp)
    preampGain.gain.value = audioSettings.boost / 100;
    
    // Volumen final
    gainNode.gain.value = audioSettings.volume / 100;
}

function updateEqUI() {
    // Actualizar sliders
    boostSlider.value = audioSettings.boost;
    boostValue.textContent = audioSettings.boost + '%';
    
    bassSlider.value = audioSettings.bass;
    bassValue.textContent = (audioSettings.bass >= 0 ? '+' : '') + audioSettings.bass + 'dB';
    
    lowMidSlider.value = audioSettings.lowMid;
    lowMidValue.textContent = (audioSettings.lowMid >= 0 ? '+' : '') + audioSettings.lowMid + 'dB';
    
    midSlider.value = audioSettings.mid;
    midValue.textContent = (audioSettings.mid >= 0 ? '+' : '') + audioSettings.mid + 'dB';
    
    highMidSlider.value = audioSettings.highMid;
    highMidValue.textContent = (audioSettings.highMid >= 0 ? '+' : '') + audioSettings.highMid + 'dB';
    
    trebleSlider.value = audioSettings.treble;
    trebleValue.textContent = (audioSettings.treble >= 0 ? '+' : '') + audioSettings.treble + 'dB';
}

function updatePresetButtons() {
    presetBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.preset === audioSettings.preset);
    });
}

function saveAudioSettings() {
    localStorage.setItem('mimusica-audio', JSON.stringify(audioSettings));
}

function loadAudioSettings() {
    const saved = localStorage.getItem('mimusica-audio');
    if (saved) {
        audioSettings = { ...audioSettings, ...JSON.parse(saved) };
    }
}

// ==========================================
// IndexedDB Setup
// ==========================================

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
            db = request.result;
            resolve(db);
        };
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                database.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function saveTrack(trackData) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(trackData);
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function getAllTracks() {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function deleteTrack(id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// ==========================================
// File Handling
// ==========================================

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

async function handleFiles(files) {
    for (const file of files) {
        if (!file.type.startsWith('audio/')) continue;
        
        const arrayBuffer = await file.arrayBuffer();
        const metadata = await extractMetadata(file);
        
        const trackData = {
            id: generateId(),
            name: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
            artist: metadata.artist || 'Artista desconocido',
            duration: metadata.duration || 0,
            artwork: metadata.artwork || null,
            data: arrayBuffer,
            mimeType: file.type,
            size: file.size,
            addedAt: Date.now()
        };
        
        await saveTrack(trackData);
        tracks.push(trackData);
    }
    
    filterTracks();
    updateStorageInfo();
}

async function extractMetadata(file) {
    return new Promise((resolve) => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        
        audio.onloadedmetadata = () => {
            const metadata = {
                duration: audio.duration,
                title: null,
                artist: null,
                artwork: null
            };
            
            const name = file.name.replace(/\.[^/.]+$/, '');
            const parts = name.split(' - ');
            if (parts.length >= 2) {
                metadata.artist = parts[0].trim();
                metadata.title = parts.slice(1).join(' - ').trim();
            } else {
                metadata.title = name;
            }
            
            URL.revokeObjectURL(url);
            resolve(metadata);
        };
        
        audio.onerror = () => {
            URL.revokeObjectURL(url);
            resolve({ duration: 0, title: file.name, artist: null, artwork: null });
        };
        
        audio.src = url;
    });
}

// ==========================================
// Search
// ==========================================

function filterTracks() {
    const query = searchInput.value.toLowerCase().trim();
    
    if (!query) {
        filteredTracks = [...tracks];
    } else {
        filteredTracks = tracks.filter(track => 
            track.name.toLowerCase().includes(query) ||
            track.artist.toLowerCase().includes(query)
        );
    }
    
    searchClear.style.display = query ? 'flex' : 'none';
    renderTrackList();
}

function clearSearch() {
    searchInput.value = '';
    filterTracks();
}

// ==========================================
// UI Rendering
// ==========================================

function renderTrackList() {
    trackList.innerHTML = '';
    
    if (tracks.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    
    if (filteredTracks.length === 0) {
        trackList.innerHTML = '<div class="no-results">No se encontraron canciones</div>';
        return;
    }
    
    filteredTracks.forEach((track) => {
        const originalIndex = tracks.findIndex(t => t.id === track.id);
        const item = document.createElement('div');
        item.className = 'track-item' + (originalIndex === currentTrackIndex ? ' playing' : '');
        item.innerHTML = `
            <div class="track-thumb">
                ${track.artwork 
                    ? `<img src="${track.artwork}" alt="">` 
                    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M9 18V5l12-2v13"/>
                        <circle cx="6" cy="18" r="3"/>
                        <circle cx="18" cy="16" r="3"/>
                       </svg>`
                }
            </div>
            <div class="track-item-info">
                <div class="track-item-title">${track.name}</div>
                <div class="track-item-artist">${track.artist}</div>
            </div>
            <div class="track-item-duration">${formatTime(track.duration)}</div>
        `;
        
        item.addEventListener('click', () => playTrack(originalIndex));
        trackList.appendChild(item);
    });
}

function updateStorageInfo() {
    const totalSize = tracks.reduce((sum, track) => sum + (track.size || 0), 0);
    const maxSize = 500 * 1024 * 1024;
    const percentage = Math.min((totalSize / maxSize) * 100, 100);
    
    storageUsed.style.width = `${percentage}%`;
    storageText.textContent = `${formatSize(totalSize)} • ${tracks.length} canciones`;
}

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function formatTime(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ==========================================
// Playback
// ==========================================

async function playTrack(index) {
    if (index < 0 || index >= tracks.length) return;
    
    // Inicializar audio context en primer play
    initAudioContext();
    resumeAudioContext();
    
    currentTrackIndex = index;
    const track = tracks[index];
    
    const blob = new Blob([track.data], { type: track.mimeType });
    const url = URL.createObjectURL(blob);
    
    audioPlayer.src = url;
    audioPlayer.play();
    isPlaying = true;
    
    updatePlayerUI(track);
    updatePlayButtons();
    renderTrackList();
    showMiniPlayer();
    showPlayerScreen();
}

function updatePlayerUI(track) {
    trackTitle.textContent = track.name;
    trackArtist.textContent = track.artist;
    miniTitle.textContent = track.name;
    miniArtist.textContent = track.artist;
    
    const artPlaceholder = `
        <div class="album-art-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
            </svg>
        </div>
        <div class="vinyl-effect"></div>
    `;
    
    if (track.artwork) {
        albumArt.innerHTML = `<img src="${track.artwork}" alt=""><div class="vinyl-effect"></div>`;
        miniArt.innerHTML = `<img src="${track.artwork}" alt="">`;
    } else {
        albumArt.innerHTML = artPlaceholder;
        miniArt.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
            </svg>
        `;
    }
    
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.name,
            artist: track.artist,
            artwork: track.artwork ? [{ src: track.artwork }] : []
        });
    }
}

function togglePlay() {
    if (currentTrackIndex === -1 && tracks.length > 0) {
        playTrack(0);
        return;
    }
    
    initAudioContext();
    resumeAudioContext();
    
    if (isPlaying) {
        audioPlayer.pause();
    } else {
        audioPlayer.play();
    }
    isPlaying = !isPlaying;
    updatePlayButtons();
}

function updatePlayButtons() {
    const playIcon = '<svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const pauseIcon = '<svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    
    playBtn.innerHTML = isPlaying ? pauseIcon : playIcon;
    miniPlayBtn.innerHTML = isPlaying ? pauseIcon : playIcon;
}

function playNext() {
    if (tracks.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
        nextIndex = Math.floor(Math.random() * tracks.length);
    } else {
        nextIndex = (currentTrackIndex + 1) % tracks.length;
    }
    
    playTrack(nextIndex);
}

function playPrev() {
    if (tracks.length === 0) return;
    
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }
    
    let prevIndex;
    if (isShuffle) {
        prevIndex = Math.floor(Math.random() * tracks.length);
    } else {
        prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    }
    
    playTrack(prevIndex);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('active', repeatMode > 0);
    
    if (repeatMode === 2) {
        repeatBtn.style.position = 'relative';
        if (!repeatBtn.querySelector('.repeat-one')) {
            const indicator = document.createElement('span');
            indicator.className = 'repeat-one';
            indicator.style.cssText = 'position:absolute;font-size:10px;font-weight:bold;';
            indicator.textContent = '1';
            repeatBtn.appendChild(indicator);
        }
    } else {
        const indicator = repeatBtn.querySelector('.repeat-one');
        if (indicator) indicator.remove();
    }
}

// ==========================================
// Progress & Volume
// ==========================================

function updateProgress() {
    if (!audioPlayer.duration) return;
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = progress;
    progressBar.style.setProperty('--progress', `${progress}%`);
    
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    durationEl.textContent = formatTime(audioPlayer.duration);
    
    miniProgress.style.width = `${progress}%`;
}

function seekTo(e) {
    const percent = e.target.value;
    audioPlayer.currentTime = (percent / 100) * audioPlayer.duration;
}

function setVolume(e) {
    audioSettings.volume = parseInt(e.target.value);
    volumeBar.style.setProperty('--volume', `${audioSettings.volume}%`);
    
    if (gainNode) {
        gainNode.gain.value = audioSettings.volume / 100;
    } else {
        audioPlayer.volume = audioSettings.volume / 100;
    }
    
    saveAudioSettings();
}

// ==========================================
// EQ Panel
// ==========================================

function showEqPanel() {
    eqPanel.classList.add('visible');
}

function hideEqPanel() {
    eqPanel.classList.remove('visible');
}

// ==========================================
// Navigation
// ==========================================

function showPlayerScreen() {
    libraryScreen.classList.remove('active');
    playerScreen.classList.add('active');
    miniPlayer.classList.add('hidden-for-player');
}

function showLibraryScreen() {
    playerScreen.classList.remove('active');
    libraryScreen.classList.add('active');
    miniPlayer.classList.remove('hidden-for-player');
}

function showMiniPlayer() {
    if (currentTrackIndex >= 0) {
        miniPlayer.classList.add('visible');
    }
}

async function deleteCurrentTrack() {
    if (currentTrackIndex === -1) return;
    
    if (!confirm('¿Eliminar esta canción de tu biblioteca?')) return;
    
    const track = tracks[currentTrackIndex];
    await deleteTrack(track.id);
    
    tracks.splice(currentTrackIndex, 1);
    
    audioPlayer.pause();
    audioPlayer.src = '';
    isPlaying = false;
    
    if (tracks.length === 0) {
        currentTrackIndex = -1;
        miniPlayer.classList.remove('visible');
        showLibraryScreen();
    } else {
        currentTrackIndex = Math.min(currentTrackIndex, tracks.length - 1);
        playTrack(currentTrackIndex);
    }
    
    filterTracks();
    updateStorageInfo();
}

// ==========================================
// Event Listeners
// ==========================================

// File input
addMusicBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    setTimeout(() => fileInput.click(), 100);
});

addMusicBtn.addEventListener('touchend', (e) => {
    e.preventDefault();
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
    e.target.value = '';
});

// Search
searchInput.addEventListener('input', filterTracks);
searchClear.addEventListener('click', clearSearch);

// Player controls
playBtn.addEventListener('click', togglePlay);
miniPlayBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePlay();
});
prevBtn.addEventListener('click', playPrev);
nextBtn.addEventListener('click', playNext);
shuffleBtn.addEventListener('click', toggleShuffle);
repeatBtn.addEventListener('click', toggleRepeat);
backBtn.addEventListener('click', showLibraryScreen);
deleteTrackBtn.addEventListener('click', deleteCurrentTrack);

progressBar.addEventListener('input', seekTo);
volumeBar.addEventListener('input', setVolume);

miniPlayer.addEventListener('click', showPlayerScreen);

// EQ Panel
eqBtn.addEventListener('click', showEqPanel);
closeEqBtn.addEventListener('click', hideEqPanel);

eqPanel.addEventListener('click', (e) => {
    if (e.target === eqPanel) hideEqPanel();
});

// Preset buttons
presetBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        applyPreset(btn.dataset.preset);
    });
});

// EQ Sliders
boostSlider.addEventListener('input', (e) => {
    audioSettings.boost = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

bassSlider.addEventListener('input', (e) => {
    audioSettings.bass = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

lowMidSlider.addEventListener('input', (e) => {
    audioSettings.lowMid = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

midSlider.addEventListener('input', (e) => {
    audioSettings.mid = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

highMidSlider.addEventListener('input', (e) => {
    audioSettings.highMid = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

trebleSlider.addEventListener('input', (e) => {
    audioSettings.treble = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    updateAudioNodes();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

// Audio events
audioPlayer.addEventListener('timeupdate', updateProgress);
audioPlayer.addEventListener('ended', () => {
    if (repeatMode === 2) {
        audioPlayer.currentTime = 0;
        audioPlayer.play();
    } else if (repeatMode === 1 || currentTrackIndex < tracks.length - 1) {
        playNext();
    } else {
        isPlaying = false;
        updatePlayButtons();
    }
});

audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    updatePlayButtons();
});

audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    updatePlayButtons();
});

// Media Session API
if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('play', togglePlay);
    navigator.mediaSession.setActionHandler('pause', togglePlay);
    navigator.mediaSession.setActionHandler('previoustrack', playPrev);
    navigator.mediaSession.setActionHandler('nexttrack', playNext);
}

// Initialize volume bar
volumeBar.style.setProperty('--volume', '100%');

// ==========================================
// Service Worker Registration
// ==========================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(reg => console.log('Service Worker registrado'))
        .catch(err => console.log('Error SW:', err));
}

// ==========================================
// Initialize App
// ==========================================

async function init() {
    try {
        loadAudioSettings();
        await initDB();
        tracks = await getAllTracks();
        filteredTracks = [...tracks];
        renderTrackList();
        updateStorageInfo();
        updateEqUI();
        updatePresetButtons();
        
        // Aplicar volumen guardado
        volumeBar.value = audioSettings.volume;
        volumeBar.style.setProperty('--volume', `${audioSettings.volume}%`);
    } catch (error) {
        console.error('Error inicializando:', error);
    }
}

init();
