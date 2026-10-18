// Scratch config (copy into packages/cashscript, delete after use): the SDK tests against this
// worktree's cashc source with ZK_FORCE options (as vitest.zkforced.config.ts), and with
// ZK_RECOMPILE=1 every Contract recompiles its artifact from source (see recompile-setup.ts).
import { defineConfig, mergeConfig } from 'vitest/config';
import base from './vitest.config.ts';
import { fileURLToPath } from 'node:url';

const CONSTRUCTOR_ANCHOR = '    super();\n    this.provider = this.options.provider;';

export default mergeConfig(base, defineConfig({
  resolve: { alias: [
    { find: /^cashc\/dist\/internal\.js$/, replacement: fileURLToPath(new URL('../../zk-notes/tools/sdk-forced/internal.ts', import.meta.url)) },
    { find: /^cashc$/, replacement: fileURLToPath(new URL('../../zk-notes/tools/sdk-forced/index.ts', import.meta.url)) },
  ] },
  plugins: [{
    name: 'zk-recompile-artifacts',
    enforce: 'pre',
    transform(code: string, id: string) {
      if (!id.replace(/\\/g, '/').endsWith('/packages/cashscript/src/Contract.ts')) return undefined;
      const normalised = code.replace(/\r\n/g, '\n');
      if (!normalised.includes(CONSTRUCTOR_ANCHOR)) throw new Error('zk-recompile: Contract constructor anchor not found');
      return normalised.replace(CONSTRUCTOR_ANCHOR, [
        '    super();',
        '    // eslint-disable-next-line @typescript-eslint/no-explicit-any',
        '    artifact = (globalThis as any).__zkRecompile ? (globalThis as any).__zkRecompile(artifact) : artifact;',
        '    this.artifact = artifact;',
        '    this.provider = this.options.provider;',
      ].join('\n'));
    },
  }],
  test: {
    setupFiles: [fileURLToPath(new URL('../../zk-notes/tools/sdk-forced/recompile-setup.ts', import.meta.url))],
  },
}));
