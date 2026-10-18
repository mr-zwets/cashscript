import { binToHex } from '@bitauth/libauth';
import {
  Artifact,
  CompilerOptions,
  computeBytecodeFingerprintWithConstructorArgs,
  OptimiseBytecodeResult,
  generateSourceMap,
  generateSourceTags,
  generateInlineRanges,
  optimiseBytecode,
  scriptToBytecode,
  sourceMapToLocationData,
} from '@cashscript/utils';
import fs, { PathLike } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateArtifact } from './artifact/Artifact.js';
import { Ast } from './ast/AST.js';
import { checkVersionConstraints } from './ast/Pragma.js';
import { CashScriptErrorListener } from './ast/error-listeners.js';
import { MissingContractError } from './Errors.js';
import { CashScriptWarningListener, defaultWarningListener } from './Warnings.js';
import { parseCode } from './parser.js';
import {
  createDiskResolver,
  createMemoryResolver,
  ImportResolver,
  resolveDependencies,
} from './dependency-resolution.js';
import { sinkDefinitions } from './def-sinking.js';
import { applyStackRescheduling, programOpCostEstimate } from './stack-rescheduling.js';
import GenerateTargetTraversal from './generation/GenerateTargetTraversal.js';
import { FoldGlobalConstantsTraversal } from './semantic/FoldGlobalConstantsTraversal.js';
import SymbolTableTraversal from './semantic/SymbolTableTraversal.js';
import UnusedCodeWarningsTraversal from './semantic/UnusedCodeTraversal.js';
import TypeCheckTraversal from './semantic/TypeCheckTraversal.js';
import EnsureFinalRequireTraversal from './semantic/EnsureFinalRequireTraversal.js';
import EnsureFunctionsSafeTraversal from './semantic/EnsureFunctionsSafeTraversal.js';
import InjectLocktimeGuardTraversal from './semantic/InjectLocktimeGuardTraversal.js';
import DeadCodeEliminationTraversal from './semantic/DeadCodeEliminationTraversal.js';
import { LowerGlobalConstantsTraversal } from './semantic/LowerGlobalConstantsTraversal.js';
import { hoistRepeatedConstants } from './constant-hoisting.js';
import {
  applyBlockMoves, BlockMoveOptions, blockMovedSizeModel, captureFinalRequire, renumberFunctions, validateBlockMoveOptions,
} from './block-moves.js';

export const DEFAULT_COMPILER_OPTIONS: CompilerOptions = {
  enforceFunctionParameterTypes: true,
  enforceLocktimeGuard: true,
  // recorded explicitly so artifacts always state the objective they were compiled under
  // (see CompilerOptions in @cashscript/utils for the size/opcost trade-off)
  optimizeFor: 'opcost',
};

export interface CompileOptions extends CompilerOptions {
  errorListener?: CashScriptErrorListener;
  warningListener?: CashScriptWarningListener;
}

export interface CompileStringOptions extends CompileOptions {
  files?: Record<string, string>;
}

/**
 * Compile a CashScript source string to an {@link Artifact}.
 *
 * @param code - The CashScript source code to compile.
 * @param compilerOptions - Optional compiler options that override the defaults.
 * @returns The compiled CashScript artifact, including ABI, bytecode and debug information.
 * @throws If the source code contains a syntax, semantic, or type error, or an import cannot be resolved.
 * @remarks Compilation warnings (e.g. unused variables) are passed to the `warningListener` compiler
 * option, or printed with `console.warn` when no listener is provided.
 */
export const compileString: (code: string, compilerOptions?: CompileStringOptions) => Artifact =
  compileStringInternal;

/**
 * Read a `.cash` source file from disk and compile it to an `Artifact`.
 *
 * Import directives are resolved from the filesystem: file paths (starting with './' or '../')
 * relative to the importing file's directory, and package imports (e.g. 'pkg/math.cash')
 * from node_modules directories, walking up from the importing file's directory.
 *
 * @param codeFile - The path to the `.cash` source file.
 * @param compilerOptions - Optional compiler options that override the defaults.
 * @returns The compiled CashScript artifact.
 * @throws If the file cannot be read, or if the source contains a compilation error.
 */
export const compileFile: (codeFile: PathLike, compilerOptions?: CompileOptions) => Artifact =
  compileFileInternal;


