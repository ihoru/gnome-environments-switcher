# Project website

The plain HTML, CSS, and JavaScript website lives in `site/`. It has no build step,
analytics, external font requests, or framework dependencies. Its assets are excluded
from the extension ZIP by the extension packager's allowlist.

## Preview locally

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory site
```

Open `http://localhost:8000/`. Use HTTP rather than `file://` for JavaScript modules.
Run `npm run check` for formatting, JavaScript lint, extension checks, and packaging.
It also refreshes the CSS content hash in the stylesheet URL. After editing CSS during
local previews, run `python3 scripts/version_site_css.py` and reload the page.
The Pages workflow refreshes this hash before each upload, so changed CSS gets a new
cache URL while unchanged CSS remains cacheable. An already-open page needs a reload
to receive the new HTML and stylesheet URL.
Browser checks should also cover narrow screens, keyboard navigation, media failures,
and a project subpath such as `/gnome-environments-switcher/`.

## Add screenshots and the screencast

Copy media into `site/assets/media/` and edit **only `site/media.js`** to configure it.
All paths are relative to `site/index.html`; do not start them with `/`.
Leave screenshot `src` empty to show the intentional placeholder.

Included screenshots (original PNG files):

- `picker-one-screen.png`: Picker opened with Win + W.
- `picker-full.png`: Picker across four monitors.
- `switch-full.png`: Preview after Ctrl + Alt + Arrow.
- `settings-general.png`: General preferences.
- `settings-shortcuts.png`: Shortcuts preferences.
- `settings-more.png`: More preferences.
- `demo.webm`: the supplied 34-second demo, changing workspaces, moving a window to another
  environment, switching environments, and opening settings.

PNG, JPEG, and WebP screenshots work. Use full screenshots with non-sensitive windows;
images fit without cropping. Full images also provide the thumbnails. Click a loaded screenshot to open the fullscreen
viewer without leaving the page. Scroll to zoom (1×–8×), drag to pan, use Fit to reset,
and press Escape or Close to return. Left goes back; Right or Space advances, wrapping
around the loaded screenshots. Changing images resets zoom and uses a short transition
unless reduced motion is enabled. Keyboard +/− and 0 also zoom/reset. On touch
screens, use the zoom buttons and swipe to pan. Placeholders do not open the viewer. Each screenshot
entry has `title`, `label` (thumbnail subtitle), `src`, descriptive `alt`, `caption`,
and a decorative placeholder `symbol`.

Example screenshot entry:

```js
{
  title: 'Picker',
  label: 'Win + W',
  src: 'assets/media/picker.webp',
  alt: 'Personal and Work workspace grids in the Picker',
  caption: 'Both environments on every monitor. Open with Win + W.',
  symbol: '▦',
}
```

Set the video configuration when the recording is ready:

```js
video: {
  sources: [{ src: 'assets/media/tour.mp4', type: 'video/mp4' }],
  poster: 'assets/media/tour-poster.webp', // Optional; use '' to omit.
  captions: [ // Optional; use [] to omit. Recommended if there is narration.
    { src: 'assets/media/tour.en.vtt', srclang: 'en', label: 'English', default: true },
  ],
},
```

Use H.264 MP4 for broad browser support, with optional WebM as an alternative.
The native player has controls and fullscreen support. It starts muted when at least 25%
of the player enters the viewport, pauses when it leaves or the browser tab is hidden,
and resumes when visible again. Finished videos do not automatically replay. If the browser
blocks autoplay, the normal Play control remains available.
Without sources, the page shows a screencast placeholder. Failed sources show a readable
unavailable state instead of a broken player. A missing screenshot retains its placeholder.
The screenshot overview appears while images load.

Without JavaScript, the page retains all content and a labeled six-image gallery.
JavaScript enhances the gallery with thumbnails and fullscreen controls. If adding or replacing
images, also update the static fallback figures in `site/index.html` for visitors without JavaScript.

## Publish later

Nothing is automatically published on push. After separately authorizing publication:

1. Commit and push the website and `.github/workflows/pages.yml` to the default branch.
2. In the GitHub repository, open **Settings → Pages → Build and deployment**, and select
   **GitHub Actions** as the source.
3. In **Actions → Publish website**, select **Run workflow** on the default branch.
4. Verify the deployment URL and check media and navigation on the published site.

The expected project URL is `https://ihoru.github.io/gnome-environments-switcher/`.
The workflow uploads only `site/` and uses the `github-pages` environment with the
permissions required by GitHub's official Pages actions. It is manual and restricted to
runs from the default branch. Future updates also require a manual run.
See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

When extension features, shortcuts, version, or compatibility change, update the page's
copy alongside README and CHANGELOG. Keep pending marketplace and live-testing status honest.
The local, unmodified Ubuntu fonts retain their names and are distributed under the
Ubuntu Font Licence in `site/assets/fonts/LICENSE.txt`; website code uses the project's MIT license.
