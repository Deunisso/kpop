// ===== HELPERS + DROP FX (ANTES DO IIFE) =====
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function dropFX(durationMs = 2200) {
  const flash = $("#flash");
  const beams = $$(".beam");
  const stars = $$(".starfield");

  if (flash) {
    flash.classList.add("on");
    setTimeout(() => flash.classList.remove("on"), 180);
  }

  document.body.classList.add("final-phase");

  beams.forEach((b) => {
    b.dataset.prevOpacity = b.style.opacity || "";
    b.dataset.prevFilter = b.style.filter || "";
    b.style.opacity = "1";
    b.style.filter = "blur(.05px) saturate(1.6) brightness(1.35)";
  });

  stars.forEach((s) => {
    s.dataset.prevAnim = s.style.animation || "";
    s.dataset.prevOpacity = s.style.opacity || "";
    s.style.opacity = "1";
    s.style.animation = "starPulseFast .12s ease-in-out infinite alternate";
  });

  setTimeout(() => {
    document.body.classList.remove("final-phase");
    beams.forEach((b) => {
      b.style.opacity = b.dataset.prevOpacity || "";
      b.style.filter = b.dataset.prevFilter || "";
    });
    stars.forEach((s) => {
      s.style.opacity = s.dataset.prevOpacity || "";
      s.style.animation = s.dataset.prevAnim || "";
    });
  }, durationMs);
}

