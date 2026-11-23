/**
 * Writes `build-manifest.sha256` (in `sha256sum` format) next to the built
 * files and prints one digest for the whole site.
 *
 * Anyone can rebuild a commit and compare: if the digests match, the site
 * GitHub Pages serves is exactly what that commit produces. The deploy
 * workflow also signs this manifest with a GitHub build attestation.
 */
import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';

const MANIFEST = 'build-manifest.sha256';

const listFiles = async (dir: string): Promise<readonly string[]> => {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name))
    .filter((path) => !path.endsWith(MANIFEST));
};

const sha256 = (data: Uint8Array | string): string =>
  createHash('sha256').update(data).digest('hex');

const main = async (): Promise<void> => {
  const dir = process.argv[2] ?? 'dist';
  const files = await listFiles(dir);
  const lines = await Promise.all(
    files.map(async (path) => `${sha256(await readFile(path))}  ${relative(dir, path)}`),
  );
  const manifest = `${[...lines].sort((a, b) => a.slice(66).localeCompare(b.slice(66))).join('\n')}\n`;
  await writeFile(join(dir, MANIFEST), manifest);
  console.log(`${files.length} files, site digest sha256:${sha256(manifest)}`);
};

await main();
