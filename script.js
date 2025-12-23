// ===============================
// PRELOAD REAL (BARRA POR ARQUIVO)
// ===============================

// ⏱️ helper de delay forçado (OBRIGATÓRIO)
const wait = (ms) => new Promise(res => setTimeout(res, ms));

function isImage(url) {
  return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);
}
function isAudio(url) {
  return /\.(mp3|wav|ogg|m4a)$/i.test(url);
}

async function preloadOne(url) {
  // 🚫 BLOQUEIO TOTAL: nada carrega antes do timer zerar
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

  const r = await fetch(url, { cache: "no-store" });
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
      onProgress({
        done: doneCount,
        total,
        url,
        ok
      });
    }

    // ⏱️ DELAY FORÇADO POR ARQUIVO
    await wait(1000); // ← 1000 = 1s | 3000 = 3s
  }
}

function dropFX(durationMs = 1200) {
  const flash = document.getElementById("flash");
  if (!flash) return;

  flash.classList.add("on");
  setTimeout(() => {
    flash.classList.remove("on");
  }, durationMs);
}

(() => {
  // ===== CONFIG =====
  const CONFIG = {
    nomeProjeto: "PREPARANDO O DROP",

    // data/hora do zero
    ano: 2025,
    mes: 12,
    dia: 23,
    hora: 20,
    minuto: 0,
    segundo: 0,

    redirectPara: new URL("./phases/index.html", window.location.href).toString(),

    // ===== MUSICA =====
    musicaSrc: "../sounds/intro.mp3",
    musicaVolume: 0.9,
    musicaComecarEm: 0,

    // NUNCA toca música se faltar <= 60s (ou se já zerou)
    blockMusicUnderMs: 60000,
    fadeStopMs: 1200,

    // ===== ASSETS PRA PRÉ-CARREGAR (você vai me mandar e eu monto) =====
    // IMPORTANTE: esses caminhos devem ser acessíveis via HTTP no seu site.
    assets: [
      // exemplos (substitua pelo seu "manifest")
      "./phase1/music/Black.mp3",
      "./phase1/music/Blue.mp3",
      "./phase1/music/Gauntlet.mp3",
      "./phase1/music/Green.mp3",
      "./phase1/music/Orange.mp3",
      "./phase1/music/Purple.mp3",
      "./phase1/music/Red.mp3",
      "./phase1/music/Yellow.mp3",

      "./phase2/music/AngryV2.mp3",
      "./phase2/music/Armor.mp3",
      "./phase2/music/Avengers.mp3",
      "./phase2/music/Explicit.mp3",
      "./phase2/music/Magic.mp3",
      "./phase2/music/ResponsibilitiesV2.mp3",
      "./phase2/music/Shield.mp3",
      "./phase2/music/ThunderV2.mp3",

      "./phase3/music/Card.mp3",
      "./phase3/music/Colgate.mp3",
      "./phase3/music/Miss.mp3",
      "./phase3/music/New.mp3",
      "./phase3/music/Percy.mp3",
      "./phase3/music/Proud.mp3",
      "./phase3/music/Santa.mp3",
      "./phase3/music/Walking.mp3",

      "./phase4/music/Bath.mp3",
      "./phase4/music/Cruzeiro.mp3",
      "./phase4/music/Dan.mp3",
      "./phase4/music/IlhaBela.mp3",
      "./phase4/music/Next.mp3",
      "./phase4/music/Re.mp3",
      "./phase4/music/RollerSkates.mp3",
      "./phase4/music/Vo.mp3",

      "./phase5/music/Collide.mp3",
      "./phase5/music/Dama.mp3",
      "./phase5/music/Fire.mp3",
      "./phase5/music/Guacamole.mp3",
      "./phase5/music/Lights.mp3",
      "./phase5/music/Okay.mp3",
      "./phase5/music/Tayara.mp3",
      "./phase5/music/Unfiltered.mp3",
    ],
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

  // se já viu o timer positivo (abriu antes de zerar), então quando zerar "ao vivo" mostra loading
  let seenPositive = false;
  let releasing = false;

  // ===============================
  // AUDIO: MÚSICA (intro)
  // ===============================
  const introMusic = new Audio(CONFIG.musicaSrc);
  introMusic.preload = "auto";
  introMusic.volume = CONFIG.musicaVolume;

  function remainingMs() {
    return liberarEm - new Date();
  }

  function isMusicAllowedNow() {
    const ms = remainingMs();
    return ms > CONFIG.blockMusicUnderMs; // só toca se faltar MAIS de 60s
  }

  function safePlayIntro() {
    // BLOQUEIO ABSOLUTO
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
      const steps = 30;
      let i = 0;

      const t = setInterval(() => {
        i++;
        const k = 1 - i / steps;
        const eased = k * k; // suave
        introMusic.volume = Math.max(0, startVol * eased);

        if (i >= steps) {
          clearInterval(t);
          stopIntroNow();
        }
      }, ms / steps);
    } catch {}
  }

  // ===============================
  // WEB AUDIO: SFX (tensão / loading)
  // ===============================
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

  // ===============================
  // PRELOAD REAL (BARRA POR ARQUIVO)
  // ===============================
  function isImage(url) {
    return /\.(png|jpg|jpeg|webp|gif|svg)$/i.test(url);
  }
  function isAudio(url) {
    return /\.(mp3|wav|ogg|m4a)$/i.test(url);
  }

  async function preloadOne(url) {
    // 🚫 BLOQUEIO TOTAL: nada carrega antes do timer zerar
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

    const r = await fetch(url, { cache: "no-store" });
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
        onProgress({
          done: doneCount,
          total,
          url,
          ok
        });
      }

      // ⏱️ DELAY FORÇADO POR ARQUIVO
      await wait(300);
    }
  }

  // ===============================
  // AUDIO GATE (BOTÃO OK)
  // HTML precisa: <button id="audioOk" ...>
  // ===============================
  function setupAudioGate() {
    const audioGate = el("audioGate");
    const audioOk = el("audioOk");
    if (!audioGate || !audioOk) return;

    function hideGate() {
      audioGate.classList.add("hide");
      setTimeout(() => {
        audioGate.style.display = "none";
      }, 360);
    }

    function enableAudioFromGate() {
      enableAudioOnce();

      // ✅ música só se faltar > 60s
      safePlayIntro();

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

  // fallback pra liberar AudioContext
  window.addEventListener("pointerdown", enableAudioOnce, { once: true });
  window.addEventListener("keydown", enableAudioOnce, { once: true });

  function setText(id, v) {
    const n = el(id);
    if (n) n.textContent = v;
  }

  // Atualiza textos
  setText("loadingTitle", CONFIG.nomeProjeto);

  // ===============================
  // RELEASES
  // ===============================
  function releaseFastNoLoading() {
    // abriu e já estava zerado -> SEM barrinha
    stopIntroNow(); // garantia

    const flash = el("flash");
    if (flash) {
      flash.classList.add("on");
      setTimeout(() => flash.classList.remove("on"), 180);
    }

    document.body.classList.add("page-exit");
    setTimeout(() => {
      window.location.replace(CONFIG.redirectPara);
    }, 450);
  }

  async function releaseWithLoading() {
    // zerou AO VIVO -> COM barrinha mostrando arquivos
    if (releasing) return;
    releasing = true;

    done = true;
    if (interval) clearInterval(interval);

    // ✅ timer já zerou -> NUNCA música
    stopIntroNow();

    // 🔓 AGORA SIM: permitir preload (somente depois do zero)
    allowPreload = true;

    document.documentElement.classList.remove("final-phase", "glitching");

    const loading = el("loading");
    const fill = el("loadingFill");
    const pct = el("loadingPct");
    const sub = el("loadingSub");

    if (loading) loading.classList.add("on");
    if (fill) fill.style.width = "0%";
    if (pct) pct.textContent = "0";

    ensureAudio();
    riser(220);
    setTimeout(() => impact(), 120);

    const fileLine = (u) => {
      if (!u) return "";
      const clean = u.split("?")[0];
      const parts = clean.split("/");
      return parts.slice(-2).join("/");
    };

    // Preload REAL: a barra anda por arquivo concluído
    await preloadAssets((p) => {
      const ratio = p.total ? p.done / p.total : 1;

      if (fill) fill.style.width = (ratio * 100).toFixed(1) + "%";
      if (pct) pct.textContent = String(Math.floor(ratio * 100));

      const status = p.ok ? "Carregando" : "Pulando";
      if (sub) sub.textContent = `${status}: ${fileLine(p.url)} (${p.done}/${p.total})`;

      // som “satisfatório” por arquivo
      beep(p.ok ? 980 : 440, 0.03, 0.07);
      pulseBarBeat();

      // efeito extra no "Preparando o drop"
      if (p.ok && /preparando|drop|phases/i.test(p.url)) {
        setTimeout(() => sparkle(), 60);
      }
    });

    // terminou tudo
    if (fill) fill.style.width = "100%";
    if (pct) pct.textContent = "100";
    if (sub) sub.textContent = "Abrindo…";

    // ✅ timer zerado -> sem música
    dropFX(2200);

    const flash = el("flash");
    if (flash) {
      flash.classList.add("on");
      setTimeout(() => flash.classList.remove("on"), 220);
    }

    impact();
    setTimeout(() => sparkle(), 80);

    document.body.classList.add("page-exit");
    setTimeout(() => {
      window.location.replace(CONFIG.redirectPara);
    }, 650);
  }

  // ===============================
  // UPDATE LOOP
  // ===============================
  let tension60 = false;

  function update() {
    if (done) return;

    const diffMs = remainingMs();

    // marca que já existiu tempo positivo
    if (diffMs > 0) seenPositive = true;

    // ✅ se zerou:
    if (diffMs <= 0) {
      done = true;
      if (interval) clearInterval(interval);

      if (!seenPositive) {
        // abriu e já estava zerado -> SEM loading
        releaseFastNoLoading();
      } else {
        // estava no site e zerou agora -> COM loading real
        releaseWithLoading();
      }
      return;
    }

    // glitch últimos 3s
    document.documentElement.classList.toggle("glitching", diffMs <= 3000 && diffMs > 0);

    // últimos 60s
    const final60 = diffMs <= 60000 && diffMs > 0;
    document.documentElement.classList.toggle("final-phase", final60);

    // entrou nos 60s: PARA música com fade e aumenta tensão
    if (final60 && !tension60) {
      tension60 = true;

      // ✅ bloqueio música <=60s
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

    // tensão sonora nos 60s finais (sem música)
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

  // ===== INIT =====
  setupAudioGate();
  update();
  interval = setInterval(update, 250);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });

  window.__COUNTDOWN__ = { CONFIG, liberarEm };
})();
