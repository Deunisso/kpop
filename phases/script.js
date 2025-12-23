(() => {
  // =========================================================
  // 0) AVISO: seu HTML está com <html> dentro de <html>.
  // Isso não quebra tudo, mas pode causar comportamento estranho.
  // =========================================================

  // =========================================================
  // 1) CONFIG HORÁRIOS (Brasília, anti trocar hora do celular)
  // =========================================================
  const RELEASES = {
    1: { y: 2025, m: 12, d: 24, hh: 20, mm: 0, ss: 0 }, // Phase 2
    2: { y: 2025, m: 12, d: 25, hh: 20, mm: 0, ss: 0 }, // Phase 3
    3: { y: 2025, m: 12, d: 26, hh: 20, mm: 0, ss: 0 }, // Phase 4
    4: { y: 2025, m: 12, d: 27, hh: 20, mm: 0, ss: 0 }, // Phase 5
  };

  // Fallback: se a internet falhar, usa relógio local
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

    soundUp.play()
      .then(() => { soundUp.pause(); soundUp.currentTime = 0; })
      .catch(() => {});
    soundDown.play()
      .then(() => { soundDown.pause(); soundDown.currentTime = 0; })
      .catch(() => {});
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
  let timeState = "warn"; // ok | bad | warn

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

    // estimar atraso de rede
    const rtt = t1 - t0;
    const estimatedLocalAtServer = t0 + rtt / 2;
    netOffsetMs = serverMs - estimatedLocalAtServer;

    timeState = "ok";
    return { ok: true, rtt };
  }

  function setFallbackLocalTime() {
    netOffsetMs = 0;
    timeState = "bad";
  }

  // =========================================================
  // 5) LOCK LOGIC
  // =========================================================
  function toUtcMsFromBrasilia({ y, m, d, hh, mm, ss }) {
    // Brasília = UTC-3 => UTC = horárioBrasília + 3h
    return Date.UTC(y, m - 1, d, hh + 3, mm, ss);
  }

  function isUnlocked(index) {
    // phase1 sempre liberada
    if (index === 0) return true;

    const rel = RELEASES[index];
    if (!rel) return true; // se não definiu, não bloqueia

    const unlockAtUtc = toUtcMsFromBrasilia(rel);
    return netNowMs() >= unlockAtUtc;
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
  // 6) UI: toast avisando bloqueio
  // =========================================================
  let toastTimer = null;
  function showLockToast(msg) {
    let t = document.querySelector(".lock-toast");
    if (!t) {
      t = document.createElement("div");
      t.className = "lock-toast";
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("on"), 1700);
  }

  // =========================================================
  // 7) RENDER LOCK STATE (cards/dots) + overlay msg no card
  // =========================================================
  function applyLocks() {
    cards.forEach((card, i) => {
      const locked = !isUnlocked(i);

      card.classList.toggle("locked", locked);
      card.setAttribute("aria-disabled", locked ? "true" : "false");

      // ✅ texto que aparece em cima da imagem (CSS usa attr(data-lockmsg))
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
  // 8) CAROUSEL (navega livre, abrir é que bloqueia)
  // =========================================================
  function updateCarousel(newIndex, { allowLocked = true } = {}) {
    if (isAnimating) return;

    const target = (newIndex + cards.length) % cards.length;

    // modo opcional "não permitir locked"
    if (!allowLocked && !isUnlocked(target)) {
      const when = nextUnlockInfo(target);
      showLockToast(`🔒 ${teamMembers[target].role} libera em ${when}`);
      return;
    }

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

	// ✅ SEM mensagem de bloqueio aqui
	memberRole.textContent = teamMembers[currentIndex].role;

	memberName.style.opacity = "1";
	memberRole.style.opacity = "1";
	}, 260);

    setTimeout(() => { isAnimating = false; }, 800);
  }

  // =========================================================
  // 9) CONTROLES (setas / dots / teclado / swipe)
  // =========================================================
  upArrows.forEach((arrow) => {
    arrow.addEventListener("click", () => {
      playNavSound("up");
      updateCarousel(currentIndex - 1, { allowLocked: true });
    });
  });

  downArrows.forEach((arrow) => {
    arrow.addEventListener("click", () => {
      playNavSound("down");
      updateCarousel(currentIndex + 1, { allowLocked: true });
    });
  });

  dots.forEach((dot, i) => {
    dot.addEventListener("click", () => {
      updateCarousel(i, { allowLocked: true });
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowUp") {
      playNavSound("up");
      updateCarousel(currentIndex - 1, { allowLocked: true });
    } else if (e.key === "ArrowDown") {
      playNavSound("down");
      updateCarousel(currentIndex + 1, { allowLocked: true });
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
        updateCarousel(currentIndex + 1, { allowLocked: true });
      } else {
        playNavSound("up");
        updateCarousel(currentIndex - 1, { allowLocked: true });
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
  // 10) CLICK NO CARD:
  // - clicar em card fora do centro só centraliza
  // - clicar no centro tenta abrir (se locked: toast + overlay já aparece)
  // =========================================================
  function handleOpenIndex(i) {
    if (!isUnlocked(i)) {
      const when = nextUnlockInfo(i);
      showLockToast(`🔒 ${teamMembers[i].role} libera em ${when}`);
      return;
    }
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
        updateCarousel(i, { allowLocked: true });
        return;
      }

      handleOpenIndex(i);
    });
  });

  // =========================================================
  // 11) Indicador de scroll (seu)
  // =========================================================
  function createScrollIndicator() {
    const indicator = document.createElement("div");
    indicator.className = "scroll-indicator";
    indicator.innerHTML = "scroll";
    document.body.appendChild(indicator);
  }
  createScrollIndicator();

  // =========================================================
  // 12) INIT + Sync Time + aplicar locks
  // =========================================================
  async function initTime() {
    try {
      await syncNetTime();
    } catch (e) {
      console.warn("[TIME] Falhou sync, usando relógio local.", e);
      setFallbackLocalTime();
    }

    // re-sync contínuo
    if (RESYNC_EVERY_MS > 0) {
      setInterval(async () => {
        try {
          await syncNetTime();
        } catch {
          setFallbackLocalTime();
        }

        applyLocks();

        // se destravar enquanto o usuário está vendo, atualiza textos
        updateCarousel(currentIndex, { allowLocked: true });
      }, RESYNC_EVERY_MS);
    }
  }

  // inicializa
  applyLocks();
  updateCarousel(0, { allowLocked: true });
  initTime().then(() => {
    applyLocks();
    updateCarousel(currentIndex, { allowLocked: true });
  });
})();
