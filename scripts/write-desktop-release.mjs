import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
const revision = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Commit inválido para publicação.');
mkdirSync('dist/client', { recursive: true });
writeFileSync('dist/client/desktop-release.json', JSON.stringify({ schema: 1, revision, publishedAt: new Date().toISOString() }));
