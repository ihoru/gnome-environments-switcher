// SPDX-License-Identifier: MIT

export const AUTHOR = 'Igor Polyakov';
export const FEEDBACK_EMAIL = 'ihor.polyakov@gmail.com';

export function displayVersion(metadata) {
  const name = metadata['version-name'];
  const build = metadata.version;
  return name ? (build ? `${name} (build ${build})` : name) : String(build ?? 'Unknown');
}

export function issueUrl(repo, kind, details) {
  if (!['bug', 'feature'].includes(kind)) throw new Error('Unknown issue type.');
  const environment = [
    `Extension version: ${details.extensionVersion}`,
    `GNOME version: ${details.gnomeVersion}`,
    `OS version: ${details.osVersion}`,
  ].join('\n');
  const params = { template: `${kind}.yml`, environment };
  return `${repo}/issues/new?${Object.entries(params)
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')}`;
}

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

export function productivityMessage(random = Math.random) {
  return PRODUCTIVITY_MESSAGES[Math.floor(random() * PRODUCTIVITY_MESSAGES.length)];
}
