/* hover.js — pointer-reactive hover + tilt for carousel images
   - only runs on devices that support hover/pointer fine
   - respects prefers-reduced-motion
*/

(function () {
    // Feature detection and user-preference checks
    const canHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!canHover || reduceMotion) return;

    // Config: tweak these to taste
    const MAX_TILT_DEG = 6;        // max rotation degrees for tilt
    const MAX_TRANSLATE = 10;      // px translation for subtle parallax
    const SCALE_ON_HOVER = 1.06;   // scale when hovered/lifted
    const RELEASE_DURATION = 300;  // ms to animate back on mouseleave

    // Utility: clamp
    const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

    // Apply handlers to images inside tracks; use event delegation if you prefer
    const images = Array.from(document.querySelectorAll('.carousel-track img'));

    // We'll use RAF to throttle transform updates
    images.forEach(img => {
        let raf = null;
        let rect = null;
        let isHovering = false;

        // When pointer enters: prepare
        const onEnter = (e) => {
            isHovering = true;
            rect = img.getBoundingClientRect();
            img.classList.add('img-hover-lift', 'img-hover-active');
            // ensure we have GPU compositing
            img.style.transform = `translateZ(0) scale(${SCALE_ON_HOVER})`;
            // small immediate style tweak so the first move feels responsive
        };

        // Pointer move: compute position relative to center and apply small tilt/translate
        const onMove = (e) => {
            if (!isHovering) return;
            if (raf) cancelAnimationFrame(raf);

            const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0]?.clientX) || 0;
            const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0]?.clientY) || 0;

            raf = requestAnimationFrame(() => {
                if (!rect) rect = img.getBoundingClientRect();

                const px = (clientX - rect.left) / rect.width;  // 0..1
                const py = (clientY - rect.top) / rect.height;  // 0..1

                // normalized -0.5 .. 0.5
                const nx = (px - 0.5);
                const ny = (py - 0.5);

                // tilt: rotateX by vertical movement, rotateY by horizontal movement (invert appropriately)
                const rotX = clamp(-ny * MAX_TILT_DEG, -MAX_TILT_DEG, MAX_TILT_DEG);
                const rotY = clamp(nx * MAX_TILT_DEG, -MAX_TILT_DEG, MAX_TILT_DEG);

                // translation: subtle shift so the artwork "follows" the cursor
                const transX = clamp(-nx * MAX_TRANSLATE, -MAX_TRANSLATE, MAX_TRANSLATE);
                const transY = clamp(-ny * MAX_TRANSLATE, -MAX_TRANSLATE, MAX_TRANSLATE);

                // Compose transform: scale (from lift), then rotate and translate
                img.style.transform = `translate3d(${transX}px, ${transY}px, 0) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${SCALE_ON_HOVER})`;
            });
        };

        // On leave: smoothly reset transforms
        const onLeave = () => {
            isHovering = false;
            if (raf) cancelAnimationFrame(raf);
            img.classList.remove('img-hover-active');

            // animate back to identity
            img.style.transition = `transform ${RELEASE_DURATION}ms cubic-bezier(.2,.9,.25,1), box-shadow ${RELEASE_DURATION}ms`;
            img.style.transform = ''; // clears inline transform, CSS fallback (none) applies

            // remove lift class after transition finishes to remove shadow/z-index
            const cleanup = () => {
                img.classList.remove('img-hover-lift');
                img.style.transition = ''; // restore default CSS transition
                img.removeEventListener('transitionend', cleanup);
            };
            img.addEventListener('transitionend', cleanup);
        };

        // Use pointer events for best compatibility (handles mouse and stylus)
        img.addEventListener('pointerenter', onEnter);
        img.addEventListener('pointermove', onMove);
        img.addEventListener('pointerleave', onLeave);
        img.addEventListener('pointercancel', onLeave);

        // If your carousel uses touch-drag, we avoid interfering by ignoring pointer moves if pointerType === 'touch'
        img.addEventListener('pointermove', (ev) => {
            if (ev.pointerType === 'touch') {
                // ignore touch moves — prevents conflict with swipe/drag
                return;
            }
        });
    });
})();
