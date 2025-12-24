(() => {
  // =========================================================
  // 1) CONFIG + ESTADO PRINCIPAL
  // =========================================================
  let allowPreload = false;
  const wait = (ms) => new Promise((res) => setTimeout(res, ms));

  const CONFIG = {
    nomeProjeto: "PREPARANDO O DROP",
    ano: 2025,
    mes: 12,
    dia: 25,
    hora: 10,
    minuto: 0,
    segundo: 0,

    redirectPara: new URL("./phases/index.html", window.location.href).toString(),

    // ===== PLAYLIST (PHASE 1) =====
    musicFolder: "./phase1/music/",
    musicList: [
      "Black.mp3",
      "Blue.mp3",
      "Gauntlet.mp3",
      "Green.mp3",
      "Orange.mp3",
      "Purple.mp3",
      "Red.mp3",
      "Yellow.mp3",
    ],
    musicaVolume: 0.9,
    blockMusicUnderMs: 60000,   // NUNCA tocar música se <= 60s
    fadeStopMs: 1200,           // fade out ao entrar nos 60s finais

    // ✅ Crossfade entre músicas
    crossfadeMs: 1800,          // duração do crossfade entre tracks
    gapBetweenTracksMs: 0,      // se quiser silêncio entre músicas

    // ✅ Lembrar última música
    rememberKey: "__DROP_LAST_TRACK_INDEX__",

    // ===== CORAÇÃO (nos 60s finais) =====
    heartSrc: "./sounds/heartbeat.mp3",
    heartVolume: 0.9,
    heartMinRate: 1.0,
    heartMaxRate: 1.6,
    heartRampStartSec: 20,

    // ===== LOADING (durante preload) =====
    loadingSrc: "./sounds/loading.mp3",
    loadingVolume: 0.75,

    // ===== PRELOAD =====
    perFileDelayMs: 300,
    assets: window.ASSETS_MANIFEST || [],

    // ✅ HORA "REAL"
    timeApi: "https://worldtimeapi.org/api/timezone/America/Sao_Paulo",
    resyncEveryMs: 30_000,

    // ===== HEART VISUAL SYNC (detecção de batida via Analyser) =====
    beatThreshold: 26,
    beatCooldownMs: 120,
    beatPulseMs: 140
  };

  const el = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, "0");

  let done = false;
  let interval = null;

  let seenPositive = false;
  let releasing = false;
  let tension60 = false;

  function setText(id, v) {
    const n = el(id);
    if (n) n.textContent = v;
  }

  setText("loadingTitle", CONFIG.nomeProjeto);

  // =========================================================
  // 2) CSS + INDICADOR DE SYNC (internet vs fallback)
  // =========================================================
  function injectStylesOnce() {
    if (document.getElementById("__dropStyles")) return;
    const s = document.createElement("style");
    s.id = "__dropStyles";
    s.textContent = `
      .time-badge{
        position:fixed; z-index:99999;
        top:14px; right:14px;
        padding:8px 10px; border-radius:999px;
        font:600 12px/1.0 system-ui, -apple-system, Segoe UI, Roboto, Arial;
        letter-spacing:.2px;
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border:1px solid rgba(255,255,255,.16);
        background: rgba(0,0,0,.35);
        color:#fff;
        display:flex; align-items:center; gap:8px;
        user-select:none;
      }
      .time-dot{
        width:10px; height:10px; border-radius:50%;
        box-shadow: 0 0 0 0 rgba(0,0,0,0);
      }
      .time-dot.ok{ background:#32d74b; box-shadow: 0 0 18px rgba(50,215,75,.65); }
      .time-dot.bad{ background:#ff453a; box-shadow: 0 0 18px rgba(255,69,58,.55); }
      .time-dot.warn{ background:#ffd60a; box-shadow: 0 0 18px rgba(255,214,10,.55); }

      /* pulso sincronizado com o heartbeat (SEM FLASH) */
      .hb-pulse{
        animation: hbPulse .14s ease-out both;
      }
      @keyframes hbPulse{
        0%   { transform: scale(1); filter: brightness(1); }
        45%  { transform: scale(1.03); filter: brightness(1.18); }
        100% { transform: scale(1); filter: brightness(1); }
      }
    `;
    document.head.appendChild(s);
  }

  function ensureTimeBadge() {
    injectStylesOnce();

    let badge = document.getElementById("__timeBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "__timeBadge";
      badge.className = "time-badge";
      badge.innerHTML = `<span class="time-dot warn" id="__timeDot"></span><span id="__timeText">SINCRONIZANDO…</span>`;
      document.body.appendChild(badge);
    }
    return badge;
  }

  function setTimeBadge(state, text) {
    const badge = ensureTimeBadge();
    const dot = badge.querySelector("#__timeDot");
    const t = badge.querySelector("#__timeText");
    if (dot) {
      dot.classList.remove("ok", "bad", "warn");
      dot.classList.add(state);
    }
    if (t) t.textContent = text;
  }

  // =========================================================
  // 3) HORA "REAL" (ANTI TROCAR HORA DO CELULAR)
  // =========================================================
  let netOffsetMs = 0;

  function netNowMs() {
    return Date.now() + netOffsetMs;
  }

  const BRASILIA_OFFSET_MIN = -180;
  const liberarEmUtcMs =
    Date.UTC(CONFIG.ano, CONFIG.mes - 1, CONFIG.dia, CONFIG.hora, CONFIG.minuto, CONFIG.segundo) -
    BRASILIA_OFFSET_MIN * 60_000;

  function remainingMs() {
    return liberarEmUtcMs - netNowMs();
  }

  async function syncNetTime() {
    const t0 = Date.now();
    const r = await fetch(CONFIG.timeApi, { cache: "no-store" });
    const t1 = Date.now();

    if (!r.ok) throw new Error("Falha WorldTimeAPI");

    const data = await r.json();
    const serverMs = Number(data.unixtime) * 1000;
    if (!Number.isFinite(serverMs)) throw new Error("WorldTimeAPI inválida");

    const rtt = t1 - t0;
    const estimatedLocalAtServer = t0 + rtt / 2;

    netOffsetMs = serverMs - estimatedLocalAtServer;
    return { ok: true, rtt };
  }

  // =========================================================
  // 4) VISUAL (SEM FLASH)
  // =========================================================
  function pulseBarBeat() {
    const fill = el("loadingFill");
    if (!fill) return;
    fill.classList.remove("beat");
    void fill.offsetWidth;
    fill.classList.add("beat");
  }

  function heartbeatVisualPulse() {
    const target = document.body;
    target.classList.remove("hb-pulse");
    void target.offsetWidth;
    target.classList.add("hb-pulse");
  }

  // =========================================================
  // 5) PRELOAD
  // =========================================================
  function isImage(url) {
    return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);
  }
  function isAudio(url) {
    return /\.(mp3|wav|ogg|m4a)$/i.test(url);
  }

  async function preloadOne(url) {
    if (!allowPreload) return;

    if (isImage(url)) {
      await new Promise((res, rej) => {
        const img = new Image();
        img.onload = () => res(true);
        img.onerror = () => rej(new Error("img fail " + url));
        img.src = url;
      });
      return;
    }

    if (isAudio(url)) {
      await new Promise((res, rej) => {
        const a = new Audio();
        a.preload = "auto";
        a.oncanplaythrough = () => res(true);
        a.onerror = () => rej(new Error("audio fail " + url));
        a.src = url;
        a.load();
      });
      return;
    }

    const r = await fetch(url);
    if (!r.ok) throw new Error("fetch fail " + url);
    await r.arrayBuffer();
  }

  async function preloadAssets(onProgress) {
    const list = Array.isArray(CONFIG.assets) ? CONFIG.assets : [];
    const total = Math.max(1, list.length);
    let doneCount = 0;

    for (const url of list) {
      let ok = true;
      try {
        await preloadOne(url);
      } catch (e) {
        ok = false;
        console.warn(e);
      }

      doneCount++;
      if (typeof onProgress === "function") onProgress({ done: doneCount, total, url, ok });

      if (CONFIG.perFileDelayMs > 0) await wait(CONFIG.perFileDelayMs);
    }
  }

  // =========================================================
  // 6) ÁUDIO (playlist crossfade + heartbeat + loading) + DETECTOR
  // =========================================================
  function safePlay(a) {
    try {
      const p = a.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  function stop(a) {
    try {
      a.pause();
      a.currentTime = 0;
    } catch {}
  }

  function isMusicAllowedNow() {
    return remainingMs() > CONFIG.blockMusicUnderMs;
  }

  // --- PLAYLIST COM CROSSFADE (A/B) + lembrar última faixa ---
  let lastIndex = -1;
  try {
    const saved = localStorage.getItem(CONFIG.rememberKey);
    if (saved !== null && saved !== "") {
      const n = Number(saved);
      if (Number.isFinite(n)) lastIndex = n;
    }
  } catch {}

  const musicA = new Audio();
  const musicB = new Audio();
  musicA.preload = "auto";
  musicB.preload = "auto";
  musicA.volume = 0;
  musicB.volume = 0;

  let activeMusic = musicA;
  let inactiveMusic = musicB;
  let isCrossfading = false;

  function persistLastIndex() {
    try {
      localStorage.setItem(CONFIG.rememberKey, String(lastIndex));
    } catch {}
  }

  function pickNextIndex() {
    const n = CONFIG.musicList.length;
    if (!n) return -1;

    let idx;
    do {
      idx = Math.floor(Math.random() * n);
    } while (idx === lastIndex && n > 1);

    lastIndex = idx;
    persistLastIndex();
    return idx;
  }

  function getTrackSrcByIndex(idx) {
    const name = CONFIG.musicList[idx];
    if (!name) return "";
    return CONFIG.musicFolder + name;
  }

  function stopPlaylistHard() {
    isCrossfading = false;
    try { activeMusic.onended = null; } catch {}
    try { inactiveMusic.onended = null; } catch {}
    stop(activeMusic);
    stop(inactiveMusic);
    try { activeMusic.volume = 0; } catch {}
    try { inactiveMusic.volume = 0; } catch {}
  }

  function fadeOutStopPlaylist(ms = 1200) {
    if (isCrossfading) return;

    const a = activeMusic;
    if (!a || a.paused) {
      stopPlaylistHard();
      return;
    }

    const startVol = a.volume;
    const steps = 30;
    let i = 0;

    const t = setInterval(() => {
      i++;
      const k = 1 - i / steps;
      const eased = k * k;

      try { a.volume = Math.max(0, startVol * eased); } catch {}

      if (i >= steps) {
        clearInterval(t);
        stopPlaylistHard();
      }
    }, ms / steps);
  }

  function playFirstTrackIfNeeded() {
    if (!isMusicAllowedNow()) return;

    // se já está tocando, não faz nada
    if (activeMusic && !activeMusic.paused) return;

    const idx = pickNextIndex();
    if (idx < 0) return;

    const src = getTrackSrcByIndex(idx);
    if (!src) return;

    activeMusic.src = src;
    try { activeMusic.currentTime = 0; } catch {}
    try { activeMusic.volume = CONFIG.musicaVolume; } catch {}
    safePlay(activeMusic);

    activeMusic.onended = async () => {
      if (!isMusicAllowedNow()) return;
      if (CONFIG.gapBetweenTracksMs > 0) await wait(CONFIG.gapBetweenTracksMs);
      crossfadeToNext();
    };
  }

  function crossfadeToNext() {
    if (!isMusicAllowedNow()) return;
    if (isCrossfading) return;

    const idx = pickNextIndex();
    if (idx < 0) return;

    const src = getTrackSrcByIndex(idx);
    if (!src) return;

    isCrossfading = true;

    // prepara a faixa nova no player inativo
    inactiveMusic.src = src;
    try { inactiveMusic.currentTime = 0; } catch {}
    try { inactiveMusic.volume = 0; } catch {}

    // começa a tocar a nova
    safePlay(inactiveMusic);

    const fadeMs = Math.max(200, CONFIG.crossfadeMs | 0);
    const steps = 40;
    let i = 0;

    const startActiveVol = (() => {
      try { return activeMusic.volume; } catch { return CONFIG.musicaVolume; }
    })();

    const tick = setInterval(() => {
      i++;
      const t = i / steps;              // 0..1
      const eased = t * t;              // ease-in
      const inv = 1 - eased;

      // antiga desce, nova sobe
      try { activeMusic.volume = Math.max(0, startActiveVol * inv); } catch {}
      try { inactiveMusic.volume = Math.min(CONFIG.musicaVolume, CONFIG.musicaVolume * eased); } catch {}

      if (i >= steps) {
        clearInterval(tick);

        // garante volumes finais
        try { activeMusic.volume = 0; } catch {}
        try { inactiveMusic.volume = CONFIG.musicaVolume; } catch {}

        // para antiga
        stop(activeMusic);

        // troca ponteiros
        const oldActive = activeMusic;
        activeMusic = inactiveMusic;
        inactiveMusic = oldActive;

        // programa o próximo ao terminar
        activeMusic.onended = async () => {
          if (!isMusicAllowedNow()) return;
          if (CONFIG.gapBetweenTracksMs > 0) await wait(CONFIG.gapBetweenTracksMs);
          crossfadeToNext();
        };

        isCrossfading = false;
      }
    }, fadeMs / steps);
  }

  // ===== HEARTBEAT =====
  const heart = new Audio(CONFIG.heartSrc);
  heart.preload = "auto";
  heart.loop = true;
  heart.volume = CONFIG.heartVolume;
  heart.playbackRate = CONFIG.heartMinRate;

  // ===== LOADING =====
  const loadingMusic = new Audio(CONFIG.loadingSrc);
  loadingMusic.preload = "auto";
  loadingMusic.loop = true;
  loadingMusic.volume = CONFIG.loadingVolume;

  // ---- Detector real (Analyser) para sincronizar visual com o MP3 do HEART ----
  let audioCtx = null;
  let heartSrcNode = null;
  let analyser = null;
  let analyserData = null;
  let analyserRAF = 0;
  let lastBeatAt = 0;

  function ensureHeartbeatAnalyser() {
    if (analyser) return;

    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (!heartSrcNode) heartSrcNode = audioCtx.createMediaElementSource(heart);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyserData = new Uint8Array(analyser.fftSize);

    heartSrcNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function startHeartbeatDetector() {
    try {
      ensureHeartbeatAnalyser();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch {
      return;
    }

    cancelAnimationFrame(analyserRAF);
    lastBeatAt = 0;

    const loop = () => {
      if (!analyser) return;

      analyser.getByteTimeDomainData(analyserData);

      let peak = 0;
      for (let i = 0; i < analyserData.length; i++) {
        const v = Math.abs(analyserData[i] - 128);
        if (v > peak) peak = v;
      }

      const now = performance.now();
      if (peak >= CONFIG.beatThreshold && now - lastBeatAt >= CONFIG.beatCooldownMs) {
        lastBeatAt = now;
        heartbeatVisualPulse();
        pulseBarBeat();
      }

      analyserRAF = requestAnimationFrame(loop);
    };

    analyserRAF = requestAnimationFrame(loop);
  }

  function stopHeartbeatDetector() {
    cancelAnimationFrame(analyserRAF);
    analyserRAF = 0;
    lastBeatAt = 0;
  }

  function stopAllAudio() {
    fadeOutStopPlaylist(200);
    stop(heart);
    stop(loadingMusic);
    try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
    stopHeartbeatDetector();
  }

  // =========================================================
  // 7) AUDIO GATE (botão OK)
  // =========================================================
  function setupAudioGate() {
    const audioGate = el("audioGate");
    const audioOk = el("audioOk");
    if (!audioGate || !audioOk) return;

    function hideGate() {
      audioGate.classList.add("hide");
      setTimeout(() => (audioGate.style.display = "none"), 360);
    }

    function enableAudioFromGate() {
      // desbloqueia autoplay no mobile
      try {
        // “aquecimento” rápido
        safePlay(activeMusic); activeMusic.pause(); activeMusic.currentTime = 0;
        safePlay(inactiveMusic); inactiveMusic.pause(); inactiveMusic.currentTime = 0;
      } catch {}

      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
      } catch {}

      // inicia playlist se permitido (antes dos 60s)
      playFirstTrackIfNeeded();

      hideGate();
    }

    audioOk.addEventListener("click", enableAudioFromGate);
    audioOk.addEventListener("touchend", (e) => {
      e.preventDefault();
      enableAudioFromGate();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && audioGate.style.display !== "none") enableAudioFromGate();
    });
  }

  // =========================================================
  // 8) RELEASES
  // =========================================================
  function releaseFastNoLoading() {
    stopAllAudio();
    document.body.classList.add("page-exit");
    setTimeout(() => window.location.replace(CONFIG.redirectPara), 450);
  }

  async function releaseWithLoading() {
    if (releasing) return;
    releasing = true;

    done = true;
    if (interval) clearInterval(interval);

    // para playlist imediatamente (sem crossfade)
    stopPlaylistHard();

    stop(heart);
    try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
    stopHeartbeatDetector();

    safePlay(loadingMusic);

    allowPreload = true;

    document.documentElement.classList.remove("final-phase", "glitching");

    const loading = el("loading");
    const fill = el("loadingFill");
    const pct = el("loadingPct");
    const sub = el("loadingSub");

    if (loading) loading.classList.add("on");
    if (fill) fill.style.width = "0%";
    if (pct) pct.textContent = "0";

    const fileLine = (u) => {
      if (!u) return "";
      const clean = String(u).split("?")[0];
      const parts = clean.split("/");
      return parts.slice(-2).join("/");
    };

    await preloadAssets((p) => {
      const ratio = p.total ? p.done / p.total : 1;

      if (fill) fill.style.width = (ratio * 100).toFixed(1) + "%";
      if (pct) pct.textContent = String(Math.floor(ratio * 100));

      const status = p.ok ? "Carregando" : "Pulando";
      if (sub) sub.textContent = `${status}: ${fileLine(p.url)} (${p.done}/${p.total})`;

      pulseBarBeat();
    });

    stop(loadingMusic);

    if (fill) fill.style.width = "100%";
    if (pct) pct.textContent = "100";
    if (sub) sub.textContent = "Abrindo…";

    document.body.classList.add("page-exit");
    setTimeout(() => {
      stopAllAudio();
      window.location.replace(CONFIG.redirectPara);
    }, 650);
  }

  // =========================================================
  // 9) LOOP PRINCIPAL
  // =========================================================
  function update() {
    if (done) return;

    const diffMs = remainingMs();
    if (diffMs > 0) seenPositive = true;

    if (diffMs <= 0) {
      done = true;
      if (interval) clearInterval(interval);

      stopAllAudio();
      if (!seenPositive) releaseFastNoLoading();
      else releaseWithLoading();
      return;
    }

    // mantém suas "tremidas" (glitching) do CSS
    document.documentElement.classList.toggle("glitching", diffMs <= 3000 && diffMs > 0);

    const final60 = diffMs <= 60000 && diffMs > 0;
    document.documentElement.classList.toggle("final-phase", final60);

    // >>> entra nos 60s finais: para playlist + entra heartbeat
    if (final60 && !tension60) {
      tension60 = true;

      fadeOutStopPlaylist(CONFIG.fadeStopMs);

      try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
      safePlay(heart);
      startHeartbeatDetector();
    }

    // >>> sai dos 60s finais (se acontecer por sync): para heartbeat e volta playlist
    if (!final60 && tension60) {
      tension60 = false;
      stop(heart);
      stopHeartbeatDetector();
      try { heart.playbackRate = CONFIG.heartMinRate; } catch {}

      playFirstTrackIfNeeded();
    }

    // ramp do heartbeat nos últimos segundos
    if (final60) {
      const secLeft = Math.floor(diffMs / 1000);

      if (secLeft <= CONFIG.heartRampStartSec) {
        const progress = 1 - secLeft / CONFIG.heartRampStartSec;
        const rate =
          CONFIG.heartMinRate +
          (CONFIG.heartMaxRate - CONFIG.heartMinRate) * progress;

        try { heart.playbackRate = Math.min(CONFIG.heartMaxRate, rate); } catch {}
      } else {
        try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
      }
    } else {
      // se ainda pode tocar música, garante que a playlist rode
      if (isMusicAllowedNow()) playFirstTrackIfNeeded();
      else fadeOutStopPlaylist(250); // segurança: se ficar <=60s, corta música
    }

    const total = Math.floor(diffMs / 1000);
    const dias = Math.floor(total / 86400);
    const horas = Math.floor((total % 86400) / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;

    setText("dias", pad2(dias));
    setText("horas", pad2(horas));
    setText("minutos", pad2(minutos));
    setText("segundos", pad2(segundos));
  }

  // =========================================================
  // 10) INIT
  // =========================================================
  (async () => {
    setupAudioGate();
    ensureTimeBadge();

    try {
      setTimeBadge("warn", "SINCRONIZANDO…");
      const r = await syncNetTime();
      setTimeBadge("ok", `HORA ONLINE ✓  RTT ${Math.round(r.rtt)}ms`);
    } catch (e) {
      console.warn("[TIME] Falhou sync (sem internet). Usando relógio local.", e);
      netOffsetMs = 0;
      setTimeBadge("bad", "HORA LOCAL (fallback)");
    }

    if (CONFIG.resyncEveryMs > 0) {
      setInterval(async () => {
        try {
          const r = await syncNetTime();
          setTimeBadge("ok", `HORA ONLINE ✓  RTT ${Math.round(r.rtt)}ms`);
        } catch {
          netOffsetMs = 0;
          setTimeBadge("bad", "HORA LOCAL (fallback)");
        }
      }, CONFIG.resyncEveryMs);
    }

    // começa playlist (se permitido) — se o mobile bloquear, o gate resolve
    playFirstTrackIfNeeded();

    update();
    interval = setInterval(update, 250);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) update();
    });

    window.__COUNTDOWN__ = { CONFIG, liberarEmUtcMs, netOffsetMs };
  })();
})();
