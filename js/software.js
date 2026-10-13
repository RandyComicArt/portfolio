(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function armVideo(video) {
    video.controls = false;
    video.muted = true;
    video.defaultMuted = true;
    video.volume = 0;
    video.loop = true;
    video.autoplay = true;
    video.playsInline = true;
    video.setAttribute('muted', '');
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.removeAttribute('controls');
    video.disablePictureInPicture = true;
    if ('disableRemotePlayback' in video) video.disableRemotePlayback = true;
  }

  function playSafe(video) {
    armVideo(video);
    const play = video.play();
    if (play && typeof play.catch === 'function') play.catch(() => {});
  }

  function setupHost(host) {
    const video = host.querySelector('[data-cinematic-video]');
    const canvas = host.querySelector('[data-cinematic-stage]');
    if (!video) return;

    const ctx = canvas ? canvas.getContext('2d', { alpha: false }) : null;
    let drawing = false;
    let hold = false;
    let raf = 0;

    const resize = () => {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.max(1, Math.round(rect.width * dpr));
      const height = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
    };

    const drawContain = () => {
      if (!ctx || !canvas) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      if (video.readyState < 2 || !video.videoWidth) return;
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const dw = video.videoWidth * scale;
      const dh = video.videoHeight * scale;
      ctx.drawImage(video, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh);
    };

    const tick = () => {
      drawContain();
      raf = requestAnimationFrame(tick);
    };

    const startDraw = () => {
      if (!ctx || drawing || reduceMotion.matches) return;
      drawing = true;
      resize();
      tick();
    };

    const stopDraw = () => {
      drawing = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    };

    const markPlaying = () => {
      if (video.paused || reduceMotion.matches) return;
      host.classList.add('is-playing');
      startDraw();
    };

    const applyMotionPreference = () => {
      if (reduceMotion.matches) {
        hold = true;
        video.pause();
        stopDraw();
        host.classList.remove('is-playing');
        host.classList.add('is-static');
        return;
      }
      hold = false;
      host.classList.remove('is-static');
      playSafe(video);
      markPlaying();
    };

    armVideo(video);
    applyMotionPreference();
    reduceMotion.addEventListener('change', applyMotionPreference);

    ['loadedmetadata', 'loadeddata', 'canplay', 'canplaythrough', 'playing'].forEach((eventName) => {
      video.addEventListener(eventName, () => {
        if (reduceMotion.matches) return;
        playSafe(video);
        markPlaying();
      });
    });

    video.addEventListener('ended', () => {
      if (hold || reduceMotion.matches) return;
      video.currentTime = 0;
      playSafe(video);
    });

    video.addEventListener('pause', () => {
      if (hold || reduceMotion.matches || document.hidden) return;
      playSafe(video);
    });

    if (canvas && typeof ResizeObserver === 'function') {
      new ResizeObserver(resize).observe(canvas);
    }
    window.addEventListener('resize', resize);

    const unlock = () => {
      if (reduceMotion.matches) return;
      playSafe(video);
      markPlaying();
    };
    document.addEventListener('pointerdown', unlock, { passive: true });
    document.addEventListener('keydown', unlock);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) unlock();
    });

    if (typeof IntersectionObserver === 'function') {
      const io = new IntersectionObserver((entries) => {
        if (entries.some((entry) => entry.isIntersecting)) unlock();
      }, { threshold: 0.01 });
      io.observe(host);
    }
  }

  function pinStory() {
    const host = document.querySelector('.s3quence-story');
    const sticky = host?.querySelector('.s3quence-sticky');
    if (!host || !sticky) return;

    const update = () => {
      const rect = host.getBoundingClientRect();
      const view = window.innerHeight;
      sticky.classList.remove('is-pinned', 'is-ended');
      if (rect.top <= 0 && rect.bottom > view) {
        sticky.classList.add('is-pinned');
      } else if (rect.bottom <= view) {
        sticky.classList.add('is-ended');
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
  }

  document.querySelectorAll('[data-cinematic]').forEach(setupHost);
  pinStory();
})();
