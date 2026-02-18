/* --- Carousel Script (modified to support external reorders and modal sync) --- */
document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
    const track = wrapper.querySelector('.carousel-track');
    const leftBtn = wrapper.querySelector('.arrow.left');
    const rightBtn = wrapper.querySelector('.arrow.right');

    let imgs = Array.from(track.querySelectorAll('img'));
    imgs.forEach((img, i) => { img.setAttribute('data-index', i); });

    if (!track || imgs.length === 0) return;

    let index = 0;

    function update() {
        // Re-query images because search.js reorders them in the DOM
        imgs = Array.from(track.querySelectorAll('img'));
        if (imgs.length === 0) return;

        const container = wrapper.querySelector('.carousel-container');
        const containerWidth = container.getBoundingClientRect().width;

        if (index > imgs.length - 1) index = imgs.length - 1;
        if (index < 0) index = 0;

        const activeImg = imgs[index];
        const activeCenter = activeImg.offsetLeft + (activeImg.offsetWidth / 2);
        const offset = (containerWidth / 2) - activeCenter;
        track.style.transform = `translateX(${offset}px)`;

        imgs.forEach((im, i) => {
            im.classList.remove('center', 'side');
            if (i === index) {
                im.classList.add('center');
            } else {
                im.classList.add('side');
            }
        });

        if (leftBtn) leftBtn.disabled = (index === 0);
        if (rightBtn) rightBtn.disabled = (index === imgs.length - 1);
    }

    window.addEventListener('carousel:sync', (e) => {
        if (e.detail.track === track) {
            index = e.detail.index;
            update();
        }
    });

    window.addEventListener('carousel:reorder', (e) => {
        try {
            if (e.detail && e.detail.resetIndex) index = 0;
            imgs = Array.from(track.querySelectorAll('img'));
            update();
        } catch (err) {
            update();
        }
    });

    // Inside the carousel initialization (script.js)
    if (leftBtn) leftBtn.addEventListener('click', () => {
        if (index > 0) {
            leftBtn.classList.add('animated');
            index--;
            update();
            setTimeout(() => leftBtn.classList.remove('animated'), 300); // Match animation duration
        }
    });

    if (rightBtn) rightBtn.addEventListener('click', () => {
        if (index < imgs.length - 1) {
            rightBtn.classList.add('animated');
            index++;
            update();
            setTimeout(() => rightBtn.classList.remove('animated'), 300); // Match animation duration
        }
    });

    wrapper.setAttribute('tabindex', '0');
    wrapper.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' && index > 0) { index--; update(); }
        if (e.key === 'ArrowRight' && index < imgs.length - 1) { index++; update(); }
    });

    let startX = null;
    wrapper.addEventListener('touchstart', e => startX = e.touches[0].clientX);
    wrapper.addEventListener('touchend', e => {
        if (startX === null) return;
        const dx = e.changedTouches[0].clientX - startX;
        if (Math.abs(dx) > 50) {
            if (dx > 0 && index > 0) index--;
            else if (dx < 0 && index < imgs.length - 1) index++;
            update();
        }
        startX = null;
    });

    window.addEventListener('resize', () => setTimeout(update, 90));
    setTimeout(update, 60);
});


/* --- Lightbox / Magnifier --- */
const modal = document.getElementById('image-modal');
const modalImg = document.getElementById('modal-image');
const descriptionTitle = document.getElementById('description-title');
const descriptionText = document.getElementById('description-text');
const descriptionMeta = document.getElementById('description-meta');
const closeModal = document.getElementById('modal-close-btn');
const magContainer = document.getElementById('magnifier-container');
const magLens = document.getElementById('magnifier-lens');
const modalPrevBtn = document.getElementById('modal-prev-btn');
const modalNextBtn = document.getElementById('modal-next-btn');

let currentSectionImages = [];
let currentImageIndex = 0;
const zoomFactor = 2.5;
const lensRadius = 90;
const lensDiameter = lensRadius * 2;
const BUTTON_BOUNCE_DURATION_MS = 300;
const LENS_FADE_OUT_MS = 220;
const EDGE_REVEAL_BUFFER_PX = 72;
const EDGE_REVEAL_MIN_OPACITY = 0.18;
let lensFadeTimer = null;
let lensCanvas = null;
let lensCtx = null;