export interface InternalCompilerOptions extends CompilerOptions {
  disableInlining?: boolean;
  // Skip def-sinking. Under `optimizeFor: 'size'`, definitions move down to just before their
  // first use when that shrinks the bytecode (the compiler keeps the smaller of the sunk and
  // unsunk compiles). This flag is for tools that need the source-ordered compile as input.
  disableDefSinking?: boolean;
  // Skip constant hoisting. Under `optimizeFor: 'size'`, repeated in-body literals are bound to
  // locals when that shrinks the bytecode (the compiler keeps the hoisted compile only when it
  // is strictly smaller). This flag is for tools that need the literal-shaped compile as input.
  disableConstantHoisting?: boolean;
  // Force one code generation strategy for reassignments inside branches and loops instead of
  // keeping the cheaper one per scope (see chooseScopedReassignment). For tests and tooling.
  scopedReassignment?: ScopedReassignment;
  // Emit while- and for-loops in inverted form (one entry test, then a do-while that re-tests at
  // the bottom) instead of testing at the top of every iteration. Default true. For tests and tooling.
  loopInversion?: boolean;
  // Force a constant hoisting mode instead of the objective default ('size': the smaller of
  // 'all' and none; 'opcost': none). 'frequency' keeps literal pushes at hot occurrences and
  // shares one binding among cold ones (see hoistByFrequency). For experiments and tooling.
  constantHoisting?: 'off' | 'all' | 'frequency';
  // Keep every function called from a loop OP_DEFINE'd (the pre-co-8 rule) instead of only those
  // called inside a branch that repeats. For tests and tooling.
  branchAwareLoopInlining?: boolean;
  // Stack rescheduling: plan each node's operand placement together with where its producers
  // (notably OP_INVOKE'd calls) left their results: adopt in-place operands, stage commutative
  // operands in the cheaper order, choose nodes by exact emission cost. Default true.
  crossCallScheduling?: boolean;
  // With crossCallScheduling: also try half-wise reversed / swapped argument layouts. Costly in
  // compile time for a few bytes; default: on under optimizeFor 'size' only.
  crossCallHalfwiseLayouts?: boolean;
  // With crossCallScheduling: also choose each OP_DEFINE'd function's RETURN layout (the order its
  // results are left on the stack), scored together with its call sites. Default true.
  returnLayouts?: boolean;
  // With returnLayouts: judge the best return-layout candidates by recompiling their callers with
  // every scheduling strategy instead of a fast proxy. Slower; default false.
  returnLayoutsExact?: boolean;
  // With crossCallScheduling: number of callee-first convention search passes (a fixed-point
  // iteration; each pass sees the previous pass's conventions at call sites; it stops as soon as
  // the conventions are stable). Default 3.
  conventionPasses?: number;
  // Stack rescheduling: a block's exit slots that are its untouched entry slots at the same
  // positions stay in place instead of being re-assembled on top. Default: on with
  // crossCallScheduling.
  passThroughBottom?: boolean;
  // With crossCallScheduling: in the main routine, schedule require() checks (the VERIFY family)
  // and calls of functions without results as nodes of the surrounding straight-line block
  // instead of block boundaries (their order is unobservable). Default true.
  verifySinks?: boolean;
  // Collapse runs of single-item fetches that move or copy a contiguous block of stack items
  // (aggregate arguments: Fp2/Fp6/Fp12 blocks) into calls of small looping helper functions,
  // and renumber function ids by call count (see block-moves.ts). Trades op-cost for bytes, so
  // it is off by default; `{ kinds: 'compact' }` uses the cheaper progression helpers only.
  blockMoves?: boolean | BlockMoveOptions;
  // Renumber OP_DEFINE'd function ids by static call count, so the most-called functions push
  // their id in one byte (ids 0..16). A pure relabelling (debug frames follow). Default: on with
  // rescheduleStacks. Under blockMoves, its own `renumber` setting decides instead.
  renumberFunctionIds?: boolean;
  // With crossCallScheduling under rescheduleStacks: also compile the schedule with
  // crossCallScheduling off (co-8's rescheduler) and, under 'size' with blockMoves, with
  // returnLayouts off, and keep an alternative when it is better under the objective (see
  // CROSS-CALL FALLBACK in compileImpl). Default true; false saves the extra compile time.
  crossCallFallback?: boolean;
  // Under 'size' with blockMoves and crossCallScheduling: rank rescheduling candidates (schedules,
  // entry and return layouts) by their bytes after the block-move post-pass instead of before
  // it (blockMovedSizeModel). Default true.
  blockMoveAwareCosts?: boolean | 'bodies';
}

