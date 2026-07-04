import { binToHex } from '@bitauth/libauth';
import {
  Artifact,
  CompilerOptions,
  computeBytecodeFingerprintWithConstructorArgs,
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
}

// The AST rewrites applied before semantic analysis in a single compile candidate.
interface RewriteFlags {
  sinkDefs: boolean;
  hoistConstants: boolean;
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
    disableDefSinking, disableConstantHoisting,
    ...artifactCompilerOptions
  } = compilerOptions;
  const mergedCompilerOptions = { ...DEFAULT_COMPILER_OPTIONS, ...artifactCompilerOptions };

  // Lexing + parsing
  let ast = parseCode(code, errorListener);
  checkVersionConstraints(ast.pragmas);

  const sources = resolveDependencies(ast, resolver, errorListener);

  // Under the 'size' objective, bind repeated in-body literals to locals (see CompilerOptions).
  // Runs before semantic analysis so the introduced locals get symbols like any other variable.
  if (rewrites.hoistConstants) {
    ast = hoistRepeatedConstants(ast) as Ast;
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
  const traversal = new GenerateTargetTraversal({ ...mergedCompilerOptions, disableInlining });
  ast = ast.accept(traversal) as Ast;

  // Bytecode optimisation
  const optimisationResult = optimiseBytecode(
    traversal.output,
    sourceMapToLocationData(traversal.sourceMap),
    traversal.consoleLogs,
    traversal.requires,
    traversal.sourceTags,
    traversal.inlineRanges,
    constructorParamLength,
  );

  const debug = {
    bytecode: binToHex(scriptToBytecode(optimisationResult.script)),
    sourceMap: generateSourceMap(optimisationResult.locationData),
    logs: optimisationResult.logs,
    requires: optimisationResult.requires,
    sourceTags: generateSourceTags(optimisationResult.sourceTags) || undefined,
    functions: traversal.frames.length > 0 ? traversal.frames : undefined,
    sources: Object.keys(sources).length > 0 ? sources : undefined,
    inlineRanges: generateInlineRanges(optimisationResult.inlineRanges) || undefined,
  };

  const fingerprint = computeBytecodeFingerprintWithConstructorArgs(optimisationResult.script, constructorParamLength);

  return generateArtifact(ast, optimisationResult.script, code, debug, mergedCompilerOptions, fingerprint);
}
