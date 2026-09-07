const playlistSidebar = document.getElementById('playlistSidebar');
const lyricsContainer = document.getElementById('lyricsContainer');
const audioPlayer = document.getElementById('audioPlayer');
const statusInfo = document.getElementById('statusInfo');

const npThumb = document.getElementById('npThumb');
const npTitle = document.getElementById('npTitle');
const npArtist = document.getElementById('npArtist');
const stageArea = document.getElementById('stageArea');
const fullscreenToggle = document.getElementById('fullscreenToggle');

const playPauseBtn = document.getElementById('playPauseBtn');
const playIcon = document.getElementById('playIcon');
const pauseIcon = document.getElementById('pauseIcon');
const progressBar = document.getElementById('progressBar');
const progressFilled = document.getElementById('progressFilled');
const currentTimeEl = document.getElementById('currentTime');
const durationTimeEl = document.getElementById('durationTime');

const albumsView = document.getElementById('albumsView');
const albumsGrid = document.getElementById('albumsGrid');
const showAlbumsBtn = document.getElementById('showAlbumsBtn');

let currentAlbum = [];
let currentTrackIndex = 0;
let currentLyrics = [];
let globalAlbumsData = [];

async function init() {
    try {
        const response = await fetch('albuns.json');
        if (!response.ok) throw new Error('Não foi possível carregar o albuns.json');
        
        const albumsData = await response.json();

        globalAlbumsData = albumsData.map(album => ({
            albumTitle: album.albumTitle,
            cover: album.cover,
            songs: album.songs.map(name => ({
                title: name,
                // Adicionado o nome do álbum na rota e ajustado "Musicas" com M maiúsculo conforme o Windows
                audio: `Musicas/${album.albumTitle}/${name}/${name}.mp3`,
                lrc: `Musicas/${album.albumTitle}/${name}/${name}.lrc`,
                image: `Musicas/${album.albumTitle}/${name}/${name}.jpg` 
            }))
        }));

        renderAlbumsGrid(globalAlbumsData);
        
        if (globalAlbumsData.length > 0 && globalAlbumsData[0].songs.length > 0) {
            currentAlbum = globalAlbumsData[0].songs;
            renderPlaylist();
        }

        statusInfo.textContent = `${globalAlbumsData.length} álbuns carregados!`;

    } catch (err) {
        console.error(err);
        statusInfo.textContent = 'Erro: Verifique se o albuns.json está acessível.';
    }
}

function renderAlbumsGrid(albums) {
    albumsGrid.innerHTML = '';
    albums.forEach(album => {
        const card = document.createElement('div');
        card.className = 'album-card';
        card.innerHTML = `
            <img src="${album.cover}" alt="${album.albumTitle}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'100\' height=\'100\' fill=\'%23333\'><rect width=\'100\' height=\'100\'/></svg>'">
            <h3>${album.albumTitle}</h3>
            <p>${album.songs.length} músicas</p>
        `;

        card.addEventListener('click', () => {
            currentAlbum = album.songs;
            currentTrackIndex = 0;
            renderPlaylist();
            albumsView.style.display = 'none';
            // Removido o playTrack(0) daqui para o usuário escolher o que quer ouvir
        });

        albumsGrid.appendChild(card);
    });
}

function renderPlaylist() {
    playlistSidebar.innerHTML = '';
    currentAlbum.forEach((song, index) => {
        const item = document.createElement('div');
        item.className = 'track-item';
        
        // Removemos a verificação 'index === currentTrackIndex' no carregamento 
        // para que nenhuma música fique com o destaque visual 'active' antes do clique do usuário.

        item.innerHTML = `
            <img class="track-thumb" src="${song.image}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'44\' height=\'44\' fill=\'%23333\'><rect width=\'44\' height=\'44\'/></svg>'" alt="Capa">
            <div class="track-meta">
                <h4>${song.title}</h4>
                <p>Karaokê</p>
            </div>
        `;

        item.addEventListener('click', () => {
            document.querySelectorAll('.track-item').forEach(el => el.classList.remove('active'));
            item.classList.add('active');
            playTrack(index);
        });

        playlistSidebar.appendChild(item);
    });
}

