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
    hora: 18,
    minuto: 55,
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
    heartMinRate: 1.0,     // 60s → 21s
    heartMaxRate: 1.6,     // 0s
    heartRampStartSec: 20, // começa acelerar faltando 20s

    // ===== LOADING (durante preload) =====
    loadingSrc: "./sounds/loading.mp3",
    loadingVolume: 0.75,

    // ===== PRELOAD =====
    perFileDelayMs: 300,
    assets: window.ASSETS_MANIFEST || []
  };

  const liberarEm = new Date(
    CONFIG.ano,
    CONFIG.mes - 1,
    CONFIG.dia,
    CONFIG.hora,
    CONFIG.minuto,
    CONFIG.segundo
  );

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

  function remainingMs() {
    return liberarEm - new Date();
  }

  setText("loadingTitle", CONFIG.nomeProjeto);

  // =========================================================
  // 2) VISUAL
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

  // =========================================================
  // 3) PRELOAD
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

      if (typeof onProgress === "function") {
        onProgress({ done: doneCount, total, url, ok });
      }

      if (CONFIG.perFileDelayMs > 0) {
        await wait(CONFIG.perFileDelayMs);
      }
    }
  }

  // =========================================================
  // 4) ÁUDIO (intro + heartbeat + loading)
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
    try {
      introMusic.volume = CONFIG.musicaVolume;
    } catch {}
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
    try {
      heart.playbackRate = CONFIG.heartMinRate;
    } catch {}
  }

  // =========================================================
  // 5) AUDIO GATE (botão OK)
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
  // 6) RELEASES (para áudio no loading / redirect)
  // =========================================================
  function releaseFastNoLoading() {
    stopAllAudio();

    const flash = el("flash");
    if (flash) {
      flash.classList.add("on");
      setTimeout(() => flash.classList.remove("on"), 180);
    }

    document.body.classList.add("page-exit");
    console.log("[DROP] Finalizado sem loading, redirecionando...");

    setTimeout(() => window.location.replace(CONFIG.redirectPara), 450);
  }

  async function releaseWithLoading() {
    if (releasing) return;
    releasing = true;

    done = true;
    if (interval) clearInterval(interval);

    // entrou no loading: para intro + coração, toca loading.mp3
    stopIntroNow();
    stop(heart);
    try {
      heart.playbackRate = CONFIG.heartMinRate;
    } catch {}

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

    // terminou: para loading.mp3 antes de sair
    stop(loadingMusic);

    if (fill) fill.style.width = "100%";
    if (pct) pct.textContent = "100";
    if (sub) sub.textContent = "Abrindo…";

    dropFX(2200);

    console.log("[DROP] Preload concluído, redirecionando...");

    document.body.classList.add("page-exit");
    setTimeout(() => {
      stopAllAudio();
      window.location.replace(CONFIG.redirectPara);
    }, 650);
  }

  // =========================================================
  // 7) LOOP PRINCIPAL
  // - intro toca antes dos 60s finais
  // - nos 60s finais: intro para (fade) e toca coração
  // - nos últimos 20s: coração acelera via playbackRate
  // - ao entrar no loading: coração para e loading.mp3 toca
  // =========================================================
  function update() {
    if (done) return;

    const diffMs = remainingMs();

    if (diffMs > 0) seenPositive = true;

    if (diffMs <= 0) {
      done = true;
      if (interval) clearInterval(interval);

      // garantia: ao zerar não fica som sobrando
      stopAllAudio();

      if (!seenPositive) releaseFastNoLoading();
      else releaseWithLoading();

      return;
    }

    document.documentElement.classList.toggle("glitching", diffMs <= 3000 && diffMs > 0);

    const final60 = diffMs <= 60000 && diffMs > 0;
    document.documentElement.classList.toggle("final-phase", final60);

    // entrou nos 60s finais
    if (final60 && !tension60) {
      tension60 = true;

      // para música (fade) e inicia coração
      fadeOutStopIntro(CONFIG.fadeStopMs);

      try {
        heart.playbackRate = CONFIG.heartMinRate;
      } catch {}
      safePlay(heart);

      dropFX(900);
      const flash = el("flash");
      if (flash) {
        flash.classList.add("on");
        setTimeout(() => flash.classList.remove("on"), 110);
      }
    }

    // se voltar no tempo (sai dos 60s finais)
    if (!final60 && tension60) {
      tension60 = false;
      stop(heart);
      try {
        heart.playbackRate = CONFIG.heartMinRate;
      } catch {}
      // (não força tocar intro automaticamente: depende do gate/usuário)
    }

    // aceleração do coração nos últimos 20s
    if (final60) {
      const secLeft = Math.floor(diffMs / 1000);

      if (secLeft <= CONFIG.heartRampStartSec) {
        const progress = 1 - secLeft / CONFIG.heartRampStartSec; // 0..1
        const rate =
          CONFIG.heartMinRate +
          (CONFIG.heartMaxRate - CONFIG.heartMinRate) * progress;

        try {
          heart.playbackRate = Math.min(CONFIG.heartMaxRate, rate);
        } catch {}
      } else {
        try {
          heart.playbackRate = CONFIG.heartMinRate;
        } catch {}
      }
    }

    // contador
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
  // 8) INIT
  // =========================================================
  setupAudioGate();
  safePlayIntro(); // tenta tocar (só funciona após gesto; gate cuida disso)
  update();
  interval = setInterval(update, 250);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });

  window.__COUNTDOWN__ = { CONFIG, liberarEm };
})();
