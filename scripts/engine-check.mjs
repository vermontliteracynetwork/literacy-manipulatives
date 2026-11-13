// Runs the Symbolic Grammar Engine's checks against the engine version this project installs (package.json pins one
// commit of github.com/vermontliteracynetwork/symbolic-grammar-engine). Runs before every build: if any check fails,
// the site is not built or published.
import { execSync } from 'node:child_process';
import path from 'node:path';
const engine = path.resolve('node_modules/symbolic-grammar-engine');
const out = path.resolve('node_modules/.cache/engine-check.mjs');
execSync(`npx --no-install rolldown "${path.join(engine, 'test/run.ts')}" --platform node --format esm --file "${out}" --log-level warn`, { stdio: ['ignore', 'ignore', 'inherit'] });
execSync(`node "${out}"`, { stdio: 'inherit', env: { ...process.env, ENGINE_DATA: path.join(engine, 'data') } });
