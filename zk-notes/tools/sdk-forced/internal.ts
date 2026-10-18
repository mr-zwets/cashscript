// SDK test shim for `cashc/dist/internal.js`: internal compile functions with ZK_FORCE options
// merged in (see index.ts).
export { DEFAULT_COMPILER_OPTIONS } from '../../../packages/cashc/src/compiler.js';
export type { InternalCompilerOptions } from '../../../packages/cashc/src/compiler.js';
export { compileString, compileFile } from './index.js';
