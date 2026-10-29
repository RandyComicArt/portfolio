const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PUNCH_MS = 420;

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function punchChance(jabs) {
  return jabs < 4 ? 0.05 : 0.1;
}

function timeoutChance(jabs) {
  return Math.min(0.1 + jabs * 0.045, 0.38);
}

function buildCombo() {
  const steps = [{ frame: 2 }];
  let last = 2;
  let jabs = 1;

  while (jabs < 16) {
    if (last === 2) {
      if (jabs >= 2 && Math.random() < timeoutChance(jabs)) {
        steps[steps.length - 1].timeout = true;
        break;
      }
      steps.push({ frame: 3 });
      last = 3;
      jabs += 1;
      continue;
    }

    if (Math.random() < punchChance(jabs)) {
      steps.push({ frame: 4 });
      break;
    }
    if (Math.random() < timeoutChance(jabs)) {
      steps[steps.length - 1].timeout = true;
      break;
    }

    steps.push({ frame: 2 });
    last = 2;
    jabs += 1;
  }

  if (last !== 4 && !steps[steps.length - 1].timeout && steps[steps.length - 1].frame !== 1) {
    steps[steps.length - 1].timeout = true;
  }
  return steps;
}

function holdFor(step) {
  if (step.frame === 4) return PUNCH_MS;
  if (step.frame === 1) return rand(180, 420);
  if (step.timeout) return rand(320, 520);
  if (Math.random() < 0.7) return rand(70, 120);
  return rand(140, 210);
}

function attachReflect(root) {
  if (!root.hasAttribute('data-reflect')) return [];
  const host = root.parentElement;
  if (!host) return [];
  const existing = host.querySelector(':scope > .pixel-loop.is-reflect');
  if (existing) return Array.from(existing.querySelectorAll('img'));
  const clone = root.cloneNode(true);
  clone.classList.add('is-reflect');
  clone.removeAttribute('data-reflect');
  clone.setAttribute('aria-hidden', 'true');
  root.insertAdjacentElement('afterend', clone);
  return Array.from(clone.querySelectorAll('img'));
}

export function mountPixelLoop(root) {
  if (root.classList.contains('is-reflect')) return;
  const frames = Array.from(root.querySelectorAll(':scope > img'));
  if (frames.length < 4) return;
  const reflectFrames = attachReflect(root);

  const stage = root.closest('.pixel-stage');
  const arrows = stage ? Array.from(stage.querySelectorAll('.pixel-arrow')) : [];
  let litArrow = null;

  const clearArrow = () => {
    litArrow?.classList.remove('is-blue');
    litArrow = null;
  };

  const lightRandomArrow = () => {
    if (!arrows.length) return;
    const pool = arrows.filter((arrow) => arrow !== litArrow);
    const pick = pool[Math.floor(Math.random() * pool.length)] || arrows[0];
    if (litArrow !== pick) {
      litArrow?.classList.remove('is-blue');
      pick.classList.add('is-blue');
      litArrow = pick;
    }
  };

  const show = (frame) => {
    frames.forEach((img, i) => img.classList.toggle('is-on', i === frame - 1));
    reflectFrames.forEach((img, i) => img.classList.toggle('is-on', i === frame - 1));
    if (stage) stage.dataset.frame = String(frame);
    if (frame === 1) clearArrow();
    else lightRandomArrow();
  };

  show(1);
  if (reduceMotion) return;

  let timer = 0;
  let stopped = false;
  root.classList.add('is-armed');

  const playCombo = () => {
    if (stopped) return;
    const combo = [{ frame: 1 }, ...buildCombo()];
    let i = 0;
    const step = () => {
      if (stopped) return;
      const current = combo[i];
      show(current.frame);
      i += 1;
      timer = window.setTimeout(() => {
        if (i < combo.length) step();
        else playCombo();
      }, holdFor(current));
    };
    step();
  };

  playCombo();

  if (!('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    const on = entries.some((entry) => entry.isIntersecting);
    if (!on) {
      stopped = true;
      window.clearTimeout(timer);
      show(1);
      return;
    }
    if (stopped) {
      stopped = false;
      playCombo();
    }
  }, { threshold: 0.2 });
  io.observe(root);
}

export function mountPixelLoops(scope = document) {
  scope.querySelectorAll('.pixel-loop:not(.is-reflect)').forEach(mountPixelLoop);
}

mountPixelLoops();
