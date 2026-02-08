/* --- Carousel Script (modified to support external reorders) --- */
document.querySelectorAll('.carousel-wrapper').forEach(wrapper=>{
    const track = wrapper.querySelector('.carousel-track');
    const leftBtn = wrapper.querySelector('.arrow.left');
    const rightBtn = wrapper.querySelector('.arrow.right');

    // make imgs mutable so we can rebuild when search.js reorders the DOM
    let imgs = Array.from(track.querySelectorAll('img'));

    imgs.forEach((img, i) => { img.setAttribute('data-index', i); });

    if (!track || imgs.length === 0) return;

    let index = 0;

    function slideSize(){
        const gap = parseFloat(getComputedStyle(track).gap) || 30;
        // fallback if no images
        if (!imgs[0]) return 0;
        return imgs[0].getBoundingClientRect().width + gap;
    }

    function update() {
        // Refresh the image array in case search.js filtered them
        imgs = Array.from(track.querySelectorAll('img'));
        imgs.forEach((img, i) => { img.setAttribute('data-index', i); });

        if (imgs.length === 0) return;

        const s = slideSize();
        const container = wrapper.querySelector('.carousel-container');
        const containerWidth = container.getBoundingClientRect().width;

        // Boundary check
        if (index > imgs.length - 1) index = imgs.length - 1;
        if (index < 0) index = 0;

        // Calculate center: (Half of container) - (Half of the current image)
        const currentImgWidth = imgs[index].getBoundingClientRect().width;
        const offset = (containerWidth / 2) - (currentImgWidth / 2);

        // Apply the translation
        track.style.transform = `translateX(${-(index * s) + offset}px)`;

        // Apply classes for scaling effects
        imgs.forEach((im, i) => {
            im.classList.remove('center', 'side');
            if (i === index) {
                im.classList.add('center');
            } else {
                im.classList.add('side');
            }
        });

        // Button states
        if (leftBtn) leftBtn.disabled = (index === 0);
        if (rightBtn) rightBtn.disabled = (index === imgs.length - 1);
    }

    // Listen for carousel:reorder events and refresh this wrapper when its track was reordered.
    // Listen for carousel:reorder events
    window.addEventListener('carousel:reorder', (e) => {
        try {
            // Check if we should snap back to the first image
            if (e.detail && e.detail.resetIndex) {
                index = 0;
            }

            if (!e || !e.detail) {
                imgs = Array.from(track.querySelectorAll('img'));
                update();
                return;
            }

            if (e.detail.track) {
                if (e.detail.track === track) {
                    imgs = Array.from(track.querySelectorAll('img'));
                    update();
                }
            } else {
                imgs = Array.from(track.querySelectorAll('img'));
                update();
            }
        } catch (err) {
            imgs = Array.from(track.querySelectorAll('img'));
            update();
        }
    });

    if (leftBtn) leftBtn.addEventListener('click', ()=>{ if (index>0) { index--; update(); }});
    if (rightBtn) rightBtn.addEventListener('click', ()=>{ if (index < imgs.length - 1) { index++; update(); }});

    wrapper.setAttribute('tabindex', '0');
    wrapper.addEventListener('keydown', (e)=>{
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

    window.addEventListener('resize', ()=>setTimeout(update, 90));
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

function showLens() { magLens.style.opacity = 1; }
function hideLens() { magLens.style.opacity = 0; }

function preloadImage(index) {
    if (index >= 0 && index < currentSectionImages.length) {
        const imgElement = currentSectionImages[index];
        const tempImg = new Image();
        tempImg.src = imgElement.src;
    }
}

function performImageTransition(newImageElement, direction) {
    // 1. Set the slide distances to match the gallery's "Quick Slide"
    const slideOut = direction === 'next' ? '-60px' : '60px';
    const slideInStart = direction === 'next' ? '60px' : '-60px';

    // 2. Phase 1: Slide Out & Fade
    modalImg.style.transition = 'transform 200ms ease-in, opacity 200ms';
    modalImg.style.transform = `translateX(${slideOut})`;
    modalImg.style.opacity = '0';

    setTimeout(() => {
        // 3. Swap Content while the image is invisible
        modalImg.style.transition = 'none';
        modalImg.style.transform = `translateX(${slideInStart})`;

        modalImg.src = newImageElement.src;
        modalImg.alt = newImageElement.alt;

        // Update text/meta (Home page data-attributes)
        descriptionTitle.textContent = newImageElement.alt;
        const descText = newImageElement.getAttribute('data-desc') || "No description available.";
        descriptionText.textContent = descText;
        const artworkDate = newImageElement.getAttribute('data-date') || "N/A";
        descriptionMeta.innerHTML = `Date: ${artworkDate}`;

        // Update Magnifier Background
        if (magLens) magLens.style.backgroundImage = `url('${newImageElement.src}')`;

        // 4. Phase 2: Slide In with the "Snappy" cubic-bezier easing
        requestAnimationFrame(() => {
            modalImg.style.transition = 'transform 250ms cubic-bezier(0.17, 0.67, 0.83, 0.67), opacity 200ms';
            modalImg.style.transform = 'translateX(0)';
            modalImg.style.opacity = '1';

            if (modalImg.complete) {
                setTimeout(updateMagnifierSize, 50);
            }
        });
    }, 200); // 200ms matches the Gallery speed
}

function updateModalContent(imgElement, direction) {
    performImageTransition(imgElement, direction);
    modalPrevBtn.disabled = (currentImageIndex === 0);
    modalNextBtn.disabled = (currentImageIndex === currentSectionImages.length - 1);
    preloadImage(currentImageIndex + 1);
    preloadImage(currentImageIndex - 1);
}

function openModal(imgElement) {
    const sectionWrapper = imgElement.closest('.carousel-wrapper');
    const track = sectionWrapper ? sectionWrapper.querySelector('.carousel-track') : null;
    currentSectionImages = track ? Array.from(track.querySelectorAll('img')) : [imgElement];

    currentImageIndex = parseInt(imgElement.getAttribute('data-index')) || 0;

    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    modalImg.src = imgElement.src;
    modalImg.alt = imgElement.alt;
    magLens.style.backgroundImage = `url('${imgElement.src}')`;
    modalImg.style.left = '0';
    modalImg.style.opacity = 1;

    descriptionTitle.textContent = imgElement.alt;
    const descText = imgElement.getAttribute('data-desc') || "No detailed description available for this piece.";
    descriptionText.textContent = descText;

    const artworkDate = imgElement.getAttribute('data-date') || "N/A";
    descriptionMeta.innerHTML = `Date: ${artworkDate}`;

    modalPrevBtn.disabled = (currentImageIndex === 0);
    modalNextBtn.disabled = (currentImageIndex === currentSectionImages.length - 1);

    magContainer.addEventListener('mouseenter', showLens);
    magContainer.addEventListener('mouseleave', hideLens);
    magContainer.addEventListener('mousemove', handleMagnify);
    window.addEventListener('resize', updateMagnifierSize);

    modalPrevBtn.addEventListener('click', showPrev);
    modalNextBtn.addEventListener('click', showNext);
    document.addEventListener('keydown', handleKeyNavigation);

    if (modalImg.complete) {
        setTimeout(updateMagnifierSize, 50);
    }

    preloadImage(currentImageIndex + 1);
    preloadImage(currentImageIndex - 1);
}

function showPrev() {
    if (currentImageIndex > 0) {
        currentImageIndex--;
        updateModalContent(currentSectionImages[currentImageIndex], 'prev');
    }
}

function showNext() {
    if (currentImageIndex < currentSectionImages.length - 1) {
        currentImageIndex++;
        updateModalContent(currentSectionImages[currentImageIndex], 'next');
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
    const largeSizeX = modalImg.clientWidth * zoomFactor;
    const largeSizeY = modalImg.clientHeight * zoomFactor;
    magLens.style.backgroundSize = `${largeSizeX}px ${largeSizeY}px`;
    magLens.style.opacity = 0;
}

function handleMagnify(e) {
    const rect = magContainer.getBoundingClientRect();
    let x = e.clientX - rect.left;
    let y = e.clientY - rect.top;

    magLens.style.left = `${x}px`;
    magLens.style.top = `${y}px`;
    magLens.style.transform = `translate(-${lensRadius}px, -${lensRadius}px)`;

    let backgroundX = x * zoomFactor - lensRadius;
    let backgroundY = y * zoomFactor - lensRadius;

    magLens.style.backgroundPosition = `-${backgroundX}px -${backgroundY}px`;
}

function closeLightbox() {
    modal.style.display = "none";
    document.body.style.overflow = "auto";

    magContainer.removeEventListener('mouseenter', showLens);
    magContainer.removeEventListener('mouseleave', hideLens);
    magContainer.removeEventListener('mousemove', handleMagnify);
    window.removeEventListener('resize', updateMagnifierSize);
    modalPrevBtn.removeEventListener('click', showPrev);
    modalNextBtn.removeEventListener('click', showNext);
    document.removeEventListener('keydown', handleKeyNavigation);

    magLens.style.opacity = 0;
}

/* Attach handlers when DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.carousel-track img').forEach(img => {
        img.addEventListener('click', (e) => {
            e.stopPropagation();
            openModal(img);
        });
    });

    // close handlers
    closeModal.addEventListener('click', closeLightbox);
    modal.addEventListener('click', (e) => {
        if (e.target.id === 'image-modal') {
            closeLightbox();
        }
    });

    // Highlight nav links while scrolling (basic)
    const navLinks = document.querySelectorAll('.sidebar nav a');
    const sections = Array.from(navLinks).map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(n => n.classList.toggle('active', n.getAttribute('href') === '#' + entry.target.id));
        }
      });
    }, { root: null, rootMargin: '0px 0px -60% 0px', threshold: 0 });

    sections.forEach(s => { if (s) observer.observe(s); });

    // smooth scroll for nav links (center sections on screen)
// Updated smooth scroll for nav links
    navLinks.forEach(a => {
        a.addEventListener('click', (e) => {
            const href = a.getAttribute('href');

            // If the link is a standard page link (doesn't start with #),
            // let the browser navigate normally.
            if (!href.startsWith('#')) {
                return;
            }

            // Otherwise, it's a scroll link for the current page
            e.preventDefault();
            const target = document.querySelector(href);
            if (!target) return;

            target.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                target.setAttribute('tabindex', '-1');
                target.focus({ preventScroll: true });
            }, 400);
        });
    });
});

/* Only reveal arrows on keyboard focus (Tab) — mouse clicks won't "stick" them visible */
(function() {
  let lastInteraction = 'mouse';

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') lastInteraction = 'keyboard';
  }, { capture: true });

  document.addEventListener('mousedown', () => { lastInteraction = 'mouse'; }, { capture: true });
  document.addEventListener('touchstart', () => { lastInteraction = 'mouse'; }, { capture: true });

  // Toggle .show-arrows on keyboard focusin/focusout
  document.querySelectorAll('.glass').forEach(glass => {
    glass.addEventListener('focusin', () => {
      if (lastInteraction === 'keyboard') glass.classList.add('show-arrows');
    });

    glass.addEventListener('focusout', () => {
      // allow focus to move to child elements (buttons) before removing
      setTimeout(() => {
        if (!glass.contains(document.activeElement)) glass.classList.remove('show-arrows');
      }, 0);
    });
  });
})();
