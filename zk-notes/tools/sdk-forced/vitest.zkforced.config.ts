// Scratch config (untracked, delete after use): run the SDK tests against this worktree's cashc
// source with options forced from ZK_FORCE (see zk-notes/tools/sdk-forced).
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';
import { fileURLToPath } from 'node:url';
export default mergeConfig(base, defineConfig({
  resolve: { alias: [
    { find: /^cashc\/dist\/internal\.js$/, replacement: fileURLToPath(new URL('../../zk-notes/tools/sdk-forced/internal.ts', import.meta.url)) },
    { find: /^cashc$/, replacement: fileURLToPath(new URL('../../zk-notes/tools/sdk-forced/index.ts', import.meta.url)) },
  ] },
}));
