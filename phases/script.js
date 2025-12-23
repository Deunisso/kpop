const teamMembers = [
	{ name: "Infinity Love", role: "Phase 1" },
	{ name: "Lovers", role: "Phase 2" },
	{ name: "Proud", role: "Phase 3" },
	{ name: "Angels", role: "Phase 4" },
	{ name: "Eleven", role: "Phase 5" },
];

const cards = document.querySelectorAll(".card");
const dots = document.querySelectorAll(".dot");
const memberName = document.querySelector(".member-name");
const memberRole = document.querySelector(".member-role");
const upArrows = document.querySelectorAll(".nav-arrow.up");
const downArrows = document.querySelectorAll(".nav-arrow.down");

let currentIndex = 0;
let isAnimating = false;

// ====== ÁUDIO (um lugar só) ======
const soundUp = new Audio("../sounds/up.mp3");
const soundDown = new Audio("../sounds/down.mp3");

soundUp.volume = 0.5;
soundDown.volume = 0.5;

// iOS/Safari: destrava áudio no primeiro toque/click
let audioUnlocked = false;
function unlockAudioOnce() {
	if (audioUnlocked) return;
	audioUnlocked = true;

	soundUp.play()
		.then(() => {
			soundUp.pause();
			soundUp.currentTime = 0;
		})
		.catch(() => {});

	soundDown.play()
		.then(() => {
			soundDown.pause();
			soundDown.currentTime = 0;
		})
		.catch(() => {});
}

document.addEventListener("touchstart", unlockAudioOnce, { once: true });
document.addEventListener("click", unlockAudioOnce, { once: true });

// throttle do som (evita spam)
let soundLocked = false;
const SOUND_DELAY = 250; // ms (ajuste aqui)

function playNavSound(direction /* "up" | "down" */) {
	if (soundLocked) return;
	soundLocked = true;

	const s = direction === "up" ? soundUp : soundDown;
	s.currentTime = 0;
	s.play().catch(() => {});

	setTimeout(() => {
		soundLocked = false;
	}, SOUND_DELAY);
}

function updateCarousel(newIndex) {
	if (isAnimating) return;
	isAnimating = true;

	currentIndex = (newIndex + cards.length) % cards.length;

	cards.forEach((card, i) => {
		const offset = (i - currentIndex + cards.length) % cards.length;

		card.classList.remove(
			"center",
			"up-1",
			"up-2",
			"down-1",
			"down-2",
			"hidden"
		);

		if (offset === 0) {
			card.classList.add("center");
		} else if (offset === 1) {
			card.classList.add("down-1");
		} else if (offset === 2) {
			card.classList.add("down-2");
		} else if (offset === cards.length - 1) {
			card.classList.add("up-1");
		} else if (offset === cards.length - 2) {
			card.classList.add("up-2");
		} else {
			card.classList.add("hidden");
		}
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
	}, 300);

	setTimeout(() => {
		isAnimating = false;
	}, 800);
}

// ====== NAVEGAÇÃO (setas com som) ======
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

// ====== DOTS ======
dots.forEach((dot, i) => {
	dot.addEventListener("click", () => {
		updateCarousel(i);
	});
});

// ====== CLICK NO CARD (apenas carousel) ======
cards.forEach((card, i) => {
	card.addEventListener("click", () => {
		updateCarousel(i);
	});
});

// ====== TECLADO ======
document.addEventListener("keydown", (e) => {
	if (e.key === "ArrowUp") {
		playNavSound("up");
		updateCarousel(currentIndex - 1);
	} else if (e.key === "ArrowDown") {
		playNavSound("down");
		updateCarousel(currentIndex + 1);
	}
});

// ====== SWIPE (touch) ======
let touchStartX = 0;
let touchEndX = 0;

// Add scroll indicator
function createScrollIndicator() {
	const indicator = document.createElement("div");
	indicator.className = "scroll-indicator";
	indicator.innerHTML = "scroll";
	document.body.appendChild(indicator);
}
createScrollIndicator();

document.addEventListener("touchstart", (e) => {
	touchStartX = e.changedTouches[0].screenY;
});

document.addEventListener("touchend", (e) => {
	touchEndX = e.changedTouches[0].screenY;
	handleSwipe();
});

function handleSwipe() {
	const swipeThreshold = 50;
	const diff = touchStartX - touchEndX;

	if (Math.abs(diff) > swipeThreshold) {
		if (diff > 0) {
			// swipe pra cima -> próximo
			playNavSound("down");
			updateCarousel(currentIndex + 1);
		} else {
			// swipe pra baixo -> anterior
			playNavSound("up");
			updateCarousel(currentIndex - 1);
		}
	}
}

updateCarousel(0);

// ====== LINKS POR CARD (navegação para páginas) ======
const caminhos = {
	0: "../phase1/index.html",
	1: "../phase2/index.html",
	2: "../phase3/index.html",
	3: "../phase4/index.html",
	4: "../phase5/index.html",
};

document.querySelectorAll(".card").forEach((card) => {
	card.addEventListener("click", (e) => {
		e.stopPropagation(); // evita conflito com o carousel

		const index = card.dataset.index;
		const destino = caminhos[index];

		if (!destino) return;

		window.location.href = destino;
	});
});
