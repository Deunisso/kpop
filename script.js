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

document.addEventListener("DOMContentLoaded", () => {

    const soundUp = new Audio("./sounds/up.mp3");
    const soundDown = new Audio("./sounds/down.mp3");

	soundUp.volume = 0.25;   
    soundDown.volume = 0.25;

    let isLocked = false;
    const CLICK_DELAY = 800; // ms (ajuste aqui)

    document.querySelectorAll(".nav-arrow").forEach(button => {
        button.addEventListener("click", () => {

            if (isLocked) return;

            isLocked = true;

            const sound = button.classList.contains("up") ? soundUp : soundDown;
            sound.currentTime = 0;
            sound.play();

            setTimeout(() => {
                isLocked = false;
            }, CLICK_DELAY);
        });
    });

});

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

upArrows.forEach(arrow => {
	arrow.addEventListener("click", () => {
		updateCarousel(currentIndex - 1);
	});
});

downArrows.forEach(arrow => {
	arrow.addEventListener("click", () => {
		updateCarousel(currentIndex + 1);
	});
});

dots.forEach((dot, i) => {
	dot.addEventListener("click", () => {
		updateCarousel(i);
	});
});

cards.forEach((card, i) => {
	card.addEventListener("click", () => {
		updateCarousel(i);
	});
});

document.addEventListener("keydown", (e) => {
	if (e.key === "ArrowUp") {
		updateCarousel(currentIndex - 1);
	} else if (e.key === "ArrowDown") {
		updateCarousel(currentIndex + 1);
	}
});

let touchStartX = 0;
let touchEndX = 0;
let scrollTimeout;
let isScrolling = false;

// Scroll event listener
//if u wnat u can timer to disappear that bottom right scroll button - by gopi
	
	

// Add scroll indicator
function createScrollIndicator() {
	const indicator = document.createElement('div');
	indicator.className = 'scroll-indicator';
	indicator.innerHTML = 'scroll';
	document.body.appendChild(indicator);
}

// Initialize scroll indicator
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
			updateCarousel(currentIndex + 1);
		} else {
			updateCarousel(currentIndex - 1);
		}
	}
}

updateCarousel(0);

const caminhos = {
    0: './phase1/index.html',
    1: './phase2/index.html',
    2: './phase3/index.html',
    3: './phase4/index.html',
    4: './phase5/index.html'
};

document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', (e) => {
        e.stopPropagation(); // evita conflito com o carousel

        const index = card.dataset.index;
        const destino = caminhos[index];

        if (!destino) return;

        window.location.href = destino;
    });
});