async function playTrack(index) {
    if (index < 0 || index >= currentAlbum.length) return;
    currentTrackIndex = index;
    const song = currentAlbum[currentTrackIndex];

    audioPlayer.src = song.audio;
    audioPlayer.play().catch(() => {});

    npTitle.textContent = song.title;
    npArtist.textContent = "Karaokê Local";
    npThumb.src = song.image;
    
    // Aplica o gradiente escuro por cima da capa individual da música atual
    stageArea.style.backgroundImage = `linear-gradient(180deg, rgba(20,10,35,0.7) 0%, rgba(18,18,18,0.95) 100%), url("${song.image}")`;
    stageArea.style.backgroundSize = 'cover';
    stageArea.style.backgroundPosition = 'center';

    // Restante da função...
    const items = playlistSidebar.querySelectorAll('.track-item');
    items.forEach((el, idx) => {
        if (idx === currentTrackIndex) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });

    try {
        const res = await fetch(song.lrc);
        if (res.ok) {
            const text = await res.text();
            currentLyrics = parseLRC(text);
            renderLyrics();
        } else {
            throw new Error();
        }
    } catch {
        currentLyrics = [];
        lyricsContainer.innerHTML = `<div class="empty-state"><h2>${song.title}</h2><p>Arquivo .lrc não encontrado na pasta desta música.</p></div>`;
    }
}

audioPlayer.addEventListener('ended', () => {
    if (currentTrackIndex + 1 < currentAlbum.length) {
        playTrack(currentTrackIndex + 1);
    } else {
        audioPlayer.pause();
    }
});

function parseLRC(lrcText) {
    const lines = lrcText.split('\n');
    const parsed = [];
    
    const lineTimeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    const wordReg = /<(\d{2}):(\d{2})\.(\d{2,3})>([^<]+)/g;

    lines.forEach(line => {
        const lineMatch = lineTimeReg.exec(line);
        if (lineMatch) {
            const min = parseInt(lineMatch[1], 10);
            const sec = parseInt(lineMatch[2], 10);
            const ms = parseInt(lineMatch[3].padEnd(3, '0'), 10);
            const lineTime = min * 60 + sec + ms / 1000;

            const words = [];
            let match;
            
            wordReg.lastIndex = 0;
            while ((match = wordReg.exec(line)) !== null) {
                const wMin = parseInt(match[1], 10);
                const wSec = parseInt(match[2], 10);
                const wMs = parseInt(match[3].padEnd(3, '0'), 10);
                const wordTime = wMin * 60 + wSec + wMs / 1000;
                words.push({ time: wordTime, text: match[4] });
            }

            if (words.length === 0) {
                const cleanText = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
                if (cleanText) {
                    words.push({ time: lineTime, text: cleanText });
                }
            }

            if (words.length > 0) {
                parsed.push({ time: lineTime, words });
            }
        }
    });
    return parsed.sort((a, b) => a.time - b.time);
}

function renderLyrics() {
    lyricsContainer.innerHTML = '';
    currentLyrics.forEach((lineItem) => {
        const div = document.createElement('div');
        div.className = 'lyric-line';
        
        lineItem.words.forEach(wordItem => {
            const span = document.createElement('span');
            span.className = 'lyric-word';
            span.textContent = wordItem.text;
            span.dataset.time = wordItem.time;
            
            span.addEventListener('click', (e) => {
                e.stopPropagation();
                audioPlayer.currentTime = wordItem.time;
                audioPlayer.play().catch(() => {});
            });

            div.appendChild(span);
        });

        div.addEventListener('click', () => {
            audioPlayer.currentTime = lineItem.time;
            audioPlayer.play().catch(() => {});
        });

        lyricsContainer.appendChild(div);
    });
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
}

playPauseBtn.addEventListener('click', () => {
    if (audioPlayer.paused) {
        audioPlayer.play().catch(() => {});
    } else {
        audioPlayer.pause();
    }
});

audioPlayer.addEventListener('play', () => {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
});

