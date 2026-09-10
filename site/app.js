import { media } from './media.js';
import { createScreenshotViewer } from './screenshotViewer.js';

const loadedScreenshots = new Map();
const openScreenshot = createScreenshotViewer((direction) => {
  const indexes = [...loadedScreenshots.keys()].sort((a, b) => a - b);
  if (indexes.length < 2) return null;
  const next = indexes[(indexes.indexOf(selected) + direction + indexes.length) % indexes.length];
  select(next);
  return loadedScreenshots.get(next);
});

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function placeholder(item, compact = false) {
  const node = element('div', compact ? 'thumbnail-placeholder' : 'media-placeholder');
  const symbol = element('span', compact ? '' : 'placeholder-icon', item.symbol);
  symbol.setAttribute('aria-hidden', 'true');
  node.append(symbol);
  if (!compact)
    node.append(element('p', '', 'Screenshot coming soon'), element('span', '', item.title));
  return node;
}

const gallery = document.querySelector('#gallery');
const slides = document.querySelector('#gallery-slides');
const thumbnails = document.querySelector('#thumbnails');
const status = document.querySelector('#gallery-status');
let selected = 0;
const buttons = [];
const figures = [];
let loadedImages = 0;

function select(index) {
  selected = (index + figures.length) % figures.length;
  figures.forEach((figure, i) => {
    figure.hidden = i !== selected;
  });
  buttons.forEach((button, i) => button.setAttribute('aria-pressed', String(i === selected)));
  status.textContent = `${selected + 1} / ${figures.length} — ${media.screenshots[selected].title}`;
  const button = buttons[selected];
  // Scroll only the thumbnail strip, without moving the page during selection.
  if (
    button.offsetLeft < thumbnails.scrollLeft ||
    button.offsetLeft + button.offsetWidth > thumbnails.scrollLeft + thumbnails.clientWidth
  )
    thumbnails.scrollLeft = button.offsetLeft - (thumbnails.clientWidth - button.offsetWidth) / 2;
}

if (media.screenshots.length) {
  slides.replaceChildren();
  media.screenshots.forEach((item, index) => {
    const figure = element('figure', 'gallery-slide');
    figure.id = `screenshot-${index + 1}`;
    figure.setAttribute('role', 'group');
    figure.setAttribute('aria-roledescription', 'slide');
    figure.setAttribute('aria-label', `${index + 1} of ${media.screenshots.length}: ${item.title}`);
    const stage = element('div', 'image-stage');
    stage.append(placeholder(item));
    const button = element('button', 'thumbnail');
    button.type = 'button';
    button.setAttribute('aria-label', `Show ${item.title}`);
    button.setAttribute('aria-controls', figure.id);
    button.append(
      placeholder(item, true),
      element('strong', '', item.title),
      element('span', '', item.label),
    );
    button.addEventListener('click', () => select(index));
    if (item.src) {
      const image = new Image();
      image.alt = item.alt;
      image.decoding = 'async';
      image.addEventListener(
        'load',
        () => {
          const opener = element('button', 'screenshot-open');
          opener.type = 'button';
          opener.setAttribute('aria-label', `Open ${item.title} fullscreen`);
          opener.append(image, element('span', 'screenshot-open-label', 'View fullscreen ⛶'));
          loadedScreenshots.set(index, { source: image, title: item.title, opener });
          opener.addEventListener('click', () => openScreenshot(image, item.title, opener));
          stage.replaceChildren(opener);
          if (++loadedImages === media.screenshots.length)
            document.querySelector('#screenshots-notice').hidden = true;
          const preview = image.cloneNode();
          preview.alt = '';
          button.firstChild.replaceWith(preview);
        },
        { once: true },
      );
      // A failed file keeps the intentional placeholder in both views.
      image.src = item.src;
    }
    const caption = element('figcaption');
    caption.append(element('strong', '', item.title), element('span', '', item.caption));
    figure.append(stage, caption);
    figures.push(figure);
    buttons.push(button);
    slides.append(figure);
    thumbnails.append(button);
  });
  thumbnails.hidden = false;
  document.querySelector('#gallery-toolbar').hidden = false;
  document.querySelector('#previous').addEventListener('click', () => select(selected - 1));
  document.querySelector('#next').addEventListener('click', () => select(selected + 1));
  gallery.addEventListener('keydown', (event) => {
    const changes = {
      ArrowLeft: selected - 1,
      ArrowRight: selected + 1,
      Home: 0,
      End: figures.length - 1,
    };
    if (!Object.hasOwn(changes, event.key) || event.altKey || event.ctrlKey || event.metaKey)
      return;
    event.preventDefault();
    select(changes[event.key]);
    if (event.target.closest('.thumbnail')) buttons[selected].focus({ preventScroll: true });
  });
  select(0);
}

const container = document.querySelector('#video-container');
if (media.video.sources.length) {
  const fallback = container.firstElementChild;
  const video = element('video');
  video.controls = true;
  video.playsInline = true;
  video.muted = true;
  video.preload = 'metadata';
  video.hidden = true;
  video.setAttribute('aria-label', 'Environments Switcher screencast');
  if (media.video.poster) video.poster = media.video.poster;
  let inView = false;
  const syncPlayback = () => {
    if (!inView || document.hidden || video.hidden) video.pause();
    else if (!video.ended) video.play().catch(() => {}); // Keep controls usable if autoplay is blocked.
  };
  const observer = new IntersectionObserver(
    ([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      if (visible === inView) return;
      inView = visible;
      syncPlayback();
    },
    { threshold: [0, 0.25] },
  );
  document.addEventListener('visibilitychange', syncPlayback);
  // A pending play request can complete after scrolling away.
  video.addEventListener('play', () => {
    if (!inView || document.hidden || video.hidden) video.pause();
  });
  let failures = 0;
  const showFallback = () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', syncPlayback);
    inView = false;
    video.pause();
    video.hidden = true;
    fallback.hidden = false;
    fallback.querySelector('p').textContent = 'Screencast unavailable';
    fallback.querySelector('span:last-child').textContent = 'Please try again later.';
  };
  video.addEventListener('error', showFallback);
  for (const source of media.video.sources) {
    const node = element('source');
    node.src = source.src;
    node.type = source.type;
    node.addEventListener('error', () => {
      if (++failures === media.video.sources.length) showFallback();
    });
    video.append(node);
  }
  for (const caption of media.video.captions) {
    const track = element('track');
    Object.assign(track, caption, { kind: 'captions' });
    video.append(track);
  }
  video.addEventListener('loadedmetadata', () => {
    fallback.hidden = true;
    video.hidden = false;
    observer.observe(video);
  });
  container.append(video);
}
