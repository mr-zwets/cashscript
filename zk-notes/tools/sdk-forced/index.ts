// SDK test shim: the public `cashc` entry with internal compiler options forced from the
// ZK_FORCE environment variable (JSON), e.g. ZK_FORCE='{"rescheduleStacks":true,"blockMoves":true}'.
// Used through packages/cashscript/vitest.zkforced.config.ts (a scratch config, see zk-notes).
import { compileFileInternal, compileStringInternal } from '../../../packages/cashc/src/compiler.js';

export * from '../../../packages/cashc/src/index.js';

const forced = (): object => JSON.parse(process.env.ZK_FORCE ?? '{}');

export const compileString = (code: string, options: object = {}): ReturnType<typeof compileStringInternal> => (
  compileStringInternal(code, { ...options, ...forced() } as never)
);
export const compileFile = (path: URL | string, options: object = {}): ReturnType<typeof compileFileInternal> => (
  compileFileInternal(path as never, { ...options, ...forced() } as never)
);
