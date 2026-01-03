// ==========================================
// MiMúsica v5 - iOS Background Audio Fix
// ==========================================
// IMPORTANTE: En iOS, Web Audio API se suspende en background.
// Esta versión usa el audio element directamente para reproducción
// y Web Audio solo como "bypass" opcional para EQ en primer plano.

const DB_NAME = 'MiMusicaDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let db = null;
let tracks = [];
let filteredTracks = [];
let currentTrackIndex = -1;

// Estados - SIEMPRE derivados del audio element
let isShuffle = false;
let repeatMode = 0; // 0: off, 1: all, 2: one

// Web Audio (opcional, solo para EQ visual)
let audioContext = null;
let analyser = null;
let eqEnabled = false;

// Configuración de audio
let audioSettings = {
    preset: 'bass-boost',
    volume: 100,
    boost: 110,
    bass: 6,
    lowMid: 3,
    mid: 0,
    highMid: 1,
    treble: 2
};

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

let currentBlobUrl = null;

// ==========================================
// DOM Elements
// ==========================================

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
// Helper: Obtener estado real del audio
// ==========================================

function isActuallyPlaying() {
    return !audioPlayer.paused && !audioPlayer.ended && audioPlayer.readyState > 2;
}

// ==========================================
// Audio Setup para iOS
// ==========================================

function setupAudioPlayer() {
    // Atributos críticos para iOS
    audioPlayer.setAttribute('playsinline', '');
    audioPlayer.setAttribute('webkit-playsinline', '');
    audioPlayer.preload = 'metadata';
    
    // Volumen inicial
    audioPlayer.volume = audioSettings.volume / 100;
}

// ==========================================
// Media Session API - Control desde lockscreen
// ==========================================

function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;
    
    navigator.mediaSession.setActionHandler('play', () => {
        audioPlayer.play().catch(e => console.log('Play error:', e));
    });
    
    navigator.mediaSession.setActionHandler('pause', () => {
        audioPlayer.pause();
    });
    
    navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrev();
    });
    
    navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
    });
    
    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined && audioPlayer.duration) {
            audioPlayer.currentTime = details.seekTime;
        }
    });
    
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        const skipTime = details.seekOffset || 10;
        audioPlayer.currentTime = Math.max(audioPlayer.currentTime - skipTime, 0);
    });
    
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
        const skipTime = details.seekOffset || 10;
        audioPlayer.currentTime = Math.min(audioPlayer.currentTime + skipTime, audioPlayer.duration || 0);
    });
}

function updateMediaSessionMetadata(track) {
    if (!('mediaSession' in navigator)) return;
    
    navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist,
        album: 'MiMúsica',
        artwork: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
    });
}

function updateMediaSessionPlaybackState() {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = isActuallyPlaying() ? 'playing' : 'paused';
}

function updateMediaSessionPosition() {
    if (!('mediaSession' in navigator)) return;
    if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;
    
    try {
        navigator.mediaSession.setPositionState({
            duration: audioPlayer.duration,
            playbackRate: audioPlayer.playbackRate,
            position: audioPlayer.currentTime
        });
    } catch (e) {
        // Ignorar
    }
}

// ==========================================
// Ecualizador - Solo UI (sin Web Audio)
// Nota: Web Audio API no funciona en background en iOS
// El EQ es solo visual/referencia, el boost se aplica al volumen
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
    
    // Aplicar boost como volumen extra
    applyVolume();
    
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
}

function applyVolume() {
    // Combinar volumen base con boost
    // boost 100 = normal, 150 = +50%
    const effectiveVolume = (audioSettings.volume / 100) * (audioSettings.boost / 100);
    // Limitar a máximo 1.0 para evitar distorsión
    audioPlayer.volume = Math.min(effectiveVolume, 1.0);
}

function updateEqUI() {
    if (!boostSlider) return;
    
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
    try {
        localStorage.setItem('mimusica-audio-v5', JSON.stringify(audioSettings));
    } catch (e) {
        console.log('Error guardando settings');
    }
}

function loadAudioSettings() {
    try {
        const saved = localStorage.getItem('mimusica-audio-v5');
        if (saved) {
            audioSettings = { ...audioSettings, ...JSON.parse(saved) };
        }
    } catch (e) {
        console.log('Error cargando settings');
    }
}

// ==========================================
// IndexedDB
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

async function deleteTrackFromDB(id) {
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
    for (const file of Array.from(files)) {
        if (!file.type.startsWith('audio/')) continue;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const metadata = await extractMetadata(file);
            
            const trackData = {
                id: generateId(),
                name: metadata.title || file.name.replace(/\.[^/.]+$/, ''),
                artist: metadata.artist || 'Artista desconocido',
                duration: metadata.duration || 0,
                artwork: null,
                data: arrayBuffer,
                mimeType: file.type,
                size: file.size,
                addedAt: Date.now()
            };
            
            await saveTrack(trackData);
            tracks.push(trackData);
        } catch (error) {
            console.error('Error procesando archivo:', error);
        }
    }
    
    filterTracks();
    updateStorageInfo();
}

