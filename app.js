// ==========================================
// MiMúsica - Reproductor PWA Offline
// ==========================================

const DB_NAME = 'MiMusicaDB';
const DB_VERSION = 1;
const STORE_NAME = 'tracks';

let db = null;
let tracks = [];
let currentTrackIndex = -1;
let isPlaying = false;
let isShuffle = false;
let repeatMode = 0; // 0: off, 1: all, 2: one

// DOM Elements
const audioPlayer = document.getElementById('audioPlayer');
const fileInput = document.getElementById('fileInput');
const addMusicBtn = document.getElementById('addMusicBtn');
const libraryScreen = document.getElementById('libraryScreen');
const playerScreen = document.getElementById('playerScreen');
const trackList = document.getElementById('trackList');
const emptyState = document.getElementById('emptyState');
const miniPlayer = document.getElementById('miniPlayer');

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

    renderTrackList();
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

            // Try to get title from filename
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
// UI Rendering
// ==========================================

function renderTrackList() {
    trackList.innerHTML = '';

    if (tracks.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');

    tracks.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'track-item' + (index === currentTrackIndex ? ' playing' : '');
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

        item.addEventListener('click', () => playTrack(index));
        trackList.appendChild(item);
    });
}

function updateStorageInfo() {
    const totalSize = tracks.reduce((sum, track) => sum + (track.size || 0), 0);
    const maxSize = 500 * 1024 * 1024; // 500MB estimate
    const percentage = Math.min((totalSize / maxSize) * 100, 100);

    storageUsed.style.width = `${percentage}%`;
    storageText.textContent = `${formatSize(totalSize)} usados`;
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

    currentTrackIndex = index;
    const track = tracks[index];

    // Create blob URL from stored data
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

    // Update artwork
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

    // Update media session
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

    // If more than 3 seconds in, restart current track
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
// Progress & Time
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
    const volume = e.target.value / 100;
    audioPlayer.volume = volume;
    volumeBar.style.setProperty('--volume', `${e.target.value}%`);
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

    renderTrackList();
    updateStorageInfo();
}

// ==========================================
// Event Listeners
// ==========================================

addMusicBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

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
        await initDB();
        tracks = await getAllTracks();
        renderTrackList();
        updateStorageInfo();
    } catch (error) {
        console.error('Error inicializando:', error);
    }
}

init();