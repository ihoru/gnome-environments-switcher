// A modal that fills the viewport; the browser stays on the same page.
export function createScreenshotViewer(navigate) {
  const dialog = document.createElement('dialog');
  dialog.className = 'screenshot-viewer';
  dialog.setAttribute('aria-labelledby', 'viewer-title');
  dialog.innerHTML = `
    <header class="viewer-toolbar">
      <div><h2 id="viewer-title" aria-live="polite"></h2><p id="viewer-help">← / → / Space: change picture · Scroll to zoom · Drag to pan · Esc to close</p></div>
      <div class="viewer-controls">
        <button type="button" data-action="out" aria-label="Zoom out">−</button>
        <output aria-label="Zoom level">100%</output>
        <button type="button" data-action="in" aria-label="Zoom in">+</button>
        <button type="button" data-action="reset">Fit</button>
        <button type="button" data-action="close" autofocus aria-label="Close screenshot">Close ×</button>
      </div>
    </header>
    <div class="viewer-viewport" tabindex="0" aria-label="Screenshot. Scroll to zoom; drag to pan; Left, Right or Space to change picture." aria-describedby="viewer-help">
      <div class="viewer-canvas"><img alt="" draggable="false" /></div>
    </div>`;
  document.body.append(dialog);
  const viewport = dialog.querySelector('.viewer-viewport');
  const canvas = dialog.querySelector('.viewer-canvas');
  const image = dialog.querySelector('img');
  const output = dialog.querySelector('output');
  let zoom = 1;
  let baseWidth = 1;
  let baseHeight = 1;
  let trigger;
  let oldOverflow;
  let drag;
  let currentSource;
  let animation;

  function render() {
    image.style.width = `${baseWidth * zoom}px`;
    image.style.height = `${baseHeight * zoom}px`;
    canvas.style.width = `${Math.max(viewport.clientWidth, baseWidth * zoom)}px`;
    canvas.style.height = `${Math.max(viewport.clientHeight, baseHeight * zoom)}px`;
    output.value = `${Math.round(zoom * 100)}%`;
    dialog.querySelector('[data-action="out"]').disabled = zoom === 1;
    dialog.querySelector('[data-action="in"]').disabled = zoom === 8;
    viewport.classList.toggle('zoomed', zoom > 1);
  }

  function fit() {
    const ratio = Math.min(
      viewport.clientWidth / currentSource.naturalWidth,
      viewport.clientHeight / currentSource.naturalHeight,
      1,
    );
    baseWidth = currentSource.naturalWidth * ratio;
    baseHeight = currentSource.naturalHeight * ratio;
    zoom = 1;
    render();
    viewport.scrollTo(0, 0);
  }

  function scale(factor, x = viewport.clientWidth / 2, y = viewport.clientHeight / 2) {
    const before = image.getBoundingClientRect();
    const bounds = viewport.getBoundingClientRect();
    const imageX = (bounds.left + x - before.left) / zoom;
    const imageY = (bounds.top + y - before.top) / zoom;
    zoom = Math.max(1, Math.min(8, zoom * factor));
    render();
    viewport.scrollLeft =
      Math.max(0, (viewport.clientWidth - baseWidth * zoom) / 2) + imageX * zoom - x;
    viewport.scrollTop =
      Math.max(0, (viewport.clientHeight - baseHeight * zoom) / 2) + imageY * zoom - y;
  }

  dialog.addEventListener('click', (event) => {
    const action = event.target.closest('button')?.dataset.action;
    if (action === 'close') dialog.close();
    if (action === 'reset') fit();
    if (action === 'in') scale(1.25);
    if (action === 'out') scale(0.8);
  });
  viewport.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      const bounds = viewport.getBoundingClientRect();
      if (event.deltaY)
        scale(
          event.deltaY < 0 ? 1.15 : 1 / 1.15,
          event.clientX - bounds.left,
          event.clientY - bounds.top,
        );
    },
    { passive: false },
  );
  viewport.addEventListener('pointerdown', (event) => {
    // Touch uses the scroll container's native panning.
    if (event.pointerType === 'touch' || event.button !== 0 || zoom === 1) return;
    drag = {
      x: event.clientX,
      y: event.clientY,
      left: viewport.scrollLeft,
      top: viewport.scrollTop,
    };
    viewport.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  viewport.addEventListener('pointermove', (event) => {
    if (!drag) return;
    viewport.scrollLeft = drag.left + drag.x - event.clientX;
    viewport.scrollTop = drag.top + drag.y - event.clientY;
  });
  viewport.addEventListener('lostpointercapture', () => {
    drag = null;
  });
  dialog.addEventListener('keydown', (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (['ArrowLeft', 'ArrowRight', ' '].includes(event.key)) {
      event.preventDefault();
      const direction = event.key === 'ArrowLeft' ? -1 : 1;
      const next = navigate(direction);
      if (next) showImage(next.source, next.title, next.opener, direction);
      return;
    }
    if (['+', '=', '-', '0'].includes(event.key)) {
      event.preventDefault();
      if (event.key === '0') fit();
      else scale(event.key === '-' ? 0.8 : 1.25);
    }
  });
  dialog.addEventListener('close', () => {
    animation?.cancel();
    document.body.style.overflow = oldOverflow;
    drag = null;
    trigger?.focus({ preventScroll: true });
  });
  window.addEventListener('resize', () => {
    if (dialog.open) fit();
  });

  function showImage(source, title, opener, direction = 0) {
    animation?.cancel();
    drag = null;
    currentSource = source;
    trigger = opener;
    dialog.querySelector('h2').textContent = title;
    image.alt = source.alt;
    image.src = source.currentSrc || source.src;
    fit();
    if (direction && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation = image.animate(
        [
          { opacity: 0, transform: `translateX(${direction * 24}px)` },
          { opacity: 1, transform: 'translateX(0)' },
        ],
        { duration: 160, easing: 'ease-out' },
      );
    }
  }

  return (source, title, opener) => {
    oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    // Use the gallery's loaded dimensions, including during rapid navigation.
    showImage(source, title, opener);
  };
}
