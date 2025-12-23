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
    dia: 23,
    hora: 20,
    minuto: 30,
    segundo: 0,

    redirectPara: new URL("./phases/index.html", window.location.href).toString(),

    // ===== MÚSICA (antes dos 60s finais) =====
    musicaSrc: "./sounds/intro.mp3",
    musicaVolume: 0.9,
    musicaComecarEm: 0,
    blockMusicUnderMs: 60000,
    fadeStopMs: 1200,

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

    // ✅ HORA "REAL" (CORS OK) — GitHub Pages
    timeApi: "https://worldtimeapi.org/api/timezone/America/Sao_Paulo",
    resyncEveryMs: 30_000,

    // ===== HEART VISUAL SYNC (detecção de batida via Analyser) =====
    beatThreshold: 26,     // sensibilidade (20~40). Menor = mais sensível
    beatCooldownMs: 120,   // mínimo entre pulsos (ms)
    beatPulseMs: 140       // duração do pulso visual (ms)
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

      /* pulso sincronizado com o heartbeat */
      .hb-pulse{
        animation: hbPulse .14s ease-out both;
      }
      @keyframes hbPulse{
        0%   { transform: scale(1); filter: brightness(1); }
        45%  { transform: scale(1.035); filter: brightness(1.35); }
        100% { transform: scale(1); filter: brightness(1); }
      }

      /* reforço de flash rápido (opcional) */
      #flash.hb-flash{
        opacity: 1 !important;
        transition: opacity .14s ease-out !important;
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
    // state: "ok" | "bad" | "warn"
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

  // Alvo em Brasília (UTC-3 fixo)
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
  // 4) VISUAL
  // =========================================================
  function dropFX(durationMs = 1200) {
    const flash = el("flash");
    if (!flash) return;
    flash.classList.add("on");
    setTimeout(() => flash.classList.remove("on"), durationMs);
  }

  function pulseBarBeat() {
    const fill = el("loadingFill");
    if (!fill) return;
    fill.classList.remove("beat");
    void fill.offsetWidth;
    fill.classList.add("beat");
  }

  // Pulso sincronizado (usado pelo detector de batida)
  function heartbeatVisualPulse() {
    // 1) “pump” no container do countdown ou body
    const target = document.body; // pode trocar pra el("wrapper") se tiver
    target.classList.remove("hb-pulse");
    void target.offsetWidth;
    target.classList.add("hb-pulse");

    // 2) micro flash (opcional) usando #flash se existir
    const flash = el("flash");
    if (flash) {
      flash.classList.add("hb-flash");
      setTimeout(() => flash.classList.remove("hb-flash"), CONFIG.beatPulseMs);
    }
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
  // 6) ÁUDIO (intro + heartbeat + loading) + DETECTOR DE BATIDA
  // =========================================================
  const introMusic = new Audio(CONFIG.musicaSrc);
  introMusic.preload = "auto";
  introMusic.volume = CONFIG.musicaVolume;

  const heart = new Audio(CONFIG.heartSrc);
  heart.preload = "auto";
  heart.loop = true;
  heart.volume = CONFIG.heartVolume;
  heart.playbackRate = CONFIG.heartMinRate;

  const loadingMusic = new Audio(CONFIG.loadingSrc);
  loadingMusic.preload = "auto";
  loadingMusic.loop = true;
  loadingMusic.volume = CONFIG.loadingVolume;

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

  function safePlayIntro() {
    if (!isMusicAllowedNow()) return;
    try {
      introMusic.currentTime = CONFIG.musicaComecarEm || 0;
      introMusic.volume = CONFIG.musicaVolume;
      safePlay(introMusic);
    } catch {}
  }

  function stopIntroNow() {
    stop(introMusic);
    try { introMusic.volume = CONFIG.musicaVolume; } catch {}
  }

  function fadeOutStopIntro(ms = 1200) {
    try {
      if (introMusic.paused) return;
      const startVol = introMusic.volume;
      const steps = 30;
      let i = 0;

      const t = setInterval(() => {
        i++;
        const k = 1 - i / steps;
        const eased = k * k;
        introMusic.volume = Math.max(0, startVol * eased);

        if (i >= steps) {
          clearInterval(t);
          stopIntroNow();
        }
      }, ms / steps);
    } catch {}
  }

  function stopAllAudio() {
    stopIntroNow();
    stop(heart);
    stop(loadingMusic);
    try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
    stopHeartbeatDetector();
  }

  // ---- Detector real (Analyser) para sincronizar visual com o MP3 ----
  let audioCtx = null;
  let heartSrcNode = null;
  let analyser = null;
  let analyserData = null;
  let analyserRAF = 0;
  let lastBeatAt = 0;

  function ensureHeartbeatAnalyser() {
    if (analyser) return;

    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    // MediaElementSource só pode ser criado uma vez por elemento
    if (!heartSrcNode) heartSrcNode = audioCtx.createMediaElementSource(heart);

    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 2048;
    analyserData = new Uint8Array(analyser.fftSize);

    // rota: heart -> analyser -> destination
    heartSrcNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  }

  function startHeartbeatDetector() {
    try {
      ensureHeartbeatAnalyser();
      if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
    } catch {
      return; // se falhar, só não sincroniza visual (áudio continua)
    }

    cancelAnimationFrame(analyserRAF);
    lastBeatAt = 0;

    const loop = () => {
      if (!analyser) return;

      analyser.getByteTimeDomainData(analyserData);

      // mede pico (desvio máximo do centro 128)
      let peak = 0;
      for (let i = 0; i < analyserData.length; i++) {
        const v = Math.abs(analyserData[i] - 128);
        if (v > peak) peak = v;
      }

      const now = performance.now();
      if (peak >= CONFIG.beatThreshold && now - lastBeatAt >= CONFIG.beatCooldownMs) {
        lastBeatAt = now;
        heartbeatVisualPulse();
        // também dá um “tap” na barra (fica lindo)
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
      // libera autoplay por gesto do usuário
      try {
        safePlay(introMusic);
        introMusic.pause();
        introMusic.currentTime = 0;
      } catch {}

      // também libera/resume AudioContext p/ analyser
      try {
        audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
        if (audioCtx.state === "suspended") audioCtx.resume();
      } catch {}

      safePlayIntro();
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

    // entrou no loading: para intro + coração (e detector), toca loading.mp3
    stopIntroNow();
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

    dropFX(2200);

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

    document.documentElement.classList.toggle("glitching", diffMs <= 3000 && diffMs > 0);

    const final60 = diffMs <= 60000 && diffMs > 0;
    document.documentElement.classList.toggle("final-phase", final60);

    // entra nos 60s finais
    if (final60 && !tension60) {
      tension60 = true;

      fadeOutStopIntro(CONFIG.fadeStopMs);

      try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
      safePlay(heart);
      startHeartbeatDetector();

      dropFX(900);
      const flash = el("flash");
      if (flash) {
        flash.classList.add("on");
        setTimeout(() => flash.classList.remove("on"), 110);
      }
    }

    // sai dos 60s finais
    if (!final60 && tension60) {
      tension60 = false;
      stop(heart);
      stopHeartbeatDetector();
      try { heart.playbackRate = CONFIG.heartMinRate; } catch {}
    }

    // aceleração do coração nos últimos 20s
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

    // 🔒 sync inicial
    try {
      setTimeBadge("warn", "SINCRONIZANDO…");
      const r = await syncNetTime();
      setTimeBadge("ok", `HORA ONLINE ✓  RTT ${Math.round(r.rtt)}ms`);
    } catch (e) {
      console.warn("[TIME] Falhou sync (sem internet). Usando relógio local.", e);
      netOffsetMs = 0;
      setTimeBadge("bad", "HORA LOCAL (fallback)");
    }

    // re-sync periódico + atualização do badge
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

    safePlayIntro(); // só toca após gesto; gate cuida disso
    update();
    interval = setInterval(update, 250);

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) update();
    });

    window.__COUNTDOWN__ = { CONFIG, liberarEmUtcMs, netOffsetMs };
  })();
})();
