/* js/script.js
   Extracted from index.html
   Handles: carousels, modal/lightbox, magnifier, keyboard navigation,
   arrow visibility, and sidebar nav highlighting
*/

(() => {
  const zoomFactor = 2.5;
  const lensRadius = 90;

  let currentSectionImages = [];
  let currentImageIndex = 0;

  let modal, modalImg, descriptionTitle, descriptionText, descriptionMeta;
  let closeModal, magContainer, magLens, modalPrevBtn, modalNextBtn;

  /* ---------- Magnifier helpers ---------- */
  const showLens = () => magLens.style.opacity = 1;
  const hideLens = () => magLens.style.opacity = 0;

  function updateMagnifierSize() {
    magLens.style.backgroundSize =
      `${modalImg.clientWidth * zoomFactor}px ${modalImg.clientHeight * zoomFactor}px`;
    magLens.style.opacity = 0;
  }

  function handleMagnify(e) {
    const rect = magContainer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    magLens.style.left = `${x}px`;
    magLens.style.top = `${y}px`;
    magLens.style.transform = `translate(-${lensRadius}px, -${lensRadius}px)`;

    magLens.style.backgroundPosition =
      `-${x * zoomFactor - lensRadius}px -${y * zoomFactor - lensRadius}px`;
  }

  /* ---------- Modal logic ---------- */
  function preloadImage(i) {
    if (i >= 0 && i < currentSectionImages.length) {
      const img = new Image();
      img.src = currentSectionImages[i].src;
    }
  }

  function performImageTransition(img, dir) {
    const slideOut = dir === 'next' ? '-100%' : '100%';
    const resetPos = dir === 'next' ? '100%' : '-100%';

    modalImg.style.left = slideOut;
    modalImg.style.opacity = 0;

    setTimeout(() => {
      modalImg.style.transition = 'none';
      modalImg.style.left = resetPos;

      modalImg.src = img.src;
      modalImg.alt = img.alt;
      magLens.style.backgroundImage = `url('${img.src}')`;
      descriptionTitle.textContent = img.alt;
      descriptionText.textContent =
        img.dataset.desc || "No detailed description available.";
      descriptionMeta.innerHTML = `Date: ${img.dataset.date || "N/A"}`;

      requestAnimationFrame(() => {
        modalImg.style.transition = 'left 300ms ease-out, opacity 100ms';
        modalImg.style.left = '0';
        modalImg.style.opacity = 1;
        setTimeout(updateMagnifierSize, 50);
      });
    }, 300);
  }

  function openModal(img) {
    const track = img.closest('.carousel-track');
    currentSectionImages = track ? [...track.querySelectorAll('img')] : [img];
    currentImageIndex = +img.dataset.index || 0;

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    modalImg.src = img.src;
    modalImg.alt = img.alt;
    magLens.style.backgroundImage = `url('${img.src}')`;

    descriptionTitle.textContent = img.alt;
    descriptionText.textContent = img.dataset.desc || "No detailed description available.";
    descriptionMeta.innerHTML = `Date: ${img.dataset.date || "N/A"}`;

    modalPrevBtn.disabled = currentImageIndex === 0;
    modalNextBtn.disabled = currentImageIndex === currentSectionImages.length - 1;

    magContainer.addEventListener('mouseenter', showLens);
    magContainer.addEventListener('mouseleave', hideLens);
    magContainer.addEventListener('mousemove', handleMagnify);
    window.addEventListener('resize', updateMagnifierSize);

    document.addEventListener('keydown', handleKeyNav);
    preloadImage(currentImageIndex + 1);
    preloadImage(currentImageIndex - 1);
  }

  function closeLightbox() {
    modal.style.display = 'none';
    document.body.style.overflow = 'auto';

    magContainer.removeEventListener('mouseenter', showLens);
    magContainer.removeEventListener('mouseleave', hideLens);
    magContainer.removeEventListener('mousemove', handleMagnify);
    window.removeEventListener('resize', updateMagnifierSize);
    document.removeEventListener('keydown', handleKeyNav);
  }

  function handleKeyNav(e) {
    if (modal.style.display !== 'flex') return;
    if (e.key === 'Escape') closeLightbox();
    if (e.key === 'ArrowLeft' && currentImageIndex > 0)
      performImageTransition(currentSectionImages[--currentImageIndex], 'prev');
    if (e.key === 'ArrowRight' && currentImageIndex < currentSectionImages.length - 1)
      performImageTransition(currentSectionImages[++currentImageIndex], 'next');
  }

  /* ---------- Carousel logic ---------- */
  function initCarousels() {
    document.querySelectorAll('.carousel-wrapper').forEach(wrapper => {
      const track = wrapper.querySelector('.carousel-track');
      const imgs = [...track.querySelectorAll('img')];
      const left = wrapper.querySelector('.arrow.left');
      const right = wrapper.querySelector('.arrow.right');

      imgs.forEach((img, i) => img.dataset.index = i);
      let index = 0;

      const slideSize = () =>
        imgs[0].getBoundingClientRect().width +
        (parseFloat(getComputedStyle(track).gap) || 30);

      const update = () => {
        const offset =
          wrapper.querySelector('.carousel-container').offsetWidth / 2 -
          imgs[index].offsetWidth / 2;

        track.style.transform = `translateX(${-(index * slideSize()) + offset}px)`;
        imgs.forEach((img, i) =>
          img.classList.toggle('center', i === index)
        );
        if (left) left.disabled = index === 0;
        if (right) right.disabled = index === imgs.length - 1;
      };

      left?.addEventListener('click', () => index > 0 && (index--, update()));
      right?.addEventListener('click', () => index < imgs.length - 1 && (index++, update()));

      imgs.forEach(img =>
        img.addEventListener('click', e => {
          e.stopPropagation();
          openModal(img);
        })
      );

      window.addEventListener('resize', () => setTimeout(update, 80));
      setTimeout(update, 60);
    });
  }

  /* ---------- Arrow visibility (keyboard focus) ---------- */
  function initArrowVisibility() {
    let last = 'mouse';

    document.addEventListener('keydown', e => e.key === 'Tab' && (last = 'keyboard'), true);
    document.addEventListener('mousedown', () => last = 'mouse', true);
    document.addEventListener('touchstart', () => last = 'mouse', true);

    document.querySelectorAll('.glass').forEach(glass => {
      glass.addEventListener('focusin', () => {
        if (last === 'keyboard') glass.classList.add('show-arrows');
      });
      glass.addEventListener('focusout', () =>
        setTimeout(() => !glass.contains(document.activeElement) &&
          glass.classList.remove('show-arrows'), 0)
      );
    });
  }

  /* ---------- Init ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    modal = document.getElementById('image-modal');
    modalImg = document.getElementById('modal-image');
    descriptionTitle = document.getElementById('description-title');
    descriptionText = document.getElementById('description-text');
    descriptionMeta = document.getElementById('description-meta');
    closeModal = document.getElementById('modal-close-btn');
    magContainer = document.getElementById('magnifier-container');
    magLens = document.getElementById('magnifier-lens');
    modalPrevBtn = document.getElementById('modal-prev-btn');
    modalNextBtn = document.getElementById('modal-next-btn');

    initCarousels();
    initArrowVisibility();

    closeModal?.addEventListener('click', closeLightbox);
    modal?.addEventListener('click', e =>
      e.target.id === 'image-modal' && closeLightbox()
    );
  });
})();
