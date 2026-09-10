// Paths are relative to site/index.html. Set src to a local media path when ready.
// Example: src: 'assets/media/picker.webp'. Keep empty strings for placeholders.
export const media = {
  screenshots: [
    {
      title: 'Picker — single monitor',
      label: 'Win + W',
      src: 'assets/media/picker-one-screen.png',
      alt: 'The Picker showing Personal and Projects workspace grids on one monitor',
      caption: 'Both environments on a single monitor. Open with Win + W.',
      symbol: '▦',
    },
    {
      title: 'Picker — multiple monitors',
      label: 'Win + W · all screens',
      src: 'assets/media/picker-full.png',
      alt: 'The Picker displayed across four monitors, each showing its own workspace previews',
      caption: 'The Picker on all four monitors, with monitor-specific window previews.',
      symbol: '▦',
    },
    {
      title: 'Preview',
      label: 'Ctrl + Alt + Arrow',
      src: 'assets/media/switch-full.png',
      alt: 'The passive Personal workspace Preview displayed across four monitors',
      caption:
        'A passive glance at your destination across four monitors when changing workspaces.',
      symbol: '▤',
    },
    {
      title: 'Settings — General',
      label: 'Names & timing',
      src: 'assets/media/settings-general.png',
      alt: 'General settings with display names and picker timeout controls',
      caption: 'Environment names and picker timing.',
      symbol: '⚙',
    },
    {
      title: 'Settings — Shortcuts',
      label: 'Your keyboard',
      src: 'assets/media/settings-shortcuts.png',
      alt: 'Shortcuts settings with configurable keyboard actions',
      caption: 'Your keyboard, your workflow.',
      symbol: '⌘',
    },
    {
      title: 'Settings — More',
      label: 'Files & project',
      src: 'assets/media/settings-more.png',
      alt: 'More settings with encouragement, settings transfer, diagnostics, and project information',
      caption: 'Settings files, diagnostics, and the people behind the project.',
      symbol: '＋',
    },
  ],
  video: {
    // Example: sources: [{ src: 'assets/media/tour.mp4', type: 'video/mp4' }]
    sources: [{ src: 'assets/media/demo.webm', type: 'video/webm' }],
    poster: '',
    // Example: captions: [{ src: 'assets/media/tour.en.vtt', srclang: 'en', label: 'English', default: true }]
    captions: [],
  },
};
