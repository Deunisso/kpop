// =========================================================
// 🔒 BLOQUEIO GLOBAL DA PÁGINA (ANTI TROCAR HORA)
// Libera somente em: 24/12/2025 20:00:00 (Brasília)
// =========================================================
const PAGE_RELEASE = { y: 2025, m: 12, d: 25, hh: 20, mm: 30, ss: 0 };
const TIME_API = "https://worldtimeapi.org/api/timezone/America/Sao_Paulo";
const RESYNC_EVERY_MS = 30_000;

let netOffsetMs = 0;
let pageUnlocked = false;

function netNowMs() {
  return Date.now() + netOffsetMs;
}

// Brasília = UTC-3 -> UTC = Brasília + 3h
function releaseUtcMs() {
  return Date.UTC(
    PAGE_RELEASE.y,
    PAGE_RELEASE.m - 1,
    PAGE_RELEASE.d,
    PAGE_RELEASE.hh + 3,
    PAGE_RELEASE.mm,
    PAGE_RELEASE.ss
  );
}

function isPageUnlocked() {
  return netNowMs() >= releaseUtcMs();
}

function releaseText() {
  const dd = String(PAGE_RELEASE.d).padStart(2, "0");
  const mm = String(PAGE_RELEASE.m).padStart(2, "0");
  const hh = String(PAGE_RELEASE.hh).padStart(2, "0");
  const mi = String(PAGE_RELEASE.mm).padStart(2, "0");
  return `${dd}/${mm}/${PAGE_RELEASE.y} ${hh}:${mi} (Brasília)`;
}

function createPageLock() {
  if (document.getElementById("page-lock")) return;

  const lock = document.createElement("div");
  lock.id = "page-lock";
  lock.innerHTML = `
    <div class="lock-inner">
      <div class="lock-text">EM BREVE</div>
      <div class="lock-sub">LIBERA EM ${releaseText()}</div>
    </div>
  `;
  document.body.appendChild(lock);
}

function removePageLock() {
  const lock = document.getElementById("page-lock");
  if (lock) lock.remove();
}

// trava áudio (garantia extra)
function hardStopAudio() {
  const audios = document.querySelectorAll("audio");
  audios.forEach(a => {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
  });
}

async function syncPageTime() {
  try {
    const t0 = Date.now();
    const r = await fetch(TIME_API, { cache: "no-store" });
    const t1 = Date.now();

    if (!r.ok) throw new Error("TIME API FAIL");
    const data = await r.json();

    const serverMs = Number(data.unixtime) * 1000;
    if (!Number.isFinite(serverMs)) throw new Error("TIME API inválida");

    const rtt = t1 - t0;
    netOffsetMs = serverMs - (t0 + rtt / 2);
  } catch {
    netOffsetMs = 0; // fallback local
  }

  if (isPageUnlocked()) {
    pageUnlocked = true;
    removePageLock();
  } else {
    pageUnlocked = false;
    createPageLock();
    hardStopAudio();
  }
}

// sincroniza assim que possível
document.addEventListener("DOMContentLoaded", () => {
  syncPageTime();
  setInterval(syncPageTime, RESYNC_EVERY_MS);
});

// =========================================================
// ✅ PLAYER (seu código normal) - só roda se liberado
// =========================================================
function ensureUnlockedOrReturn() {
  if (pageUnlocked) return true;
  createPageLock();
  hardStopAudio();
  return false;
}

// Seleciona todas as tags ou elementos necessários
const wrapper = document.querySelector(".wrapper"),
  musicImage = wrapper.querySelector(".img-area img"),
  musicName = wrapper.querySelector(".song-details .name"),
  musicArtist = wrapper.querySelector(".song-details .artist"),
  mainAudio = wrapper.querySelector("#main-audio"),
  playPauseButton = wrapper.querySelector(".play-pause"),
  previousButton = wrapper.querySelector("#prev"),
  nextButton = wrapper.querySelector("#next"),
  progressArea = wrapper.querySelector(".progress-area"),
  progressBar = wrapper.querySelector(".progress-bar"),
  musicList = wrapper.querySelector(".music-list"),
  showMoreButton = wrapper.querySelector("#more-music"),
  hideMusicButton = musicList.querySelector("#close");

// ========================
// ORDENAR MÚSICAS (A → Z)
// ========================
allMusic.sort((a, b) => {
  return a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
});

// Carrega música aleatória na atualização da página
let musicIndex = Math.floor((Math.random() * allMusic.length) + 1);

window.addEventListener("load", () => {
  loadMusic(musicIndex);
  playingNow();
});

