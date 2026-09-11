// Keep this list in sync with src/projectInfo.js; a parity test enforces it.
export const PRODUCTIVITY_MESSAGES = Object.freeze([
  'Your next task called. It would like fewer tabs and more attention.',
  'May your focus be strong and your notifications unusually quiet.',
  'Procrastination has excellent timing. Start before it arrives.',
  'One small finished task beats ten beautifully organized intentions.',
  'Your browser has enough tabs. Give your next idea a little room.',
  'May your workday include real progress, a good break, and a clear stopping point.',
  'Focus mode: doing the thing instead of researching how to do the thing.',
  'You don’t need a perfect start. Just give the next step five honest minutes.',
  'Be kind to your future self: finish one thing before opening three more.',
  'May your coffee stay warm and your ‘quick check’ stay quick.',
]);

export function startEncouragement(
  container,
  {
    random = Math.random,
    document: doc = document,
    clock = globalThis,
    reducedMotion = matchMedia('(prefers-reduced-motion: reduce)'),
  } = {},
) {
  const active = doc.createElement('span');
  active.className = 'quote-text';
  container.replaceChildren(active);
  for (const message of PRODUCTIVITY_MESSAGES) {
    const sizing = doc.createElement('span');
    sizing.className = 'quote-size';
    sizing.setAttribute('aria-hidden', 'true');
    sizing.textContent = `“${message}”`;
    container.append(sizing);
  }
  let selected = Math.floor(random() * PRODUCTIVITY_MESSAGES.length);
  const render = () => {
    active.textContent = `“${PRODUCTIVITY_MESSAGES[selected]}”`;
  };
  render();
  let interval;
  let fade;
  const rotate = () => {
    const next = Math.floor(random() * (PRODUCTIVITY_MESSAGES.length - 1));
    selected = next >= selected ? next + 1 : next;
    if (reducedMotion.matches) {
      render();
      return;
    }
    active.classList.add('is-fading');
    fade = clock.setTimeout(() => {
      render();
      active.classList.remove('is-fading');
      fade = undefined;
    }, 200);
  };
  const pause = () => {
    clock.clearInterval(interval);
    clock.clearTimeout(fade);
    active.classList.remove('is-fading');
    render();
  };
  const sync = () => {
    pause();
    if (!doc.hidden) interval = clock.setInterval(rotate, 30_000);
  };
  doc.addEventListener('visibilitychange', sync);
  sync();
  return () => {
    pause();
    doc.removeEventListener('visibilitychange', sync);
  };
}
