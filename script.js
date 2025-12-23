(() => {
  // ===== CONFIG FÁCIL =====
  const CONFIG = {
    nomeProjeto: "PREPARANDO O DROP",
    ano: 2025,
    mes: 12,
    dia: 22,

    hora: 21,
    minuto: 30,
    segundo: 0,
    redirectPara: new URL("../phases/index.html", window.location.href).toString(),
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

  function kick() { beep(90, 0.06, 0.22); }
  function snare(){ beep(1800, 0.03, 0.08); }

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

  // ===== BOTÃO OK pra liberar áudio =====
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
      hideGate();
    }

    audioOk.addEventListener("click", enableAudioFromGate);
    audioOk.addEventListener("touchend", (e) => {
      e.preventDefault();
      enableAudioFromGate();
    });

    // Enter também ativa
    window.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && audioGate.style.display !== "none") {
        enableAudioFromGate();
      }
    });
  }

  // fallback: se o usuário tocar em qualquer lugar antes do OK
  window.addEventListener("pointerdown", enableAudioOnce, { once: true });
  window.addEventListener("keydown", enableAudioOnce, { once: true });

  function setText(id, v) {
    const n = el(id);
    if (n) n.textContent = v;
  }

  // Atualiza textos do projeto
  setText("loadingTitle", CONFIG.nomeProjeto);

  function update() {
    if (done) return;

    const diffMs = liberarEm - new Date();

    // glitch últimos 3s
    document.documentElement.classList.toggle("glitching", diffMs <= 3000 && diffMs > 0);

    // tensão últimos 10s + beep por segundo
    const final10 = diffMs <= 10000 && diffMs > 0;
    document.documentElement.classList.toggle("final-phase", final10);

    if (diffMs <= 0) {
      release();
      return;
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

    if (final10) {
      const sec = Math.floor(diffMs / 1000);
      if (sec !== lastSec) {
        lastSec = sec;

        ensureAudio();
        kick();
        pulseBarBeat();

        if (sec <= 3) {
          setTimeout(() => snare(), 60);
          setTimeout(() => beep(1320, 0.06, 0.12), 90);
        }
      }
    } else {
      lastSec = null;
    }
  }

  function release() {
    if (done) return;
    done = true;
    if (interval) clearInterval(interval);

    document.documentElement.classList.remove("final-phase", "glitching");

    const loading = el("loading");
    const fill = el("loadingFill");
    const pct = el("loadingPct");
    const sub = el("loadingSub");

    if (loading) loading.classList.add("on");
    if (fill) fill.style.width = "0%";
    if (pct) pct.textContent = "0";

    ensureAudio();
    kick(); pulseBarBeat();
    setTimeout(() => { kick(); pulseBarBeat(); }, 140);
    setTimeout(() => { snare(); pulseBarBeat(); }, 260);

    const steps = [
      { p: 18, t: "Aquecendo luzes…" },
      { p: 38, t: "Sincronizando telão…" },
      { p: 57, t: "Carregando experiência…" },
      { p: 74, t: "Preparando o drop…" },
      { p: 88, t: "Finalizando…" },
      { p: 100, t: "Abrindo…" },
    ];

    let i = 0;
    let current = 0;

    const progTimer = setInterval(() => {
      if (!fill || !pct) return;

      const target = steps[Math.min(i, steps.length - 1)].p;

      current += Math.max(0.7, (target - current) * 0.075);
      if (current > target) current = target;

      fill.style.width = current.toFixed(1) + "%";
      pct.textContent = String(Math.floor(current));

      if (Math.floor(current) % 7 === 0) pulseBarBeat();

      if (Math.abs(current - target) < 1.2 && i < steps.length) {
        if (sub) sub.textContent = steps[i].t;
        kick(); pulseBarBeat();
        i++;
      }

      if (current >= 99.3) {
        clearInterval(progTimer);

        const flash = el("flash");
        if (flash) {
          flash.classList.add("on");
          setTimeout(() => flash.classList.remove("on"), 260);
        }

        snare();
        setTimeout(() => beep(1760, 0.22, 0.18), 60);

        document.body.classList.add("page-exit");
        setTimeout(() => {
          window.location.replace(CONFIG.redirectPara);
        }, 650);
      }
    }, 45);
  }

  // ===== init =====
  setupAudioGate();
  update();
  interval = setInterval(update, 250);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) update();
  });

  window.__COUNTDOWN__ = { CONFIG, liberarEm, forceRelease: release };
})();