// ========================
// LYRICS via TXT (fetch)
// ========================
const lyricsContent = document.getElementById("lyrics-content");
const lyricsStatus = document.getElementById("lyrics-status");

// cache para não baixar de novo toda vez
const lyricsCache = new Map();

async function loadLyricsBySrc(songSrc) {
  if (!lyricsContent) return;

  lyricsStatus.textContent = "Carregando...";
  lyricsContent.innerHTML = `<p class="lyrics-empty">Carregando letra...</p>`;

  if (lyricsCache.has(songSrc)) {
    const cached = lyricsCache.get(songSrc);
    lyricsStatus.textContent = "";
    lyricsContent.innerHTML = `<p>${cached}</p>`;
    lyricsContent.scrollTop = 0;
    return;
  }

  const url = `lyrics/${encodeURIComponent(songSrc)}.txt`;

  try {
    const res = await fetch(url, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const text = (await res.text()).trim();

    if (!text) {
      lyricsStatus.textContent = "Vazio";
      lyricsContent.innerHTML = `<p class="lyrics-empty">Letra vazia nesse arquivo.</p>`;
      return;
    }

    lyricsCache.set(songSrc, text);
    lyricsStatus.textContent = "";
    lyricsContent.innerHTML = `<p>${text}</p>`;
    lyricsContent.scrollTop = 0;
  } catch (err) {
    lyricsStatus.textContent = "Não encontrada";
    lyricsContent.innerHTML = `<p class="lyrics-empty">Sem letra para essa música (crie: ${url})</p>`;
  }
}

// Função que realiza o carregamento da Música
function loadMusic(indexNumb) {
  const song = allMusic[indexNumb - 1];

  musicName.innerText = song.name;
  musicArtist.innerText = song.artist;
  musicImage.src = `img/${song.img}.jpg`;
  mainAudio.src = `music/${song.src}.mp3`;

  loadLyricsBySrc(song.src);
}

// Função Play
function playMusic() {
  if (!ensureUnlockedOrReturn()) return;
  wrapper.classList.add("paused");
  playPauseButton.innerHTML = "<i class='bx bx-pause'></i>";
  mainAudio.play().catch(() => {});
}

// Função Pause
function pauseMusic() {
  wrapper.classList.remove("paused");
  playPauseButton.innerHTML = "<i class='bx bx-play'></i>";
  mainAudio.pause();
}

// Função Previous
function previousMusic() {
  if (!ensureUnlockedOrReturn()) return;
  musicIndex--;
  musicIndex < 1 ? (musicIndex = allMusic.length) : (musicIndex = musicIndex);
  loadMusic(musicIndex);
  playMusic();
  playingNow();
}

// Função Next
function nextMusic() {
  if (!ensureUnlockedOrReturn()) return;
  musicIndex++;
  musicIndex > allMusic.length ? (musicIndex = 1) : (musicIndex = musicIndex);
  loadMusic(musicIndex);
  playMusic();
  playingNow();
}

// Botão Play
playPauseButton.addEventListener("click", () => {
  if (!ensureUnlockedOrReturn()) return;
  const isMusicPause = wrapper.classList.contains("paused");
  isMusicPause ? pauseMusic() : playMusic();
  playingNow();
});

// Botão Previous
previousButton.addEventListener("click", () => {
  if (!ensureUnlockedOrReturn()) return;
  previousMusic();
});

// Botão Next
nextButton.addEventListener("click", () => {
  if (!ensureUnlockedOrReturn()) return;
  nextMusic();
});

// Atualiza a barra de progresso conforme a música rola
mainAudio.addEventListener("timeupdate", (e) => {
  const currentTime = e.target.currentTime;
  const duration = e.target.duration || 0;

  let progressWidth = duration ? (currentTime / duration) * 100 : 0;
  progressBar.style.width = `${progressWidth}%`;

  let musicCurrentTime = wrapper.querySelector(".current"),
    musicDuration = wrapper.querySelector(".duration");

  mainAudio.addEventListener("loadeddata", () => {
    let audioDuration = mainAudio.duration || 0;
    let totalMinutes = Math.floor(audioDuration / 60);
    let totalSeconds = Math.floor(audioDuration % 60);
    if (totalSeconds < 10) totalSeconds = `0${totalSeconds}`;
    musicDuration.innerText = `${totalMinutes}:${totalSeconds}`;
  });

  let currentMinutes = Math.floor(currentTime / 60);
  let currentSeconds = Math.floor(currentTime % 60);
  if (currentSeconds < 10) currentSeconds = `0${currentSeconds}`;
  musicCurrentTime.innerText = `${currentMinutes}:${currentSeconds}`;
});

// click na barrinha
progressArea.addEventListener("click", (e) => {
  if (!ensureUnlockedOrReturn()) return;
  let progressWidthval = progressArea.clientWidth;
  let clickedOffSetX = e.offsetX;
  let songDuration = mainAudio.duration || 0;

  mainAudio.currentTime = songDuration ? (clickedOffSetX / progressWidthval) * songDuration : 0;
  playMusic();
});

// Botão de Repetir e Aleatório
const repeatButton = wrapper.querySelector("#repeat-plist");
repeatButton.addEventListener("click", () => {
  let getText = repeatButton.innerText;

  switch (getText) {
    case "repeat":
      repeatButton.innerText = "repeat_one";
      repeatButton.setAttribute("title", "Song Looped");
      break;
    case "repeat_one":
      repeatButton.innerText = "shuffle";
      repeatButton.setAttribute("title", "Playback Shuffle");
      break;
    case "shuffle":
      repeatButton.innerText = "repeat";
      repeatButton.setAttribute("title", "Playlist Loop");
      break;
  }
});

// fim da música
mainAudio.addEventListener("ended", () => {
  if (!ensureUnlockedOrReturn()) return;

  let getText = repeatButton.innerText;

  switch (getText) {
    case "repeat":
      nextMusic();
      break;
    case "repeat_one":
      mainAudio.currentTime = 0;
      loadMusic(musicIndex);
      playMusic();
      break;
    case "shuffle":
      let randIndex = Math.floor((Math.random() * allMusic.length) + 1);
      do {
        randIndex = Math.floor((Math.random() * allMusic.length) + 1);
      } while (musicIndex == randIndex);
      musicIndex = randIndex;
      loadMusic(musicIndex);
      playMusic();
      playingNow();
      break;
  }
});

// Exibir e Fechar Playlist
showMoreButton.addEventListener("click", () => {
  musicList.classList.toggle("show");
});

hideMusicButton.addEventListener("click", () => {
  showMoreButton.click();
});

const ulTag = wrapper.querySelector("ul");

// Cria <li> da lista
for (let i = 0; i < allMusic.length; i++) {
  let liTag = `<li li-index="${i + 1}">
    <div class="row">
      <span class="track-number">${i + 1}.</span>
      <div class="track-info">
        <span class="track-title">${allMusic[i].name}</span>
        <p class="track-artist">${allMusic[i].artist}</p>
      </div>
    </div>
    <audio class="${allMusic[i].src}" src="music/${allMusic[i].src}.mp3"></audio>
    <span id="${allMusic[i].src}" class="audio-duration">3:40</span>
  </li>`;

  ulTag.insertAdjacentHTML("beforeend", liTag);

  let liAudioDuration = ulTag.querySelector(`#${allMusic[i].src}`);
  let liAudioTag = ulTag.querySelector(`.${allMusic[i].src}`);

  liAudioTag.addEventListener("loadeddata", () => {
    let audioDuration = liAudioTag.duration || 0;
    let totalMinutes = Math.floor(audioDuration / 60);
    let totalSeconds = Math.floor(audioDuration % 60);
    if (totalSeconds < 10) totalSeconds = `0${totalSeconds}`;

    liAudioDuration.innerText = `${totalMinutes}:${totalSeconds}`;
    liAudioDuration.setAttribute("t-duration", `${totalMinutes}:${totalSeconds}`);
  });
}

// Trocando música específica
const allLiTags = ulTag.querySelectorAll("li");
function playingNow() {
  for (let j = 0; j < allLiTags.length; j++) {
    let audioTag = allLiTags[j].querySelector(".audio-duration");

    if (allLiTags[j].classList.contains("playing")) {
      allLiTags[j].classList.remove("playing");
      let adDuration = audioTag.getAttribute("t-duration");
      audioTag.innerText = adDuration;
    }

    if (allLiTags[j].getAttribute("li-index") == musicIndex) {
      allLiTags[j].classList.add("playing");
      audioTag.innerText = "Tocando";
    }

    allLiTags[j].setAttribute("onclick", "clicked(this)");
  }
}

// Tocando música na tag li
function clicked(element) {
  if (!ensureUnlockedOrReturn()) return;
  let getLiIndex = element.getAttribute("li-index");
  musicIndex = getLiIndex;
  loadMusic(musicIndex);
  playMusic();
  playingNow();
}

// Dark Mode
const darkMode = document.querySelector(".dark-mode"),
  body = document.querySelector(".page");

if (darkMode && body) {
  darkMode.onclick = () => {
    body.classList.toggle("is-dark");
  };
}
