import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Evaluate actual runtime code with explicit Shell substitutes; never import GI into Node.
export function loadRuntime(file, names, overrides = {}) {
  const source = readFileSync(new URL(`../src/${file}`, import.meta.url), 'utf8')
    .replace(/^import\s[\s\S]*?;\n/gm, '')
    .replace(/export default /g, '')
    .replace(/export /g, '');
  return vm.runInNewContext(
    `${source}\n;({${names.join(',')}})`,
    {
      console,
      Extension: class {},
      ...overrides,
    },
    { filename: file },
  );
}