function ensureLensCanvas() {
    if (!magLens || lensCanvas) return;
    lensCanvas = document.createElement('canvas');
    lensCanvas.className = 'mag-lens-canvas';
    lensCanvas.width = lensDiameter;
    lensCanvas.height = lensDiameter;
    lensCtx = lensCanvas.getContext('2d', { alpha: true });
    magLens.appendChild(lensCanvas);
}

function showLens() {
    ensureLensCanvas();
    if (lensFadeTimer) {
        clearTimeout(lensFadeTimer);
        lensFadeTimer = null;
    }
    magLens.classList.remove('exiting');
    magLens.style.filter = 'none';
    magLens.style.opacity = 1;
    magLens.classList.add('active');
    magContainer.classList.add('lens-active');
}
function hideLens() {
    magLens.style.opacity = 0;
    magLens.style.filter = 'blur(2.6px) saturate(85%)';
    magLens.classList.add('exiting');

    if (lensFadeTimer) clearTimeout(lensFadeTimer);
    lensFadeTimer = setTimeout(() => {
        magLens.classList.remove('active', 'exiting');
        magLens.style.filter = 'none';
        magContainer.classList.remove('lens-active');
        lensFadeTimer = null;
    }, LENS_FADE_OUT_MS);
}

function triggerButtonBounce(button) {
    if (!button) return;
    button.classList.add('animated');
    setTimeout(() => button.classList.remove('animated'), BUTTON_BOUNCE_DURATION_MS);
}

// Syncs the background carousel to the image selected in the modal
function syncCarousel(filteredIndex, imgElement) {
    const track = imgElement.closest('.carousel-track');
    if (!track) return;

    // We need the index relative to ALL images in the track (including dimmed ones)
    const allImgsInTrack = Array.from(track.querySelectorAll('img'));
    const realIndex = allImgsInTrack.indexOf(imgElement);

    window.dispatchEvent(new CustomEvent('carousel:sync', {
        detail: { index: realIndex, track: track }
    }));
}

function performImageTransition(newImageElement, direction) {
    const slideOut = direction === 'next' ? '-60px' : '60px';
    const slideInStart = direction === 'next' ? '60px' : '-60px';

    modalImg.style.transition = 'transform 200ms ease-in, opacity 200ms';
    modalImg.style.transform = `translateX(${slideOut})`;
    modalImg.style.opacity = '0';

    setTimeout(() => {
        modalImg.style.transition = 'none';
        modalImg.style.transform = `translateX(${slideInStart})`;

        modalImg.src = newImageElement.src;
        modalImg.alt = newImageElement.alt;
        descriptionTitle.textContent = newImageElement.alt;
        descriptionText.textContent = newImageElement.getAttribute('data-desc') || "No description available.";
        descriptionMeta.innerHTML = `Date: ${newImageElement.getAttribute('data-date') || "N/A"}`;

        requestAnimationFrame(() => {
            modalImg.style.transition = 'transform 250ms cubic-bezier(0.17, 0.67, 0.83, 0.67), opacity 200ms';
            modalImg.style.transform = 'translateX(0)';
            modalImg.style.opacity = '1';
            if (modalImg.complete) setTimeout(updateMagnifierSize, 50);
        });
    }, 200);
}

function updateModalContent(imgElement, direction) {
    performImageTransition(imgElement, direction);
    modalPrevBtn.disabled = (currentImageIndex === 0);
    modalNextBtn.disabled = (currentImageIndex === currentSectionImages.length - 1);
}