function extractMetadata(file) {
    return new Promise((resolve) => {
        const audio = new Audio();
        const url = URL.createObjectURL(file);
        
        const timeout = setTimeout(() => {
            URL.revokeObjectURL(url);
            resolve({ duration: 0, title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Artista desconocido' });
        }, 3000);
        
        audio.onloadedmetadata = () => {
            clearTimeout(timeout);
            
            const name = file.name.replace(/\.[^/.]+$/, '');
            let title = name;
            let artist = 'Artista desconocido';
            
            const parts = name.split(' - ');
            if (parts.length >= 2) {
                artist = parts[0].trim();
                title = parts.slice(1).join(' - ').trim();
            }
            
            URL.revokeObjectURL(url);
            resolve({ duration: audio.duration, title, artist });
        };
        
        audio.onerror = () => {
            clearTimeout(timeout);
            URL.revokeObjectURL(url);
            resolve({ duration: 0, title: file.name.replace(/\.[^/.]+$/, ''), artist: 'Artista desconocido' });
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
    searchInput.blur();
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
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            </div>
            <div class="track-item-info">
                <div class="track-item-title">${escapeHtml(track.name)}</div>
                <div class="track-item-artist">${escapeHtml(track.artist)}</div>
            </div>
            <div class="track-item-duration">${formatTime(track.duration)}</div>
        `;
        
        item.addEventListener('click', () => playTrack(originalIndex));
        trackList.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    
    // Limpiar URL anterior
    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }
    
    currentTrackIndex = index;
    const track = tracks[index];
    
    // Crear blob URL
    const blob = new Blob([track.data], { type: track.mimeType });
    currentBlobUrl = URL.createObjectURL(blob);
    
    // Configurar audio element
    audioPlayer.src = currentBlobUrl;
    
    // Aplicar volumen con boost
    applyVolume();
    
    // Actualizar UI
    updatePlayerUI(track);
    updateMediaSessionMetadata(track);
    renderTrackList();
    showMiniPlayer();
    showPlayerScreen();
    
    // Reproducir
    try {
        await audioPlayer.play();
    } catch (error) {
        console.error('Error reproduciendo:', error);
    }
}

function updatePlayerUI(track) {
    trackTitle.textContent = track.name;
    trackArtist.textContent = track.artist;
    miniTitle.textContent = track.name;
    miniArtist.textContent = track.artist;
    
    const placeholder = `
        <div class="album-art-placeholder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                <path d="M9 18V5l12-2v13"/>
                <circle cx="6" cy="18" r="3"/>
                <circle cx="18" cy="16" r="3"/>
            </svg>
        </div>
        <div class="vinyl-effect"></div>
    `;
    
    albumArt.innerHTML = placeholder;
    miniArt.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 18V5l12-2v13"/>
            <circle cx="6" cy="18" r="3"/>
            <circle cx="18" cy="16" r="3"/>
        </svg>
    `;
}

function updatePlayButtons() {
    const playing = isActuallyPlaying();
    const playIcon = '<svg class="play-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
    const pauseIcon = '<svg class="pause-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    
    playBtn.innerHTML = playing ? pauseIcon : playIcon;
    miniPlayBtn.innerHTML = playing ? pauseIcon : playIcon;
}

async function togglePlay() {
    if (currentTrackIndex === -1) {
        if (tracks.length > 0) {
            await playTrack(0);
        }
        return;
    }
    
    if (isActuallyPlaying()) {
        audioPlayer.pause();
    } else {
        try {
            await audioPlayer.play();
        } catch (e) {
            console.error('Error en play:', e);
        }
    }
}

async function playNext() {
    if (tracks.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
        do {
            nextIndex = Math.floor(Math.random() * tracks.length);
        } while (nextIndex === currentTrackIndex && tracks.length > 1);
    } else {
        nextIndex = (currentTrackIndex + 1) % tracks.length;
    }
    
    await playTrack(nextIndex);
}

async function playPrev() {
    if (tracks.length === 0) return;
    
    // Si pasaron más de 3 segundos, reiniciar la canción
    if (audioPlayer.currentTime > 3) {
        audioPlayer.currentTime = 0;
        return;
    }
    
    let prevIndex;
    if (isShuffle) {
        do {
            prevIndex = Math.floor(Math.random() * tracks.length);
        } while (prevIndex === currentTrackIndex && tracks.length > 1);
    } else {
        prevIndex = (currentTrackIndex - 1 + tracks.length) % tracks.length;
    }
    
    await playTrack(prevIndex);
}

function toggleShuffle() {
    isShuffle = !isShuffle;
    shuffleBtn.classList.toggle('active', isShuffle);
}

function toggleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    repeatBtn.classList.toggle('active', repeatMode > 0);
    
    // Remover indicador existente
    const existingIndicator = repeatBtn.querySelector('.repeat-one');
    if (existingIndicator) existingIndicator.remove();
    
    // Agregar indicador para repetir uno
    if (repeatMode === 2) {
        const indicator = document.createElement('span');
        indicator.className = 'repeat-one';
        indicator.textContent = '1';
        repeatBtn.appendChild(indicator);
    }
}

// ==========================================
// Progress & Volume
// ==========================================

function updateProgress() {
    if (!audioPlayer.duration || isNaN(audioPlayer.duration)) return;
    
    const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
    progressBar.value = progress;
    progressBar.style.setProperty('--progress', `${progress}%`);
    
    currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    durationEl.textContent = formatTime(audioPlayer.duration);
    
    miniProgress.style.width = `${progress}%`;
    
    updateMediaSessionPosition();
}

function seekTo(e) {
    if (!audioPlayer.duration) return;
    const percent = parseFloat(e.target.value);
    audioPlayer.currentTime = (percent / 100) * audioPlayer.duration;
}

function setVolume(e) {
    audioSettings.volume = parseInt(e.target.value);
    volumeBar.style.setProperty('--volume', `${audioSettings.volume}%`);
    applyVolume();
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
    if (!confirm('¿Eliminar esta canción?')) return;
    
    const track = tracks[currentTrackIndex];
    
    // Detener y limpiar
    audioPlayer.pause();
    audioPlayer.src = '';
    if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl);
        currentBlobUrl = null;
    }
    
    await deleteTrackFromDB(track.id);
    tracks.splice(currentTrackIndex, 1);
    
    if (tracks.length === 0) {
        currentTrackIndex = -1;
        miniPlayer.classList.remove('visible');
        showLibraryScreen();
        updatePlayButtons();
    } else {
        currentTrackIndex = Math.min(currentTrackIndex, tracks.length - 1);
        await playTrack(currentTrackIndex);
    }
    
    filterTracks();
    updateStorageInfo();
}

// ==========================================
// Event Listeners
// ==========================================

// Archivo
addMusicBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
    }
    e.target.value = '';
});