audioPlayer.addEventListener('pause', () => {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
});

audioPlayer.addEventListener('timeupdate', () => {
    if (audioPlayer.duration) {
        const progressPercent = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        progressFilled.style.width = `${progressPercent}%`;
        currentTimeEl.textContent = formatTime(audioPlayer.currentTime);
    }

    if (currentLyrics.length === 0) return;
    const currentTime = audioPlayer.currentTime;
    let activeLineIndex = -1;

    for (let i = 0; i < currentLyrics.length; i++) {
        if (currentLyrics[i].time <= currentTime) {
            activeLineIndex = i;
        } else {
            break;
        }
    }

    const lineElements = lyricsContainer.querySelectorAll('.lyric-line');
    lineElements.forEach((lineEl, lineIdx) => {
        const wordSpans = lineEl.querySelectorAll('.lyric-word');
        
        if (lineIdx === activeLineIndex) {
            if (!lineEl.classList.contains('active')) {
                lineEl.classList.add('active');
                lineEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }

            wordSpans.forEach(span => {
                const wordTime = parseFloat(span.dataset.time);
                if (wordTime <= currentTime) {
                    span.classList.add('active');
                } else {
                    span.classList.remove('active');
                }
            });
        } else {
            lineEl.classList.remove('active');
            wordSpans.forEach(span => span.classList.remove('active'));
        }
    });
});

audioPlayer.addEventListener('loadedmetadata', () => {
    durationTimeEl.textContent = formatTime(audioPlayer.duration);
});

progressBar.addEventListener('click', (e) => {
    const rect = progressBar.getBoundingClientRect();
    const clickPosition = (e.clientX - rect.left) / rect.width;
    if (!isNaN(audioPlayer.duration)) {
        audioPlayer.currentTime = clickPosition * audioPlayer.duration;
    }
});

showAlbumsBtn.addEventListener('click', () => {
    albumsView.style.display = 'block';
});

fullscreenToggle.addEventListener('click', () => {
    document.body.classList.toggle('fullscreen-mode');
    if (document.body.classList.contains('fullscreen-mode')) {
        fullscreenToggle.textContent = '❌ Sair da Tela Cheia';
        fullscreenToggle.classList.add('active-mode');
        if (audioPlayer.paused) {
            audioPlayer.play().catch(() => {});
        }
    } else {
        fullscreenToggle.textContent = '🔲 Tela Cheia';
        fullscreenToggle.classList.remove('active-mode');
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && document.body.classList.contains('fullscreen-mode')) {
        e.preventDefault();
        if (audioPlayer.paused) {
            audioPlayer.play();
        } else {
            audioPlayer.pause();
        }
    }
    
    if (e.key === 'Escape' && document.body.classList.contains('fullscreen-mode')) {
        document.body.classList.remove('fullscreen-mode');
        fullscreenToggle.textContent = '🔲 Tela Cheia';
        fullscreenToggle.classList.remove('active-mode');
    }
});

// Controle da gaveta de músicas no celular
const togglePlaylistBtn = document.getElementById('togglePlaylistBtn');
if (togglePlaylistBtn) {
    togglePlaylistBtn.addEventListener('click', () => {
        playlistSidebar.classList.toggle('mobile-open');
    });
}

// Fecha a gaveta automaticamente ao selecionar uma música no celular
playlistSidebar.addEventListener('click', (e) => {
    if (e.target.closest('.track-item') && window.innerWidth <= 768) {
        playlistSidebar.classList.remove('mobile-open');
    }
});

// Botão de fechar no modo tela cheia
const closeFullscreenBtn = document.getElementById('closeFullscreenBtn');
if (closeFullscreenBtn) {
    closeFullscreenBtn.addEventListener('click', () => {
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }
        document.body.classList.remove('fullscreen-mode');
        const fullscreenToggle = document.getElementById('fullscreenToggle');
        if (fullscreenToggle) {
            fullscreenToggle.classList.remove('active-mode');
            fullscreenToggle.textContent = '🔲 Tela Cheia';
        }
    });
}

init();