function openModal(imgElement) {
    const sectionWrapper = imgElement.closest('.carousel-wrapper');
    const track = sectionWrapper ? sectionWrapper.querySelector('.carousel-track') : null;

    // FILTER: Only include images that are NOT dimmed by search
    if (track) {
        currentSectionImages = Array.from(track.querySelectorAll('img')).filter(img => {
            return !img.classList.contains('search-dim');
        });
    } else {
        currentSectionImages = [imgElement];
    }

    currentImageIndex = currentSectionImages.indexOf(imgElement);
    if (currentImageIndex === -1) currentImageIndex = 0;

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    modalImg.src = imgElement.src;
    modalImg.alt = imgElement.alt;
    modalImg.style.transform = 'translateX(0)';
    modalImg.style.opacity = 1;

    descriptionTitle.textContent = imgElement.alt;
    descriptionText.textContent = imgElement.getAttribute('data-desc') || "No description available.";
    descriptionMeta.innerHTML = `Date: ${imgElement.getAttribute('data-date') || "N/A"}`;

    modalPrevBtn.disabled = (currentImageIndex === 0);
    modalNextBtn.disabled = (currentImageIndex === currentSectionImages.length - 1);

    magContainer.addEventListener('mouseenter', showLens);
    magContainer.addEventListener('mouseleave', hideLens);
    magContainer.addEventListener('mousemove', handleMagnify);
    window.addEventListener('resize', updateMagnifierSize);
    modalPrevBtn.addEventListener('click', showPrev);
    modalNextBtn.addEventListener('click', showNext);
    document.addEventListener('keydown', handleKeyNavigation);

    if (modalImg.complete) setTimeout(updateMagnifierSize, 50);
}

function showPrev() {
    if (currentImageIndex > 0) {
        triggerButtonBounce(modalPrevBtn);
        currentImageIndex--;
        const img = currentSectionImages[currentImageIndex];
        updateModalContent(img, 'prev');
        syncCarousel(currentImageIndex, img);
    }
}

function showNext() {
    if (currentImageIndex < currentSectionImages.length - 1) {
        triggerButtonBounce(modalNextBtn);
        currentImageIndex++;
        const img = currentSectionImages[currentImageIndex];
        updateModalContent(img, 'next');
        syncCarousel(currentImageIndex, img);
    }
}

function handleKeyNavigation(e) {
    if (modal.style.display === 'flex') {
        if (e.key === 'ArrowLeft') showPrev();
        if (e.key === 'ArrowRight') showNext();
        if (e.key === 'Escape') closeLightbox();
    }
}

function updateMagnifierSize() {
    // Kept for resize hooks; lens rendering is fully canvas-driven.
}

function handleMagnify(e) {
    ensureLensCanvas();
    if (!lensCtx || !modalImg || !modalImg.naturalWidth || !modalImg.naturalHeight) return;

    const rect = magContainer.getBoundingClientRect();
    const imageRect = modalImg.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    // Move highlight/refraction layers with cursor position.
    const px = Math.max(0, Math.min(100, (x / rect.width) * 100));
    const py = Math.max(0, Math.min(100, (y / rect.height) * 100));
    magLens.style.setProperty('--pointer-x', `${px.toFixed(2)}%`);
    magLens.style.setProperty('--pointer-y', `${py.toFixed(2)}%`);
    const imageX = e.clientX - imageRect.left;
    const imageY = e.clientY - imageRect.top;

    // Let the lens reveal slightly past image edges, then fade away.
    const outsideLeft = Math.max(0, -imageX);
    const outsideRight = Math.max(0, imageX - imageRect.width);
    const outsideTop = Math.max(0, -imageY);
    const outsideBottom = Math.max(0, imageY - imageRect.height);
    const outsideDistance = Math.max(outsideLeft, outsideRight, outsideTop, outsideBottom);

    if (outsideDistance >= EDGE_REVEAL_BUFFER_PX) {
        magLens.style.opacity = 0;
        return;
    }

    if (outsideDistance > 0) {
        const t = outsideDistance / EDGE_REVEAL_BUFFER_PX; // 0..1
        magLens.style.opacity = (1 - ((1 - EDGE_REVEAL_MIN_OPACITY) * t)).toFixed(3);
    } else {
        magLens.style.opacity = 1;
    }

    // Keep lens motion directly tied to cursor for stable behavior.
    magLens.style.left = `${x}px`;
    magLens.style.top = `${y}px`;
    magLens.style.transform = `translate(-${lensRadius}px, -${lensRadius}px)`;

    // Render zoom via transform-based draw to avoid edge stretching artifacts.
    const drawW = imageRect.width * zoomFactor;
    const drawH = imageRect.height * zoomFactor;
    const drawX = lensRadius - (imageX * zoomFactor);
    const drawY = lensRadius - (imageY * zoomFactor);

    lensCtx.clearRect(0, 0, lensDiameter, lensDiameter);
    lensCtx.imageSmoothingEnabled = true;

    // Glassy fallback shown in areas where the zoom image has no pixels.
    const bgLinear = lensCtx.createLinearGradient(0, 0, 0, lensDiameter);
    bgLinear.addColorStop(0, 'rgba(231, 244, 255, 0.10)');
    bgLinear.addColorStop(0.48, 'rgba(107, 152, 200, 0.09)');
    bgLinear.addColorStop(1, 'rgba(20, 39, 64, 0.14)');
    lensCtx.fillStyle = bgLinear;
    lensCtx.fillRect(0, 0, lensDiameter, lensDiameter);

    const rimShade = lensCtx.createRadialGradient(
        lensRadius, lensRadius, lensRadius * 0.64,
        lensRadius, lensRadius, lensRadius
    );
    rimShade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    rimShade.addColorStop(1, 'rgba(8, 16, 28, 0.16)');
    lensCtx.fillStyle = rimShade;
    lensCtx.fillRect(0, 0, lensDiameter, lensDiameter);

    lensCtx.drawImage(modalImg, drawX, drawY, drawW, drawH);
}

