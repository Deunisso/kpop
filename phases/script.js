(() => {
  // =========================================================
  // 1) CONFIG HORÁRIOS (Brasília, anti trocar hora do celular)
  // =========================================================
  const RELEASES = {
    1: { y: 2025, m: 12, d: 24, hh: 20, mm: 0, ss: 0 }, // Phase 2
    2: { y: 2025, m: 12, d: 25, hh: 20, mm: 0, ss: 0 }, // Phase 3
    3: { y: 2025, m: 12, d: 26, hh: 20, mm: 0, ss: 0 }, // Phase 4
    4: { y: 2025, m: 12, d: 27, hh: 20, mm: 0, ss: 0 }, // Phase 5
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
  // 3) ÁUDIO NAV
  // =========================================================
  const soundUp = new Audio("../sounds/up.mp3");
  const soundDown = new Audio("../sounds/down.mp3");
  soundUp.volume = 0.5;
  soundDown.volume = 0.5;

  let audioUnlocked = false;
  function unlockAudioOnce() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    soundUp.play().then(() => { soundUp.pause(); soundUp.currentTime = 0; }).catch(() => {});
    soundDown.play().then(() => { soundDown.pause(); soundDown.currentTime = 0; }).catch(() => {});
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

    setTimeout(() => { soundLocked = false; }, SOUND_DELAY);
  }

  // =========================================================
  // 4) TIME SYNC (anti trocar hora)
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
  }

  function setFallbackLocalTime() {
    netOffsetMs = 0;
  }

  // =========================================================
  // 5) LOCK LOGIC
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
  // 6) RENDER LOCK STATE (cards/dots) + overlay msg no card
  // =========================================================
  function applyLocks() {
    cards.forEach((card, i) => {
      const locked = !isUnlocked(i);

      card.classList.toggle("locked", locked);
      card.setAttribute("aria-disabled", locked ? "true" : "false");

      // texto em cima da imagem (CSS usa attr(data-lockmsg))
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
  // 7) CAROUSEL (navega livre, abrir é que bloqueia)
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
      memberRole.textContent = teamMembers[currentIndex].role; // SEM mensagem de bloqueio aqui
      memberName.style.opacity = "1";
      memberRole.style.opacity = "1";
    }, 260);

    setTimeout(() => { isAnimating = false; }, 800);
  }

  // =========================================================
  // 8) CONTROLES (setas / dots / teclado / swipe)
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
  // 9) CLICK NO CARD (SEM TOAST)
  // =========================================================
  function handleOpenIndex(i) {
    // 🔇 Sem toast: se estiver locked, só não abre.
    if (!isUnlocked(i)) return;

    const destino = caminhos[i];
    if (!destino) return;
    window.location.href = destino;
  }

  function handleOpenCurrent() {
    handleOpenIndex(currentIndex);
  }

  cards.forEach((card, i) => {
    card.addEventListener("click", (e) => {
      e.stopPropagation();

      if (i !== currentIndex) {
        updateCarousel(i);
        return;
      }

      handleOpenIndex(i);
    });
  });

  // =========================================================
  // 10) Indicador de scroll (seu)
  // =========================================================
  function createScrollIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "scroll-indicator";
    indicator.innerHTML = "scroll";
    document.body.appendChild(indicator);
  }
  createScrollIndicator();

  // =========================================================
  // 11) INIT + Sync Time + aplicar locks
  // =========================================================
  async function initTime() {
    try {
      await syncNetTime();
    } catch (e) {
      console.warn("[TIME] Falhou sync, usando relógio local.", e);
      setFallbackLocalTime();
    }

    if (RESYNC_EVERY_MS > 0) {
      setInterval(async () => {
        try {
          await syncNetTime();
        } catch {
          setFallbackLocalTime();
        }

        applyLocks();
        updateCarousel(currentIndex);
      }, RESYNC_EVERY_MS);
    }
  }

  applyLocks();
  updateCarousel(0);
  initTime().then(() => {
    applyLocks();
    updateCarousel(currentIndex);
  });
})();
