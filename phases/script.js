(() => {
  // =========================================================
  // 1) CONFIG HORÁRIOS (Brasília, anti trocar hora do celular)
  // =========================================================
  const RELEASES = {
    0: { y: 2025, m: 12, d: 23, hh: 10, mm: 0, ss: 0 }, // Phase 1

    1: { y: 2025, m: 12, d: 24, hh: 10, mm: 0, ss: 0 }, // Phase 2

    2: { y: 2025, m: 12, d: 24, hh: 10, mm: 0, ss: 0 }, // Phase 3

    3: { y: 2025, m: 12, d: 24, hh: 10, mm: 0, ss: 0 }, // Phase 4

    4: { y: 2025, m: 12, d: 24, hh: 10, mm: 0, ss: 0 }, // Phase 5
  };

  const TIME_API = "https://worldtimeapi.org/api/timezone/America/Sao_Paulo";
  const RESYNC_EVERY_MS = 30_000;

  // =========================================================
  // 2) DADOS / ELEMENTOS
  // =========================================================
  const teamMembers = [
    { name: "Infinity Love", role: "Phase 1" },
    { name: "Lovers", role: "Phase 2" },
    { name: "Proud", role: "Phase 3" },
    { name: "Angels", role: "Phase 4" },
    { name: "Eleven", role: "Phase 5" },
  ];

  const caminhos = {
    0: "../phase1/index.html",
    1: "../phase2/index.html",
    2: "../phase3/index.html",
    3: "../phase4/index.html",
    4: "../phase5/index.html",
  };

  const cards = document.querySelectorAll(".card");
  const dots = document.querySelectorAll(".dot");
  const memberName = document.querySelector(".member-name");
  const memberRole = document.querySelector(".member-role");
  const upArrows = document.querySelectorAll(".nav-arrow.up");
  const downArrows = document.querySelectorAll(".nav-arrow.down");

  let currentIndex = 0;
  let isAnimating = false;

  // =========================================================
  // 3) ÁUDIOS (nav + erro locked)
  // =========================================================
  const soundUp = new Audio("../sounds/up.mp3");
  const soundDown = new Audio("../sounds/down.mp3");

  // 🔴 som de erro ao clicar em card bloqueado
  const soundLockedFX = new Audio("../sounds/locked.mp3"); // troque se quiser
  soundLockedFX.volume = 0.55;

  soundUp.volume = 0.5;
  soundDown.volume = 0.5;

  let audioUnlocked = false;
  function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    // desbloqueia os 3 sem tocar de verdade (play/pause)
    const warm = (a) =>
      a.play()
        .then(() => {
          a.pause();
          a.currentTime = 0;
        })
        .catch(() => {});

    warm(soundUp);
    warm(soundDown);
    warm(soundLockedFX);
  }
  document.addEventListener("touchstart", unlockAudioOnce, { once: true });
  document.addEventListener("click", unlockAudioOnce, { once: true });

  let soundLocked = false;
  const SOUND_DELAY = 250;

  function playNavSound(direction) {
    if (soundLocked) return;
    soundLocked = true;

    const s = direction === "up" ? soundUp : soundDown;
    s.currentTime = 0;
    s.play().catch(() => {});

    setTimeout(() => {
      soundLocked = false;
    }, SOUND_DELAY);
  }

  // throttle separado pro erro locked (pra não virar metralhadora)
  let lockedSfxGuard = false;
  const LOCKED_SFX_DELAY = 350;

  function playLockedSfx() {
    if (lockedSfxGuard) return;
    lockedSfxGuard = true;

    soundLockedFX.currentTime = 0;
    soundLockedFX.play().catch(() => {});

    setTimeout(() => {
      lockedSfxGuard = false;
    }, LOCKED_SFX_DELAY);
  }

  // =========================================================
  // 4) BADGE (indicador de sync online/local)
  // =========================================================
  function injectTimeBadgeStylesOnce() {
    if (document.getElementById("__timeBadgeStyles")) return;
    const s = document.createElement("style");
    s.id = "__timeBadgeStyles";
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
        pointer-events:none;
      }
      .time-dot{
        width:10px; height:10px; border-radius:50%;
        box-shadow: 0 0 0 0 rgba(0,0,0,0);
      }
      .time-dot.ok{ background:#32d74b; box-shadow: 0 0 18px rgba(50,215,75,.65); }
      .time-dot.bad{ background:#ff453a; box-shadow: 0 0 18px rgba(255,69,58,.55); }
      .time-dot.warn{ background:#ffd60a; box-shadow: 0 0 18px rgba(255,214,10,.55); }
    `;
    document.head.appendChild(s);
  }

  function ensureTimeBadge() {
    injectTimeBadgeStylesOnce();

    let badge = document.getElementById("__timeBadge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "__timeBadge";
      badge.className = "time-badge";
      badge.innerHTML = `
        <span class="time-dot warn" id="__timeDot"></span>
        <span id="__timeText">SINCRONIZANDO…</span>
      `;
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
  // 5) TIME SYNC (anti trocar hora)
  // =========================================================
  let netOffsetMs = 0;

  function netNowMs() {
    return Date.now() + netOffsetMs;
  }

  async function syncNetTime() {
    const t0 = Date.now();
    const r = await fetch(TIME_API, { cache: "no-store" });
    const t1 = Date.now();

    if (!r.ok) throw new Error("Falha TIME API");
    const data = await r.json();

    const serverMs = Number(data.unixtime) * 1000;
    if (!Number.isFinite(serverMs)) throw new Error("TIME API inválida");

    const rtt = t1 - t0;
    netOffsetMs = serverMs - (t0 + rtt / 2);
    return { rtt };
  }

  function setFallbackLocalTime() {
    netOffsetMs = 0;
  }

  // =========================================================
  // 6) LOCK LOGIC
  // =========================================================
  function toUtcMsFromBrasilia({ y, m, d, hh, mm, ss }) {
    // Brasília = UTC-3 => UTC = horárioBrasília + 3h
    return Date.UTC(y, m - 1, d, hh + 3, mm, ss);
  }

  function isUnlocked(index) {
    if (index === 0) return true; // Phase 1 sempre liberada
    const rel = RELEASES[index];
    if (!rel) return true;
    return netNowMs() >= toUtcMsFromBrasilia(rel);
  }

  function nextUnlockInfo(index) {
    const rel = RELEASES[index];
    if (!rel) return null;
    const dd = String(rel.d).padStart(2, "0");
    const mm = String(rel.m).padStart(2, "0");
    const hh = String(rel.hh).padStart(2, "0");
    const mi = String(rel.mm).padStart(2, "0");
    return `${dd}/${mm}/${rel.y} ${hh}:${mi} (Brasília)`;
  }

  // =========================================================
  // 7) RENDER LOCK STATE (cards/dots) + overlay msg no card
  // =========================================================
  function applyLocks() {
    cards.forEach((card, i) => {
      const locked = !isUnlocked(i);

      card.classList.toggle("locked", locked);
      card.setAttribute("aria-disabled", locked ? "true" : "false");

      if (locked) {
        const when = nextUnlockInfo(i);
        card.setAttribute("data-lockmsg", `🔒 LIBERA EM\n${when}`);
      } else {
        card.removeAttribute("data-lockmsg");
      }
    });

    dots.forEach((dot, i) => {
      const locked = !isUnlocked(i);
      dot.classList.toggle("locked", locked);
      dot.setAttribute("aria-disabled", locked ? "true" : "false");
    });
  }

  // =========================================================
  // 8) FX DE CLIQUE EM LOCKED (tremer + vermelho + som)
  // =========================================================
  function lockedClickFX(card) {
    // remove se estiver repetindo clique muito rápido
    card.classList.remove("shake", "redflash");

    // força reflow pra reiniciar a animação
    void card.offsetWidth;

    card.classList.add("shake", "redflash");

    // som de erro
    playLockedSfx();

    // limpa depois
    setTimeout(() => {
      card.classList.remove("shake", "redflash");
    }, 520);
  }

  // =========================================================
  // 9) CAROUSEL (navega livre, abrir é que bloqueia)
  // =========================================================
  function updateCarousel(newIndex) {
    if (isAnimating) return;

    const target = (newIndex + cards.length) % cards.length;

    isAnimating = true;
    currentIndex = target;

    cards.forEach((card, i) => {
      const offset = (i - currentIndex + cards.length) % cards.length;

      card.classList.remove("center", "up-1", "up-2", "down-1", "down-2", "hidden");

      if (offset === 0) card.classList.add("center");
      else if (offset === 1) card.classList.add("down-1");
      else if (offset === 2) card.classList.add("down-2");
      else if (offset === cards.length - 1) card.classList.add("up-1");
      else if (offset === cards.length - 2) card.classList.add("up-2");
      else card.classList.add("hidden");
    });

    dots.forEach((dot, i) => {
      dot.classList.toggle("active", i === currentIndex);
    });

    memberName.style.opacity = "0";
    memberRole.style.opacity = "0";

    setTimeout(() => {
      memberName.textContent = teamMembers[currentIndex].name;
      memberRole.textContent = teamMembers[currentIndex].role;
      memberName.style.opacity = "1";
      memberRole.style.opacity = "1";
    }, 260);

    setTimeout(() => {
      isAnimating = false;
    }, 800);
  }

  // =========================================================
  // 10) CONTROLES (setas / dots / teclado / swipe)
  // =========================================================
  upArrows.forEach((arrow) => {
    arrow.addEventListener("click", () => {
      playNavSound("up");
      updateCarousel(currentIndex - 1);
    });
  });

  downArrows.forEach((arrow) => {
    arrow.addEventListener("click", () => {
      playNavSound("down");
      updateCarousel(currentIndex + 1);
    });
  });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => updateCarousel(i));
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      playNavSound("up");
      updateCarousel(currentIndex - 1);
    } else if (e.key === "ArrowDown") {
      playNavSound("down");
      updateCarousel(currentIndex + 1);
    } else if (e.key === "Enter") {
      handleOpenCurrent();
    }
  });

  // swipe vertical
  let touchStartY = 0;
  let touchEndY = 0;

  function handleSwipe() {
    const swipeThreshold = 50;
    const diff = touchStartY - touchEndY;

    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        playNavSound("down");
        updateCarousel(currentIndex + 1);
      } else {
        playNavSound("up");
        updateCarousel(currentIndex - 1);
      }
    }
  }

  document.addEventListener("touchstart", (e) => {
    touchStartY = e.changedTouches[0].screenY;
  });

  document.addEventListener("touchend", (e) => {
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  });

  // =========================================================
  // 11) CLICK NO CARD (com FX quando locked)
  // =========================================================
  function handleOpenIndex(i) {
    if (!isUnlocked(i)) return;

    const destino = caminhos[i];
    if (!destino) return;
    window.location.href = destino;
  }

  function handleOpenCurrent() {
    if (!isUnlocked(currentIndex)) {
      lockedClickFX(cards[currentIndex]);
      return;
    }
    handleOpenIndex(currentIndex);
  }

  cards.forEach((card, i) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();

      // se clicou em um card que não é o atual: só navega
      if (i !== currentIndex) {
        updateCarousel(i);
        return;
      }

      // se é o atual e está bloqueado: treme + vermelho + som e NÃO abre
      if (!isUnlocked(i)) {
        lockedClickFX(card);
        return;
      }

      // se liberado: abre normal
      handleOpenIndex(i);
    });
  });

  // =========================================================
  // 12) Indicador de scroll (seu)
  // =========================================================
  function createScrollIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "scroll-indicator";
    indicator.innerHTML = "scroll";
    document.body.appendChild(indicator);
  }
  createScrollIndicator();

  // =========================================================
  // 13) INIT + Sync Time + aplicar locks + badge
  // =========================================================
  async function initTime() {
    ensureTimeBadge();
    try {
      setTimeBadge("warn", "SINCRONIZANDO…");
      const r = await syncNetTime();
      setTimeBadge("ok", `HORA ONLINE ✓  RTT ${Math.round(r.rtt)}ms`);
    } catch (e) {
      console.warn("[TIME] Falhou sync, usando relógio local.", e);
      setFallbackLocalTime();
      setTimeBadge("bad", "HORA LOCAL (fallback)");
    }

    if (RESYNC_EVERY_MS > 0) {
      setInterval(async () => {
        try {
          const r = await syncNetTime();
          setTimeBadge("ok", `HORA ONLINE ✓  RTT ${Math.round(r.rtt)}ms`);
        } catch {
          setFallbackLocalTime();
          setTimeBadge("bad", "HORA LOCAL (fallback)");
        }

        applyLocks();
        updateCarousel(currentIndex);
      }, RESYNC_EVERY_MS);
    }
  }

  // primeiro render
  applyLocks();
  updateCarousel(0);

  // sincroniza e reaplica
  initTime().then(() => {
    applyLocks();
    updateCarousel(currentIndex);
  });

  // se voltar pro tab, recalcula sem esperar 30s
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      applyLocks();
      updateCarousel(currentIndex);
    }
  });

  // debug opcional
  window.__SPOTAY_TIME__ = {
    RELEASES,
    TIME_API,
    RESYNC_EVERY_MS,
    get netOffsetMs() {
      return netOffsetMs;
    },
  };
})();