// Búsqueda
searchInput.addEventListener('input', filterTracks);
searchClear.addEventListener('click', clearSearch);

// Controles del reproductor
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

// Panel EQ
eqBtn.addEventListener('click', showEqPanel);
closeEqBtn.addEventListener('click', hideEqPanel);
eqPanel.addEventListener('click', (e) => {
    if (e.target === eqPanel) hideEqPanel();
});

// Botones de preset
presetBtns.forEach(btn => {
    btn.addEventListener('click', () => applyPreset(btn.dataset.preset));
});

// Sliders EQ
boostSlider.addEventListener('input', (e) => {
    audioSettings.boost = parseInt(e.target.value);
    audioSettings.preset = 'custom';
    applyVolume();
    updateEqUI();
    updatePresetButtons();
    saveAudioSettings();
});

// Los otros sliders solo actualizan la UI (EQ visual)
[bassSlider, lowMidSlider, midSlider, highMidSlider, trebleSlider].forEach((slider, i) => {
    const props = ['bass', 'lowMid', 'mid', 'highMid', 'treble'];
    slider.addEventListener('input', (e) => {
        audioSettings[props[i]] = parseInt(e.target.value);
        audioSettings.preset = 'custom';
        updateEqUI();
        updatePresetButtons();
        saveAudioSettings();
    });
});

// ==========================================
// Audio Events - CRÍTICO para iOS
// ==========================================

audioPlayer.addEventListener('play', () => {
    updatePlayButtons();
    updateMediaSessionPlaybackState();
});

audioPlayer.addEventListener('pause', () => {
    updatePlayButtons();
    updateMediaSessionPlaybackState();
});

audioPlayer.addEventListener('ended', async () => {
    if (repeatMode === 2) {
        // Repetir una canción
        audioPlayer.currentTime = 0;
        await audioPlayer.play().catch(e => console.log(e));
    } else if (repeatMode === 1 || currentTrackIndex < tracks.length - 1) {
        // Siguiente canción
        await playNext();
    } else {
        // Fin de lista
        updatePlayButtons();
        updateMediaSessionPlaybackState();
    }
});

audioPlayer.addEventListener('timeupdate', updateProgress);

audioPlayer.addEventListener('loadedmetadata', () => {
    updateProgress();
});

audioPlayer.addEventListener('error', (e) => {
    console.error('Error de audio:', e);
    updatePlayButtons();
});

// Cuando la app vuelve al primer plano
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Sincronizar UI con estado real del audio
        updatePlayButtons();
        updateProgress();
    }
});

// ==========================================
// Service Worker
// ==========================================

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(e => console.log('SW error:', e));
}

// ==========================================
// Init
// ==========================================

async function init() {
    setupAudioPlayer();
    setupMediaSession();
    loadAudioSettings();
    
    try {
        await initDB();
        tracks = await getAllTracks();
        filteredTracks = [...tracks];
        renderTrackList();
        updateStorageInfo();
    } catch (e) {
        console.error('Error init:', e);
    }
    
    // UI inicial
    updateEqUI();
    updatePresetButtons();
    volumeBar.value = audioSettings.volume;
    volumeBar.style.setProperty('--volume', `${audioSettings.volume}%`);
    applyVolume();
}

init();