export type ScopedReassignment = 'replace' | 'rename';

// The AST rewrites applied before semantic analysis in a single compile candidate.
interface RewriteFlags {
  sinkDefs: boolean;
  hoistConstants: boolean | 'frequency';
}

export function compileStringInternal(
  code: string,
  compilerOptions: CompileStringOptions & InternalCompilerOptions = {},
): Artifact {
  const { files, ...remainingOptions } = compilerOptions;
  const resolver = createMemoryResolver(files ?? {});
  return compileCode(code, resolver, remainingOptions);
}

export function compileFileInternal(
  codeFile: PathLike,
  compilerOptions: CompileOptions & InternalCompilerOptions = {},
): Artifact {
  const filePath = codeFile instanceof URL ? fileURLToPath(codeFile) : codeFile.toString();
  const code = fs.readFileSync(filePath, { encoding: 'utf-8' });
  const resolver = createDiskResolver(path.dirname(filePath));
  return compileCode(code, resolver, compilerOptions);
}

function compileCode(
  code: string,
  resolver: ImportResolver,
  compilerOptions: CompileOptions & InternalCompilerOptions,
): Artifact {
  const optimizeFor = compilerOptions.optimizeFor ?? DEFAULT_COMPILER_OPTIONS.optimizeFor;
  const forced = compilerOptions.constantHoisting;
  if (forced !== undefined) {
    const hoistConstants = forced === 'frequency' ? 'frequency' : forced === 'all';
    return compileImpl(code, resolver, compilerOptions, { sinkDefs: false, hoistConstants });
  }
  if (optimizeFor !== 'size') {
    return compileImpl(code, resolver, compilerOptions, { sinkDefs: false, hoistConstants: false });
  }

  // Each 'size' rewrite helps most contracts but can cost bytes on some, so the 'size' objective
  // compiles every enabled combination and keeps the smallest artifact. Candidates are ordered
  // so ties resolve conservatively: the sunk compile wins a def-sinking tie (established
  // behaviour), and the hoisted compile is only kept when it is strictly smaller.
  const sinkOptions = compilerOptions.disableDefSinking ? [false] : [true, false];
  const hoistOptions = compilerOptions.disableConstantHoisting ? [false] : [false, true];
  const candidates = sinkOptions
    .flatMap((sinkDefs) => hoistOptions.map((hoistConstants) => ({ sinkDefs, hoistConstants })));
  const compiledBytes = (artifact: Artifact): number => artifact.debug?.bytecode.length ?? artifact.bytecode.length;
  return candidates
    .map((rewrites) => compileImpl(code, resolver, compilerOptions, rewrites))
    .reduce((best, candidate) => (compiledBytes(candidate) < compiledBytes(best) ? candidate : best));
}

