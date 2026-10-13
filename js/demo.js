/* Demo page helpers: fullscreen / immersive mode for the WebGL stage, plus an
   optional touch-to-mouse bridge for demos that rotate by dragging.
   Classic script (deferred) so it never competes with a demo's own window.onload. */

(function () {
  'use strict';

  // Hide "loading" overlays once everything (including large textures) has arrived.
  window.addEventListener('load', function () {
    document.querySelectorAll('[data-loading]').forEach(function (el) { el.hidden = true; });
  });

  var workspace = document.querySelector('[data-workspace]');
  var button = document.querySelector('[data-fullscreen]');

  if (workspace && button) {
    var label = button.querySelector('[data-fs-label]') || button;
    var apiAvailable = !!(document.fullscreenEnabled || document.webkitFullscreenEnabled);

    var currentFullscreenElement = function () {
      return document.fullscreenElement || document.webkitFullscreenElement || null;
    };

    var setImmersive = function (on) {
      workspace.classList.toggle('is-immersive', on);
      document.body.classList.toggle('demo-immersive-lock', on);
      button.setAttribute('aria-pressed', on ? 'true' : 'false');
      label.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
    };

    var enter = function () {
      var request = workspace.requestFullscreen || workspace.webkitRequestFullscreen;
      if (apiAvailable && request) {
        try {
          var result = request.call(workspace);
          if (result && typeof result.catch === 'function') {
            // Fullscreen refused (e.g. inside an iframe): fall back to a page-filling view.
            result.catch(function () { setImmersive(true); });
          }
          return;
        } catch (err) { /* fall through to the page-filling view */ }
      }
      // iPhone Safari has no element fullscreen: use a page-filling view instead.
      setImmersive(true);
    };

    var exit = function () {
      if (currentFullscreenElement()) {
        (document.exitFullscreen || document.webkitExitFullscreen).call(document);
      } else {
        setImmersive(false);
      }
    };

    button.addEventListener('click', function () {
      if (workspace.classList.contains('is-immersive')) exit(); else enter();
    });

    var onFullscreenChange = function () {
      setImmersive(currentFullscreenElement() === workspace);
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    document.addEventListener('keydown', function (e) {
      // Native fullscreen handles Escape itself; this covers the page-filling fallback.
      if (e.key === 'Escape' && workspace.classList.contains('is-immersive') && !currentFullscreenElement()) {
        setImmersive(false);
      }
    });
  }

  // Touch-drag -> the mouse events the demo already listens for.
  var draggable = document.querySelector('canvas[data-touch-drag]');
  if (draggable) {
    var send = function (type, target, point) {
      target.dispatchEvent(new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: point.clientX,
        clientY: point.clientY
      }));
    };

    draggable.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      send('mousedown', draggable, e.touches[0]);
      e.preventDefault();
    }, { passive: false });

    draggable.addEventListener('touchmove', function (e) {
      if (e.touches.length !== 1) return;
      send('mousemove', draggable, e.touches[0]);
      e.preventDefault();
    }, { passive: false });

    var end = function (e) {
      var point = (e.changedTouches && e.changedTouches[0]) || { clientX: 0, clientY: 0 };
      send('mouseup', window, point);
    };
    draggable.addEventListener('touchend', end);
    draggable.addEventListener('touchcancel', end);
  }
})();
