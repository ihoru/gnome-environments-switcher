// Run synchronously before the stylesheet so a saved preference applies before paint.
(() => {
  const modes = ['system', 'light', 'dark'];
  const key = 'environments-switcher-theme';
  const system = matchMedia('(prefers-color-scheme: dark)');
  let mode = 'system';
  try {
    const saved = localStorage.getItem(key);
    if (modes.includes(saved)) mode = saved;
  } catch {
    // Theme switching still works when browser storage is unavailable.
  }
  let button;
  const apply = () => {
    const theme = mode === 'system' ? (system.matches ? 'dark' : 'light') : mode;
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.themeMode = mode;
    for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
      meta.content = theme === 'dark' ? '#211E22' : '#FAFAFA';
      meta.media = 'all';
    }
    if (!button) return;
    const next = modes[(modes.indexOf(mode) + 1) % modes.length];
    const label = `Theme: ${mode}. Switch to ${next} theme`;
    button.setAttribute('aria-label', label);
    button.title = label;
    for (const icon of button.querySelectorAll('[data-theme-icon]'))
      icon.hidden = icon.dataset.themeIcon !== mode;
  };
  apply();
  system.addEventListener('change', () => {
    if (mode === 'system') apply();
  });
  document.addEventListener('DOMContentLoaded', () => {
    button = document.querySelector('#theme-toggle');
    if (!button) return;
    apply();
    button.addEventListener('click', () => {
      mode = modes[(modes.indexOf(mode) + 1) % modes.length];
      try {
        localStorage.setItem(key, mode);
      } catch {
        // Keep the in-memory selection even when persistence fails.
      }
      apply();
    });
    button.hidden = false;
  });
})();