function compileImpl(
  code: string,
  resolver: ImportResolver,
  compilerOptions: CompileOptions & InternalCompilerOptions,
  rewrites: RewriteFlags,
): Artifact {
  const {
    errorListener, warningListener, disableInlining,
    // consumed in compileCode (which picks the smallest rewrite combination); destructured here
    // only to keep them out of the serialized artifact options
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    disableDefSinking, disableConstantHoisting, scopedReassignment, loopInversion, constantHoisting,
    branchAwareLoopInlining, crossCallScheduling, crossCallHalfwiseLayouts, returnLayouts, blockMoves,
    renumberFunctionIds, passThroughBottom, verifySinks, returnLayoutsExact, conventionPasses, crossCallFallback,
    blockMoveAwareCosts, ...artifactCompilerOptions
  } = compilerOptions;
  validateBlockMoveOptions(blockMoves);
  const mergedCompilerOptions = { ...DEFAULT_COMPILER_OPTIONS, ...artifactCompilerOptions };

  // Lexing + parsing
  let ast = parseCode(code, errorListener);
  checkVersionConstraints(ast.pragmas);

  const sources = resolveDependencies(ast, resolver, errorListener);

  // Under the 'size' objective, bind repeated in-body literals to locals (see CompilerOptions).
  // Runs before semantic analysis so the introduced locals get symbols like any other variable.
  if (rewrites.hoistConstants) {
    ast = hoistRepeatedConstants(ast, rewrites.hoistConstants === 'frequency' ? 'frequency' : 'all') as Ast;
  }

  // Sink variable definitions to just before their first use
  if (rewrites.sinkDefs) {
    ast = sinkDefinitions(ast) as Ast;
  }

  if (!ast.contract) throw new MissingContractError();

  const constructorParamLength = ast.contract.parameters.length;

  // Semantic analysis
  ast = ast.accept(new FoldGlobalConstantsTraversal()) as Ast;

  ast = ast.accept(new SymbolTableTraversal()) as Ast;
  ast = ast.accept(new UnusedCodeWarningsTraversal(warningListener ?? defaultWarningListener)) as Ast;

  ast = ast.accept(new TypeCheckTraversal()) as Ast;
  ast = ast.accept(new EnsureFunctionsSafeTraversal()) as Ast;
  ast = ast.accept(new EnsureFinalRequireTraversal()) as Ast;
  if (mergedCompilerOptions.enforceLocktimeGuard) {
    ast = ast.accept(new InjectLocktimeGuardTraversal()) as Ast;
  }

  // Turn global constants into synthetic zero-argument functions, so they can share reachability analysis,
  // inlining, and VM function-ID assignment with user-defined functions
  ast = ast.accept(new LowerGlobalConstantsTraversal()) as Ast;

  // Dead-code elimination: drop global functions that are never invoked before code generation
  ast = ast.accept(new DeadCodeEliminationTraversal()) as Ast;

  // Code generation
  const traversal = new GenerateTargetTraversal({
    ...mergedCompilerOptions, disableInlining, scopedReassignment, loopInversion, branchAwareLoopInlining,
  });
  ast = ast.accept(traversal) as Ast;

  // Bytecode optimisation
  let optimisationResult = optimiseBytecode(
    traversal.output,
    sourceMapToLocationData(traversal.sourceMap),
    traversal.consoleLogs,
    traversal.requires,
    traversal.sourceTags,
    traversal.inlineRanges,
    constructorParamLength,
  );

  let frames = traversal.frames;
  const anchorFinalRequire = captureFinalRequire(optimisationResult, constructorParamLength);
  const rescheduling = mergedCompilerOptions.rescheduleStacks === true && ast.contract!.functions.length === 1;
  const postPasses = rescheduling || Boolean(blockMoves);
  const objective = mergedCompilerOptions.optimizeFor ?? 'opcost';
  type Compiled = { result: OptimiseBytecodeResult; frames: typeof frames };

  // block moves / function id renumbering, the last passes over the final bytecode
  const finish = ({ result, frames: resultFrames }: Compiled): Compiled => {
    if (blockMoves) {
      // helper specialisation and id renumbering interact (only ids 0..16 push in one byte), so
      // both specialisation settings are run end to end and the smaller result is kept
      const moveOptions = blockMoves === true ? {} : blockMoves;
      const variants = (moveOptions.specialise === undefined ? [true, false] : [moveOptions.specialise])
        .map((specialise) => {
          let moved = applyBlockMoves(result, resultFrames, constructorParamLength, { ...moveOptions, specialise });
          if (moveOptions.renumber !== false) moved = renumberFunctions(moved.result, moved.frames);
          return moved;
        });
      const size = (v: { result: OptimiseBytecodeResult }): number => scriptToBytecode(v.result.script).length;
      return variants.reduce((best, v) => (size(v) < size(best) ? v : best));
    }
    if (renumberFunctionIds ?? mergedCompilerOptions.rescheduleStacks === true) {
      return renumberFunctions(result, resultFrames);
    }
    return { result, frames: resultFrames };
  };

  // Stack rescheduling (opt-in): re-derive straight-line evaluation schedules from the
  // dataflow DAG, ranked by the optimizeFor objective. Restricted to single-function
  // contracts (a function selector makes the entry stack depth path-dependent, which the
  // block model does not represent).
  // blockMoveAwareCosts (under 'size' with block moves): rank candidates by their bytes after the
  // block-move pass (see blockMovedSizeModel)
  const sizeModel = objective === 'size' && blockMoves && (blockMoveAwareCosts ?? false) !== false
    ? blockMovedSizeModel(blockMoves) : undefined;
  const reschedule = (overrides: { crossCallScheduling: boolean; returnLayouts?: boolean }): Compiled => {
    const rescheduled = applyStackRescheduling(optimisationResult, traversal.frames, {
      arities: traversal.definedFunctionArities,
      mainInArity: ast.contract!.functions[0].parameters.length + constructorParamLength,
      objective,
      constructorParamLength,
      crossCallHalfwiseLayouts,
      returnLayouts,
      passThroughBottom,
      verifySinks,
      returnLayoutsExact,
      conventionPasses,
      sizeModel,
      sizeModelScope: blockMoveAwareCosts === 'bodies' ? 'bodies' : 'all',
      ...overrides,
    });
    // The rescheduler re-emits blocks one at a time, so redundancies across block boundaries
    // (OP_SWAP OP_SWAP, OP_DROP OP_DROP, ...) are left for a final pass of the main optimiser,
    // which keeps the source map, logs, requires and tags in step.
    const { script, locationData, logs, requires, sourceTags, inlineRanges } = rescheduled.result;
    return finish({
      result: optimiseBytecode(script, locationData, logs, requires, sourceTags, inlineRanges, constructorParamLength),
      frames: rescheduled.frames,
    });
  };

  let compiled: Compiled;
  if (rescheduling) {
    const crossCall = crossCallScheduling ?? true;
    compiled = reschedule({ crossCallScheduling: crossCall });
    // CROSS-CALL FALLBACK: the milestone's scheduling levers are heuristics that can lose to
    // co-8's plain schedule on some contracts (zk-notes/convention.md 7.6). Compile that schedule
    // as well, through the same post-passes, and keep it when it is better: under 'size' when it
    // is smaller; under 'opcost' when it is no larger and no more expensive by the static
    // whole-program estimate, and better in one of them (the measured per-body op-costs of the
    // two runs are not comparable to each other, so only a dominating fallback replaces).
    // Under 'size' with block moves, the return layouts get the same check (they are chosen on
    // the bytes before block moves).
    if (crossCall && (crossCallFallback ?? true)) {
      const bytes = (c: Compiled): number => scriptToBytecode(c.result.script).length;
      const estimate = (c: Compiled): number => programOpCostEstimate(c.result.script);
      const better = (a: Compiled, b: Compiled): boolean => {
        if (objective === 'size') return bytes(a) < bytes(b);
        const [ba, bb, ea, eb] = [bytes(a), bytes(b), estimate(a), estimate(b)];
        return ba <= bb && ea <= eb && (ba < bb || ea < eb);
      };
      type Alternative = { crossCallScheduling: boolean; returnLayouts?: boolean };
      const alternatives: Alternative[] = [{ crossCallScheduling: false }];
      if (objective === 'size' && blockMoves && returnLayouts === undefined) {
        alternatives.push({ crossCallScheduling: true, returnLayouts: false });
      }
      alternatives.forEach((alternative) => {
        const candidate = reschedule(alternative);
        if (better(candidate, compiled)) compiled = candidate;
      });
    }
  } else {
    compiled = finish({ result: optimisationResult, frames });
  }
  ({ result: optimisationResult, frames } = compiled);
  if (postPasses) optimisationResult = anchorFinalRequire(optimisationResult);

  const debug = {
    bytecode: binToHex(scriptToBytecode(optimisationResult.script)),
    sourceMap: generateSourceMap(optimisationResult.locationData),
    logs: optimisationResult.logs,
    requires: optimisationResult.requires,
    sourceTags: generateSourceTags(optimisationResult.sourceTags) || undefined,
    functions: frames.length > 0 ? frames : undefined,
    sources: Object.keys(sources).length > 0 ? sources : undefined,
    inlineRanges: generateInlineRanges(optimisationResult.inlineRanges) || undefined,
  };

  const fingerprint = computeBytecodeFingerprintWithConstructorArgs(optimisationResult.script, constructorParamLength);

  return generateArtifact(ast, optimisationResult.script, code, debug, mergedCompilerOptions, fingerprint);
}