(() => {
  // ===== CONFIG =====
  const CONFIG = {
    nomeProjeto: "PREPARANDO O DROP",
    ano: 2025,
    mes: 12,
    dia: 22,
    hora: 21,
    minuto: 54,
    segundo: 0,
    redirectPara: new URL("../phases/index.html", window.location.href).toString(),

    // ===== MUSICA =====
    musicaSrc: "../sounds/intro.mp3",
    musicaVolume: 0.9,
    musicaComecarEm: 0,

    // REGRA: música bloqueada se <= 60s
    blockMusicUnderMs: 60000,

    // Fade quando entrar nos 60s
    fadeStopMs: 1200,
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

  let ctx = null;
  let lastSec = null;
  let done = false;
  let interval = null;

  // ===== AUDIO (MÚSICA) =====
  const introMusic = new Audio(CONFIG.musicaSrc);
  introMusic.preload = "auto";
  introMusic.volume = CONFIG.musicaVolume;

  function remainingMs() {
    return liberarEm - new Date();
  }

  function isMusicAllowedNow() {
    const ms = remainingMs();
    return ms > CONFIG.blockMusicUnderMs; // só toca se FALTAR MAIS que 60s
  }

  function safePlayIntro() {
    // ✅ BLOQUEIO ABSOLUTO
    if (!isMusicAllowedNow()) return;

    try {
      introMusic.currentTime = CONFIG.musicaComecarEm || 0;
      introMusic.volume = CONFIG.musicaVolume;

      const p = introMusic.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    } catch {}
  }

  function stopIntroNow() {
    try {
      introMusic.pause();
      introMusic.currentTime = 0;
      introMusic.volume = CONFIG.musicaVolume;
    } catch {}
  }

  function fadeOutStopIntro(ms = 1200) {
    try {
      if (introMusic.paused) return;

      const startVol = introMusic.volume;
      const steps = 30; // suave
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

  // ===== WEB AUDIO SFX (tensão) =====
  function ensureAudio() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  }

  function beep(freq = 880, dur = 0.07, gain = 0.18) {
    if (!ctx) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.setValueAtTime(freq, t);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(t);
    o.stop(t + dur + 0.03);
  }

  function impact() {
    if (!ctx) return;
    const t = ctx.currentTime;

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.22, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(t);
    o.stop(t + 0.18);

    setTimeout(() => beep(2000, 0.015, 0.06), 0);
  }

  function riser(ms = 260) {
    if (!ctx) return;
    const t = ctx.currentTime;

    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();

    o.type = "sawtooth";
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(2600, t + ms / 1000);

    f.type = "highpass";
    f.frequency.setValueAtTime(500, t);
    f.frequency.exponentialRampToValueAtTime(3600, t + ms / 1000);

    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.12, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);

    o.connect(f);
    f.connect(g);
    g.connect(ctx.destination);

    o.start(t);
    o.stop(t + ms / 1000 + 0.02);
  }

  function sparkle() {
    if (!ctx) return;
    beep(1320, 0.04, 0.10);
    setTimeout(() => beep(1760, 0.04, 0.09), 60);
    setTimeout(() => beep(2200, 0.045, 0.08), 120);
  }

  function pulseBarBeat() {
    const fill = el("loadingFill");
    if (!fill) return;
    fill.classList.remove("beat");
    void fill.offsetWidth;
    fill.classList.add("beat");
  }

  function enableAudioOnce() {
    try {
      ensureAudio();
      if (ctx.state === "suspended") ctx.resume();
      beep(660, 0.05, 0.10);
    } catch {}
  }

  // ===== BOTÃO OK =====
  function setupAudioGate() {
    const audioGate = el("audioGate");
    const audioOk = el("audioOk");
    if (!audioGate || !audioOk) return;

    function hideGate() {
      audioGate.classList.add("hide");
      setTimeout(() => { audioGate.style.display = "none"; }, 360);
    }

    function enableAudioFromGate() {
      enableAudioOnce();

      // ✅ Só toca música se faltar MAIS de 60s
      safePlayIntro();

      // sparkle de confirmação
      riser(160);
      setTimeout(() => sparkle(), 120);

      hideGate();
    }

    audioOk.addEventListener("click", enableAudioFromGate);
    audioOk.addEventListener("touchend", (e) => {
      e.preventDefault();
      enableAudioFromGate();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && audioGate.style.display !== "none") {
        enableAudioFromGate();
      }
    });
  }

  window.addEventListener("pointerdown", enableAudioOnce, { once: true });
  window.addEventListener("keydown", enableAudioOnce, { once: true });

  function setText(id, v) {
    const n = el(id);
    if (n) n.textContent = v;
  }

  setText("loadingTitle", CONFIG.nomeProjeto);

  // ===== FLAGS =====
  let tension60 = false;

  function redirectInstantNoLoading() {
    // ✅ SEM loading/barrinha quando zera
    stopIntroNow(); // ✅ sem música em hipótese alguma

    const flash = el("flash");
    if (flash) {
      flash.classList.add("on");
      setTimeout(() => flash.classList.remove("on"), 180);
    }

    // um impacto visual rápido opcional
    dropFX(900);

    document.body.classList.add("page-exit");
    setTimeout(() => {
      window.location.replace(CONFIG.redirectPara);
    }, 520);
  }

  function update() {
    if (done) return;

    const diffMs = remainingMs();

    // ✅ se já zerou: sem barrinha, sem música
    if (diffMs <= 0) {
      done = true;
      if (interval) clearInterval(interval);
      redirectInstantNoLoading();
      return;
    }

    // glitch últimos 3s
    document.documentElement.classList.toggle("glitching", diffMs <= 3000 && diffMs > 0);

    // últimos 60s
    const final60 = diffMs <= 60000 && diffMs > 0;
    document.documentElement.classList.toggle("final-phase", final60);

    // entrou nos 60s: PARA música com fade e começa tensão
    if (final60 && !tension60) {
      tension60 = true;

      // ✅ BLOQUEIO ABSOLUTO DE MÚSICA <= 60s
      fadeOutStopIntro(CONFIG.fadeStopMs);

      dropFX(900);
      const flash = el("flash");
      if (flash) {
        flash.classList.add("on");
        setTimeout(() => flash.classList.remove("on"), 110);
      }
    }
    if (!final60) tension60 = false;

    const total = Math.floor(diffMs / 1000);
    const dias = Math.floor(total / 86400);
    const horas = Math.floor((total % 86400) / 3600);
    const minutos = Math.floor((total % 3600) / 60);
    const segundos = total % 60;

    setText("dias", pad2(dias));
    setText("horas", pad2(horas));
    setText("minutos", pad2(minutos));
    setText("segundos", pad2(segundos));

    // tensão sonora nos 60s finais
    if (final60) {
      const sec = Math.floor(diffMs / 1000);
      if (sec !== lastSec) {
        lastSec = sec;

        ensureAudio();
        pulseBarBeat();

        const intensity = Math.min(60, Math.max(0, 60 - sec));
        const f1 = 420 + intensity * 10;
        const f2 = 760 + intensity * 14;

        impact();
        beep(f1, 0.05, 0.10 + intensity * 0.002);

        if (sec <= 20) {
          setTimeout(() => beep(f2, 0.04, 0.12 + intensity * 0.002), 70);
        }

        if (sec <= 10) {
          setTimeout(() => riser(160), 40);
          setTimeout(() => beep(1300 + intensity * 6, 0.04, 0.14), 120);

          const flash = el("flash");
          if (flash) {
            flash.classList.add("on");
            setTimeout(() => flash.classList.remove("on"), 70);
          }
        }

        if (sec <= 3) {
          setTimeout(() => sparkle(), 40);
          setTimeout(() => beep(1800, 0.08, 0.14), 110);
        }
      }
    } else {
      lastSec = null;
    }
  }

  // ===== init =====
  setupAudioGate();
  update();
  interval = setInterval(update, 250);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });

  window.__COUNTDOWN__ = { CONFIG, liberarEm };
})();