function closeLightbox() {
    if (lensFadeTimer) {
        clearTimeout(lensFadeTimer);
        lensFadeTimer = null;
    }

    modal.style.display = "none";
    document.body.style.overflow = "auto";
    magLens.style.opacity = 0;
    magLens.style.filter = 'none';
    magLens.classList.remove('active', 'exiting');
    magContainer.classList.remove('lens-active');
    magContainer.removeEventListener('mouseenter', showLens);
    magContainer.removeEventListener('mouseleave', hideLens);
    magContainer.removeEventListener('mousemove', handleMagnify);
    window.removeEventListener('resize', updateMagnifierSize);
    modalPrevBtn.removeEventListener('click', showPrev);
    modalNextBtn.removeEventListener('click', showNext);
    document.removeEventListener('keydown', handleKeyNavigation);
}

document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.carousel-track img').forEach(img => {
        img.addEventListener('click', (e) => {
            // If the image is dimmed, don't allow opening the modal
            if (img.classList.contains('search-dim')) return;
            e.stopPropagation();
            openModal(img);
        });
    });
    closeModal.addEventListener('click', closeLightbox);
    modal.addEventListener('click', (e) => { if (e.target.id === 'image-modal') closeLightbox(); });

    // Sidebar & Scroll Logic
    const navLinks = document.querySelectorAll('.sidebar nav a');
    const sections = Array.from(navLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(n => n.classList.toggle('active', n.getAttribute('href') === '#' + entry.target.id));
            }
        });
    }, { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0 });
    sections.forEach(s => observer.observe(s));

    navLinks.forEach(a => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');
            if (!href.startsWith('#')) return;
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => { target.setAttribute('tabindex', '-1'); target.focus({ preventScroll: true }); }, 400);
            }
        });
    });
});

/* Keyboard Focus Logic */
(function() {
    let lastInteraction = 'mouse';
    document.addEventListener('keydown', (e) => { if (e.key === 'Tab') lastInteraction = 'keyboard'; }, { capture: true });
    document.addEventListener('mousedown', () => { lastInteraction = 'mouse'; }, { capture: true });
    document.querySelectorAll('.glass').forEach(glass => {
        glass.addEventListener('focusin', () => { if (lastInteraction === 'keyboard') glass.classList.add('show-arrows'); });
        glass.addEventListener('focusout', () => { setTimeout(() => { if (!glass.contains(document.activeElement)) glass.classList.remove('show-arrows'); }, 0); });
    });
})();
