import { binToHex, hexToBin } from '@bitauth/libauth';
import {
  asmToScript,
  encodeBool,
  encodeInt,
  encodeNullDataPushOpcode,
  encodeNullDataScript,
  encodeString,
  Op,
  OpOrData,
  PrimitiveType,
  Script,
  scriptToAsm,
  scriptToBytecode,
  optimiseBytecode,
  OptimiseBytecodeResult,
  generateSourceMap,
  generateSourceTags,
  generateInlineRanges,
  parseSourceTags,
  FullLocationData,
  DebugFrame,
  LogEntry,
  RequireStatement,
  PositionHint,
  SingleLocationData,
  StackItem,
  BytesType,
  TupleType,
  SourceTagEntry,
  SourceTagKind,
} from '@cashscript/utils';
import {
  ContractNode,
  ParameterNode,
  VariableDefinitionNode,
  FunctionDefinitionNode,
  FunctionKind,
  AssignNode,
  IdentifierNode,
  BranchNode,
  CastNode,
  FunctionCallNode,
  UnaryOpNode,
  BinaryOpNode,
  BoolLiteralNode,
  IntLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  BlockNode,
  TimeOpNode,
  ArrayNode,
  TupleIndexOpNode,
  RequireNode,
  SourceFileNode,
  Node,
  InstantiationNode,
  TupleAssignmentNode,
  NullaryOpNode,
  ConsoleParameterNode,
  ConsoleStatementNode,
  SliceNode,
  DoWhileNode,
  WhileNode,
  ForNode,
  ExpressionNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { GlobalFunction, Class } from '../ast/Globals.js';
import { BinaryOperator } from '../ast/Operator.js';
import {
  compileBinaryOp,
  compileCast,
  compileNullaryOp,
  compileTimeOp,
  compileUnaryOp,
} from './utils.js';
import { getCompileTimeBytes, isNumericType } from '../utils.js';
import {
  collectEntryReachableCalls, collectFunctionCalls, collectLoopResidentFunctions, isRecursive, shouldInline,
} from './inlining.js';
import type { InternalCompilerOptions, ScopedReassignment } from '../compiler.js';

// Scopes nested deeper than this inherit their parent's reassignment strategy instead of trying both,
// which bounds the extra code generation passes (see chooseScopedReassignment)
const MAX_REASSIGNMENT_TRIAL_DEPTH = 2;

interface TraversalState {
  output: Script;
  locationData: FullLocationData;
  stack: string[];
  consoleLogs: LogEntry[];
  requires: RequireStatement[];
  sourceTags: SourceTagEntry[];
  finalStackUsage: Record<string, StackItem>;
  inlineRanges: InlineRange[];
  consumedReads: Set<IdentifierNode>;
}

interface InlineRange {
  startIp: number;
  endIp: number;
  frame: DebugFrame;
  line: number;
}

export default class GenerateTargetTraversal extends AstTraversal {
  private locationData: FullLocationData = []; // detailed location data needed for sourcemap creation
  sourceMap: string;
  output: Script = [];
  stack: string[] = [];
  consoleLogs: LogEntry[] = [];
  requires: RequireStatement[] = [];
  sourceTags: SourceTagEntry[] = [];
  frames: DebugFrame[] = [];
  finalStackUsage: Record<string, StackItem> = {};

  private scopeDepth = 0;
  private currentFunction: FunctionDefinitionNode;
  private constructorParameterCount: number;
  inlineRanges: InlineRange[] = [];

  // Stack arity (parameter/return counts) of every OP_DEFINE'd function, keyed by its
  // functionId — consumed by post-codegen passes (stack rescheduling) that need OP_INVOKE
  // stack effects without re-deriving them from the bytecode.
  definedFunctionArities: Map<number, { in: number; out: number }> = new Map();

  // Tracks right-to-left argument staging for user function calls (see stageUserFunctionArguments)
  private userCallArgDepth = 0;

  // How reassignments inside a branch or loop are compiled. 'replace' rolls the new value into the
  // variable's fixed slot (emitReplace), which costs O(depth) per value. 'rename' leaves the new value
  // on top and renames it, consuming the old value when the right-hand side reads it exactly once
  // (consumedReads); the scope then restores its entry layout once at its end (reconcileStack).
  private scopedReassignment: ScopedReassignment = 'replace';
  private consumedReads: Set<IdentifierNode> = new Set();
  private slotCounter = 0;

  // The scope depth each local variable was declared at (see isBlockLocalFinalRead)
  private declarationScopeDepths: Map<string, number> = new Map();
  private callArgNameCounts: Map<string, number> | null = null;

  constructor(private compilerOptions: InternalCompilerOptions) {
    super();
  }

  private emit(op: OpOrData | OpOrData[], locationData: SingleLocationData): void {
    if (Array.isArray(op)) {
      op.forEach((element) => this.output.push(element as Op));
      op.forEach(() => this.locationData.push(locationData));
    } else {
      this.output.push(op);
      this.locationData.push(locationData);
    }
  }

  private pushToStack(value: string, pushToBottom?: boolean): void {
    if (pushToBottom) {
      this.stack.push(value);
    } else {
      this.stack.unshift(value);
    }
  }

  private popFromStack(count: number = 1): void {
    for (let i = 0; i < count; i += 1) {
      this.stack.shift();
    }
  }

  private removeFromStack(i: number): void {
    this.stack.splice(i, 1);
  }

  private nipFromStack(): void {
    this.stack.splice(1, 1);
  }

  private getStackIndex(value: string, canBeUndefined?: boolean): number {
    const index = this.stack.indexOf(value);

    if (index === -1 && !canBeUndefined) {
      throw new Error(`Expected variable '${value}' does not exist on the stack`);
    }

    return index;
  }

  private getMostRecentInstructionPointer(): number {
    // instruction pointer is the count of emitted opcodes + number of constructor data pushes (minus 1 for 0-indexing)
    return this.output.length + this.constructorParameterCount - 1;
  }

  visitSourceFile(node: SourceFileNode): Node {
    this.defineGlobalFunctions(node);

    // The contract is guaranteed to exist here (compileString throws MissingContractError otherwise).
    node.contract = this.visit(node.contract!) as ContractNode;

    this.mergeInlinedDebugInfo();

    // Minimally encode output by going Script -> ASM -> Script
    this.output = asmToScript(scriptToAsm(this.output));

    this.sourceMap = generateSourceMap(this.locationData);

    return node;
  }

  private mergeInlinedDebugInfo(): void {
    this.inlineRanges.forEach(({ startIp, frame, line }) => {
      this.requires.push(...frame.requires.map((entry) => ({
        ...entry,
        ip: entry.ip + startIp,
        line,
      })));

      this.consoleLogs.push(...frame.logs.map((entry) => ({
        ...entry,
        ip: entry.ip + startIp,
        data: entry.data.map((item) => (typeof item === 'string' ? item : { ...item, ip: item.ip + startIp })),
        line,
      })));

      // Source tags use opcode indices rather than ips, which excludes the constructor arguments
      const startIndex = startIp - this.constructorParameterCount;
      this.sourceTags.push(...parseSourceTags(frame.sourceTags ?? '').map((entry) => ({
        ...entry,
        startIndex: entry.startIndex + startIndex,
        endIndex: entry.endIndex + startIndex,
      })));
    });

    // Restore overall program order, since the merged entries were appended after this program's own
    this.requires.sort((a, b) => a.ip - b.ip);
    this.consoleLogs.sort((a, b) => a.ip - b.ip);
    this.sourceTags.sort((a, b) => a.startIndex - b.startIndex);
  }

  private defineGlobalFunctions(node: SourceFileNode): void {
    // Assign function IDs to recursive functions first
    const recursiveFunctions = node.functions.filter(isRecursive);
    recursiveFunctions.forEach((func, functionId) => {
      node.symbolTable!.getFromThis(func.name)!.setFunctionId(functionId);
    });

    const reachableCalls = [node.contract!, ...node.functions].flatMap((n) => collectFunctionCalls(n));
    const entryReachableCalls = collectEntryReachableCalls(node);
    const loopResidentFunctions = collectLoopResidentFunctions(node);
    const definedFunctions: Array<{ func: FunctionDefinitionNode, compiledResult: OptimiseBytecodeResult }> = [];
    let nextFunctionId = recursiveFunctions.length;

    node.functions.forEach((func) => {
      const symbol = node.symbolTable!.getFromThis(func.name)!;
      const compiledResult = this.compileGlobalFunctionBody(func);

      // If the function should be inlined, we ONLY update the symbol
      const inline = shouldInline(
        symbol, compiledResult, reachableCalls, entryReachableCalls, loopResidentFunctions, nextFunctionId,
        this.compilerOptions,
      );
      if (inline) {
        symbol.setInlinedBytecode(compiledResult.script, this.buildDebugFrame(func, compiledResult));
        return;
      }

      // If the function ID is not yet assigned, we assign it (skipped for recursive functions which were assigned above)
      if (symbol.functionId === undefined) {
        symbol.setFunctionId(nextFunctionId);
        nextFunctionId += 1;
      }

      // Pre-assigned recursive functions and non-inlined functions should be defined
      definedFunctions[symbol.functionId!] = { func, compiledResult };
    });

    // Emit definitions in ID order so debug.functions[n] corresponds to the n-th define site (id n).
    definedFunctions.forEach(({ func, compiledResult }, functionId) => {
      this.frames.push(this.buildDebugFrame(func, compiledResult, functionId));
      this.definedFunctionArities.set(functionId, { in: func.parameters.length, out: func.returnTypes?.length ?? 0 });
      const locationData = { location: func.location, positionHint: PositionHint.START };
      this.emit(scriptToBytecode(compiledResult.script), locationData); // <function_body_bytes>
      this.emit(encodeInt(BigInt(functionId)), locationData); // <function_identifier>
      this.emit(Op.OP_DEFINE, { ...locationData, positionHint: PositionHint.END });
    });

    // Inlined callables are documented as id-less frames after the defined ones
    node.functions
      .flatMap((func) => node.symbolTable!.getFromThis(func.name)!.inlinedFrame ?? [])
      .forEach((frame) => this.frames.push(frame));
  }

  private compileGlobalFunctionBody(node: FunctionDefinitionNode): OptimiseBytecodeResult {
    const bodyTraversal = new GenerateTargetTraversal(this.compilerOptions);
    bodyTraversal.currentFunction = node;
    bodyTraversal.constructorParameterCount = 0;

    // Seed the stack with the first parameter on top, matching the right-to-left argument staging
    // at call sites (see stageUserFunctionArguments)
    node.parameters.forEach((parameter) => bodyTraversal.visit(parameter));
    bodyTraversal.dropUnusedParameters(node.parameters);

    bodyTraversal.visit(node.body);
    bodyTraversal.cleanGlobalFunctionStack(node);
    bodyTraversal.mergeInlinedDebugInfo();

    const optimisedResult = optimiseBytecode(
      bodyTraversal.output,
      bodyTraversal.locationData,
      bodyTraversal.consoleLogs,
      bodyTraversal.requires,
      bodyTraversal.sourceTags,
      bodyTraversal.inlineRanges,
      0,
    );

    return optimisedResult;
  }

  private buildDebugFrame(
    node: FunctionDefinitionNode,
    optimised: OptimiseBytecodeResult,
    functionId?: number,
  ): DebugFrame {
    return {
      id: functionId,
      name: node.name,
      kind: node.constant ? ('constant' as const) : undefined,
      inputs: node.parameters.map((parameter) => ({ name: parameter.name, type: parameter.type.toString() })),
      bytecode: binToHex(scriptToBytecode(optimised.script)),
      sourceMap: generateSourceMap(optimised.locationData),
      sourceTags: generateSourceTags(optimised.sourceTags) || undefined,
      sourceFile: node.sourceFile,
      logs: optimised.logs,
      requires: optimised.requires,
      inlineRanges: generateInlineRanges(optimised.inlineRanges) || undefined,
    };
  }

  cleanGlobalFunctionStack(node: FunctionDefinitionNode): void {
    // Drop everything below the return values on top (or the entire frame for a void function)
    this.cleanStack(node.body, node.returnTypes?.length ?? 0);
  }

  visitContract(node: ContractNode): Node {
    node.parameters = this.visitList(node.parameters) as ParameterNode[];

    // Keep track of constructor parameter count for instructor pointer calculation
    this.constructorParameterCount = node.parameters.length;
    this.dropUnusedParameters(node.parameters);

    if (node.functions.length === 1) {
      node.functions = this.visitList(node.functions) as FunctionDefinitionNode[];
    } else {
      this.pushToStack('$$', true);
      node.functions = node.functions.map((f, i) => {
        const locationData = { location: f.location, positionHint: PositionHint.START };

        const stackCopy = [...this.stack];
        const selectorIndex = this.getStackIndex('$$');

        this.emit(encodeInt(BigInt(selectorIndex)), locationData);
        if (i === node.functions.length - 1) {
          this.emit(Op.OP_ROLL, locationData);
          this.removeFromStack(selectorIndex);
        } else {
          this.emit(Op.OP_PICK, locationData);
        }

        // All functions are if-else statements, except the final one which is enforced with NUMEQUALVERIFY
        this.emit(encodeInt(BigInt(i)), locationData);
        this.emit(Op.OP_NUMEQUAL, locationData);

        if (i < node.functions.length - 1) {
          this.emit(Op.OP_IF, locationData);
        } else {
          this.emit(Op.OP_VERIFY, locationData);
        }

        f = this.visit(f) as FunctionDefinitionNode;

        if (i < node.functions.length - 1) {
          this.emit(Op.OP_ELSE, { ...locationData, positionHint: PositionHint.END });
        }

        this.stack = [...stackCopy];
        return f;
      });

      for (let i = 0; i < node.functions.length - 1; i += 1) {
        this.emit(Op.OP_ENDIF, { location: node.location, positionHint: PositionHint.END });
      }
    }

    return node;
  }

  visitFunctionDefinition(node: FunctionDefinitionNode): Node {
    if (node.kind !== FunctionKind.CONTRACT) {
      throw new Error('Internal error: global functions are compiled via defineGlobalFunctions');
    }

    this.currentFunction = node;

    node.parameters = this.visitList(node.parameters) as ParameterNode[];
    this.dropUnusedParameters(node.parameters);

    if (this.compilerOptions.enforceFunctionParameterTypes) {
      this.enforceFunctionParameterTypes(node);
    }

    node.body = this.visit(node.body) as BlockNode;

    this.removeFinalVerifyFromFunction(node.body);
    this.cleanStack(node.body);

    return node;
  }

  removeFinalVerifyFromFunction(functionBodyNode: Node): void {
    // After EnsureFinalRequireTraversal, we know that the final opcodes are either
    // "OP_VERIFY", "OP_CHECK{LOCKTIME|SEQUENCE}VERIFY OP_DROP", "OP_ENDIF" or "OP_UNTIL"

    const finalOp = this.output.pop() as Op;
    const { location, positionHint } = this.locationData.pop()!;

    // If the final op is OP_VERIFY and the stack size is less than 4 we remove it from the script
    // - We have the stack size check because it is more efficient to use 2DROP rather than NIP
    //   if >= 4 elements are left (5 including final value) (e.g. 2DROP 2DROP 1 < NIP NIP NIP NIP)
    if (finalOp === Op.OP_VERIFY && this.stack.length < 4) {
      // Since the final value is no longer popped from the stack by OP_VERIFY,
      // we add it back to the stack
      this.pushToStack('(value)');

      // Replace the location data of the final check (e.g. (x == 1)) with the location data of the
      // full require statement including the removed OP_VERIFY (e.g. require(x == 1)), because
      // the check opcode (e.g. OP_EQUAL) now represents the entire require statement (including implicit OP_VERIFY)
      this.locationData.pop();
      this.locationData.push({ location, positionHint });
    } else {
      this.emit(finalOp, { location, positionHint: PositionHint.END });

      // At this point there is no verification value left on the stack:
      //  - scoped stack is cleared inside block ended by OP_ENDIF or OP_UNTIL
      //  - OP_CHECK{LOCKTIME|SEQUENCE}VERIFY OP_DROP does not leave a verification value
      //  - OP_VERIFY does not leave a verification value
      // so we add OP_1 to the script (indicating success)
      this.emit(Op.OP_1, { location: functionBodyNode.location, positionHint: PositionHint.END });
      this.pushToStack('(value)');
    }
  }

  // Keep only the top `keepCount` values (a contract function's verification value, or a global
  // function's return values), dropping everything below them while preserving their order.
  cleanStack(functionBodyNode: Node, keepCount: number = 1): void {
    this.dropFromStack(functionBodyNode, keepCount, this.stack.length - keepCount);
  }

  private dropFromStack(node: Node, keepCount: number, dropCount: number): void {
    const tagStartIndex = this.output.length;
    const locationData = { location: node.location, positionHint: PositionHint.END };

    // Note that in case of keepCount = 1, this gets optimised to just OP_NIP, or for keepCount = 0 to OP_DROP
    for (let i = 0; i < dropCount; i += 1) {
      this.emit(encodeInt(BigInt(keepCount)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(keepCount);
    }

    this.tagScopeCleanup(tagStartIndex);
  }

  private dropUnusedParameters(parameters: ParameterNode[]): void {
    parameters
      .filter((parameter) => parameter.symbol!.isUnused())
      .sort((a, b) => this.getStackIndex(a.name) - this.getStackIndex(b.name))
      .forEach((parameter) => {
        const stackIndex = this.getStackIndex(parameter.name);
        const locationData = { location: parameter.location, positionHint: PositionHint.START };

        this.emit(encodeInt(BigInt(stackIndex)), locationData);
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(stackIndex);
      });
  }

  enforceFunctionParameterTypes(node: FunctionDefinitionNode): void {
    node.parameters.forEach((parameter) => this.enforceFunctionParameterType(parameter));
  }

  enforceFunctionParameterType(node: ParameterNode): void {
    if (!this.shouldEnforceFunctionParameterType(node)) return;

    const tagStartIndex = this.output.length;
    const stackIndex = this.getStackIndex(node.name);

    // We take the parameter from the stack and roll it to the top
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });
    this.emit(Op.OP_ROLL, { location: node.location, positionHint: PositionHint.START });

    // We remove the original stack value and push the new value to the top of the stack
    this.removeFromStack(stackIndex);
    this.pushToStack(node.name);

    // For booleans, we force-convert it to a boolean using OP_0NOTEQUAL
    if (node.type === PrimitiveType.BOOL) {
      this.emit(Op.OP_0NOTEQUAL, { location: node.location, positionHint: PositionHint.START });
    }

    // For bounded bytes, we *check* that it is the correct size using OP_SIZE and OP_EQUALVERIFY
    if (node.type instanceof BytesType && node.type.bound !== undefined) {
      this.emit(Op.OP_SIZE, { location: node.location, positionHint: PositionHint.START });
      this.emit(encodeInt(BigInt(node.type.bound)), { location: node.location, positionHint: PositionHint.START });
      this.emit(Op.OP_EQUALVERIFY, { location: node.location, positionHint: PositionHint.START });
    }

    // These checks are compiler-injected (no user source); tag them so the debug reconstruction
    // gives them their own annotation line positioned by bytecode order.
    this.sourceTags.push({
      startIndex: tagStartIndex,
      endIndex: this.output.length - 1,
      kind: SourceTagKind.PARAMETER_VALIDATION,
    });
  }

  shouldEnforceFunctionParameterType(node: ParameterNode): boolean {
    if (node.symbol!.isUnused()) return false;
    if (node.type === PrimitiveType.BOOL) return true;
    if (node.type instanceof BytesType && node.type.bound !== undefined) return true;

    // int parameters are deliberately not enforced: every numeric operation already fails on a value that is not a
    // valid VM number. Only an int that is never used numerically (e.g. only in `bytes(x)`) can hold other values,
    // which is too niche to justify adding a check to every contract with int parameters.
    return false;
  }

  visitParameter(node: ParameterNode): Node {
    this.pushToStack(node.name, true);
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    node.expression = this.visit(node.expression);

    if (node.symbol!.isUnused()) {
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack();
      return node;
    }

    this.popFromStack();
    this.pushToStack(node.name);
    this.declarationScopeDepths.set(node.name, this.scopeDepth);
    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    const renameInScope = this.scopeDepth > 0 && this.scopedReassignment === 'rename';
    if (renameInScope) {
      const reassigned = node.targets.filter((target) => target.isReassignment && !target.identifier.symbol!.isUnused());
      this.markConsumedReads(reassigned.map((target) => target.identifier), node.tuple);
    }

    node.tuple = this.visit(node.tuple);

    // Outside of a loop/branch (or when renaming inside one), a reassignment is just a rename
    const scopedReassign = this.scopeDepth > 0 && node.targets.some((target) => target.isReassignment);
    if (!scopedReassign || renameInScope) {
      this.popFromStack(node.targets.length);
      node.targets
        .filter((target) => target.isReassignment)
        .forEach((target) => this.renameReassignedVariable(target.identifier.name));
      node.targets.forEach((target) => this.pushToStack(target.identifier.name));
      node.targets
        .filter((target) => !target.isReassignment)
        .forEach((target) => this.declarationScopeDepths.set(target.identifier.name, this.scopeDepth));
      this.dropUnusedTupleTargets(node);
      return node;
    }

    const locationData = { location: node.location, positionHint: PositionHint.END };
    const parkedDeclarations: string[] = [];

    const reversedTargets = [...node.targets].reverse();
    reversedTargets.forEach((target) => {
      // Unused variables are never added the stack, so their defined or re-assigned value is dropped
      if (target.identifier.symbol!.isUnused()) {
        this.emit(Op.OP_DROP, locationData);
      } else if (target.isReassignment) {
        this.emitReplace(this.getStackIndex(target.identifier.name), node);
      } else {
        this.emit(Op.OP_TOALTSTACK, locationData);
        parkedDeclarations.push(target.identifier.name);
      }
      this.popFromStack();
    });

    parkedDeclarations.reverse().forEach((name) => {
      this.emit(Op.OP_FROMALTSTACK, locationData);
      this.pushToStack(name);
    });

    return node;
  }

  private dropUnusedTupleTargets(node: TupleAssignmentNode): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    node.targets
      .filter((target) => target.identifier.symbol!.isUnused())
      .sort((a, b) => this.getStackIndex(a.identifier.name) - this.getStackIndex(b.identifier.name))
      .forEach((target) => {
        const stackIndex = this.getStackIndex(target.identifier.name);
        this.emit(encodeInt(BigInt(stackIndex)), locationData);
        this.emit(Op.OP_ROLL, locationData);
        this.emit(Op.OP_DROP, locationData);
        this.removeFromStack(stackIndex);
      });
  }

  visitAssign(node: AssignNode): Node {
    const renameInScope = this.scopeDepth > 0 && this.scopedReassignment === 'rename';
    if (renameInScope && !node.identifier.symbol!.isUnused()) {
      this.markConsumedReads([node.identifier], node.expression);
    }

    node.expression = this.visit(node.expression);

    // An unused variable never gets added to the stack, so the assigned value is dropped as well
    if (node.identifier.symbol!.isUnused()) {
      this.emit(Op.OP_DROP, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack();
      return node;
    }

    if (this.scopeDepth > 0 && !renameInScope) {
      this.emitReplace(this.getStackIndex(node.identifier.name), node);
      this.popFromStack();
    } else {
      this.popFromStack();
      this.renameReassignedVariable(node.identifier.name);
      this.pushToStack(node.identifier.name);
    }
    return node;
  }

  // Outside of a loop/branch, a reassignment leaves the old value on the stack (it gets dropped with the rest of the
  // stack at the end of the function). We make that old slot anonymous, so it can never be read as the new value.
  // Inside a scope (renaming), the slot gets a unique name so that the scope's reconcileStack can drop it.
  private renameReassignedVariable(name: string): void {
    const stackIndex = this.getStackIndex(name, true);
    if (stackIndex === -1) return;
    this.stack[stackIndex] = this.scopeDepth > 0 ? this.uniqueSlotName('(dead)') : '(value)';
  }

  // A reassignment target that its right-hand side reads exactly once is consumed (rolled instead of
  // picked) by that read, since the old value is dead right after it
  private markConsumedReads(targets: IdentifierNode[], expression: Node): void {
    const collector = new IdentifierReadCollector();
    collector.visit(expression);
    targets.forEach((target) => {
      const reads = collector.reads.filter((read) => read.name === target.name);
      if (reads.length === 1) this.consumedReads.add(reads[0]);
    });
  }

  private uniqueSlotName(prefix: string): string {
    this.slotCounter += 1;
    return `${prefix}#${this.slotCounter}`;
  }

  // The stack layout at a scope's entry. Anonymous slots get unique names, so they can be tracked by name.
  private snapshotStack(): string[] {
    this.stack = this.stack.map((name) => (name === '(value)' ? this.uniqueSlotName('(value)') : name));
    return [...this.stack];
  }

  // Restore a scope's entry layout: drop what the scope added (scoped declarations, the old slots of renamed
  // reassignments), then, if reorder is set, roll the variables that moved back into their entry order.
  private reconcileStack(
    target: string[], node: Node, reorder: boolean = true, positionHint: PositionHint = PositionHint.END,
  ): void {
    const locationData = { location: node.location, positionHint };
    const tagStartIndex = this.output.length;

    this.stack.filter((name) => !target.includes(name)).forEach((name) => {
      const stackIndex = this.getStackIndex(name);
      this.emit(encodeInt(BigInt(stackIndex)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.emit(Op.OP_DROP, locationData);
      this.removeFromStack(stackIndex);
    });
    this.tagScopeCleanup(tagStartIndex);

    if (!reorder) return;

    // Items at the bottom that are already in place stay; the others are rolled up, deepest first
    let inPlace = 0;
    while (inPlace < target.length && this.stack.at(-1 - inPlace) === target.at(-1 - inPlace)) inPlace += 1;

    target.slice(0, target.length - inPlace).reverse().forEach((name) => {
      const stackIndex = this.getStackIndex(name);
      if (stackIndex === 0) return;
      this.emit(encodeInt(BigInt(stackIndex)), locationData);
      this.emit(Op.OP_ROLL, locationData);
      this.removeFromStack(stackIndex);
      this.pushToStack(name);
    });
  }

  // Branches and loops are compiled with both reassignment strategies (unless forced or nested too deep),
  // keeping the cheaper one: renaming wins big for deep loop-carried variables, while replacing stays
  // cheaper for shallow ones, where the peephole optimiser shortens emitReplace's shuffles. Loops also try
  // renaming with a relaid-out loop head (see relayoutLoopHead).
  private chooseScopedReassignment(node: Node, emitScope: (relayoutLoopHead: boolean) => void): void {
    const outerStrategy = this.scopedReassignment;
    const forcedStrategy = this.compilerOptions.scopedReassignment;

    if (forcedStrategy || this.scopeDepth >= MAX_REASSIGNMENT_TRIAL_DEPTH || !containsReassignment(node)) {
      this.scopedReassignment = forcedStrategy ?? outerStrategy;
      emitScope(false);
      this.scopedReassignment = outerStrategy;
      return;
    }

    const isLoop = node instanceof ForNode || node instanceof WhileNode || node instanceof DoWhileNode;
    const options = [
      { strategy: 'replace' as const, relayoutLoopHead: false },
      { strategy: 'rename' as const, relayoutLoopHead: false },
      ...(isLoop ? [{ strategy: 'rename' as const, relayoutLoopHead: true }] : []),
    ];

    const start = this.saveState();
    const candidates = options.map(({ strategy, relayoutLoopHead }) => {
      this.restoreState(start);
      this.scopedReassignment = strategy;
      emitScope(relayoutLoopHead);
      return { state: this.saveState(), cost: this.costSince(start.output.length) };
    });

    // Ties keep the earliest option ('replace' first)
    const best = candidates.reduce((a, b) => (compareCosts(b.cost, a.cost) < 0 ? b : a));
    this.restoreState(best.state);
    this.scopedReassignment = outerStrategy;
  }

  private saveState(): TraversalState {
    return {
      output: [...this.output],
      locationData: [...this.locationData],
      stack: [...this.stack],
      consoleLogs: [...this.consoleLogs],
      requires: [...this.requires],
      sourceTags: [...this.sourceTags],
      finalStackUsage: { ...this.finalStackUsage },
      inlineRanges: [...this.inlineRanges],
      consumedReads: new Set(this.consumedReads),
    };
  }

  private restoreState(state: TraversalState): void {
    this.output = [...state.output];
    this.locationData = [...state.locationData];
    this.stack = [...state.stack];
    this.consoleLogs = [...state.consoleLogs];
    this.requires = [...state.requires];
    this.sourceTags = [...state.sourceTags];
    this.finalStackUsage = { ...state.finalStackUsage };
    this.inlineRanges = [...state.inlineRanges];
    this.consumedReads = new Set(state.consumedReads);
  }

  // The cost of the code emitted since startIndex, after peephole optimisation, ordered by the optimisation
  // objective: [bytes, weighted instructions] for 'size', the reverse for 'opcost'. Instructions inside
  // loops are weighted by 16 per nesting level, as a static stand-in for their iteration count.
  private costSince(startIndex: number): [number, number] {
    const fragment = asmToScript(scriptToAsm(this.output.slice(startIndex)));
    const { script } = optimiseBytecode(fragment, this.locationData.slice(startIndex), [], [], [], [], 0);

    let loopDepth = 0;
    let weightedInstructions = 0;
    script.forEach((op) => {
      if (op === Op.OP_UNTIL) loopDepth = Math.max(0, loopDepth - 1);
      weightedInstructions += 16 ** loopDepth;
      if (op === Op.OP_BEGIN) loopDepth += 1;
    });

    const bytes = scriptToBytecode(script).length;
    return this.compilerOptions.optimizeFor === 'size' ? [bytes, weightedInstructions] : [weightedInstructions, bytes];
  }

  // This algorithm can be optimised for hardcoded depths
  // See thesis for explanation
  emitReplace(index: number, node: Node): void {
    const locationData = { location: node.location, positionHint: PositionHint.END };

    this.emit(encodeInt(BigInt(index)), locationData);
    this.emit(Op.OP_ROLL, locationData);
    this.emit(Op.OP_DROP, locationData);
    for (let i = 0; i < index - 1; i += 1) {
      this.emit(Op.OP_SWAP, locationData);
      if (i < index - 2) {
        this.emit(Op.OP_TOALTSTACK, locationData);
      }
    }
    for (let i = 0; i < index - 2; i += 1) {
      this.emit(Op.OP_FROMALTSTACK, locationData);
    }
  }

  visitTimeOp(node: TimeOpNode): Node {
    const tagStartIndex = this.output.length;
    node.expression = this.visit(node.expression);
    this.emit(compileTimeOp(node.timeOp), { location: node.location, positionHint: PositionHint.END });

    this.requires.push({
      // We're removing 1 from the IP because the error message needs to match the OP_XXX_VERIFY, not the OP_DROP that
      // is emitted directly after
      ip: this.getMostRecentInstructionPointer() - 1,
      line: node.location.start.line,
      message: node.message,
    });

    // The auto-injected tx.locktime guard is emitted after the parameter prologue but has no
    // user source; tag it so the debug reconstruction positions it by bytecode order.
    if (node.isGuard) {
      this.sourceTags.push({
        startIndex: tagStartIndex,
        endIndex: this.output.length - 1,
        kind: SourceTagKind.LOCKTIME_GUARD,
      });
    }

    this.popFromStack();
    return node;
  }

  visitRequire(node: RequireNode): Node {
    node.expression = this.visit(node.expression);

    this.emit(Op.OP_VERIFY, { location: node.location, positionHint: PositionHint.END });

    this.requires.push({
      ip: this.getMostRecentInstructionPointer(),
      line: node.location.start.line,
      message: node.message,
    });

    this.popFromStack();
    return node;
  }

  visitConsoleStatement(node: ConsoleStatementNode): Node {
    // We add a plus 1 to the most recent instruction pointer, because we want to log the state
    // of the stack *after* the most recent instruction has been executed
    const ip = this.getMostRecentInstructionPointer() + 1;
    const { line } = node.location.start;

    const data = node.parameters.map((parameter: ConsoleParameterNode) => {
      if (parameter instanceof IdentifierNode) {
        const symbol = parameter.symbol!;

        // If the variable is not on the stack, then we add the final stack usage to the console log
        const stackIndex = this.getStackIndex(parameter.name, true);
        if (stackIndex === -1) {
          if (!this.finalStackUsage[parameter.name]) {
            throw new Error(`Expected variable '${parameter.name}' does not exist on the stack or in final stack usage`);
          }
          return this.finalStackUsage[parameter.name];
        }

        // If the variable is on the stack, we add the stack index and type to the console log
        const type = symbol.type.toString();
        return { stackIndex, type, ip };
      }

      return parameter.toString();
    });

    this.consoleLogs.push({ ip, line, data });

    return node;
  }

  visitBranch(node: BranchNode): Node {
    this.chooseScopedReassignment(node, () => this.emitBranch(node));
    return node;
  }

  private emitBranch(node: BranchNode): void {
    node.condition = this.visit(node.condition);
    this.popFromStack();

    this.scopeDepth += 1;
    this.emit(Op.OP_IF, { location: node.ifBlock.location, positionHint: PositionHint.START });

    // Both branches end in the layout the branch was entered with
    const entryStack = this.snapshotStack();
    node.ifBlock = this.visit(node.ifBlock);
    this.reconcileStack(entryStack, node.ifBlock);

    if (node.elseBlock) {
      this.emit(Op.OP_ELSE, { location: node.elseBlock.location, positionHint: PositionHint.START });
      node.elseBlock = this.visit(node.elseBlock);
      this.reconcileStack(entryStack, node.elseBlock);
    }

    const endLocationData = {
      location: node.elseBlock ? node.elseBlock.location : node.ifBlock.location,
      positionHint: PositionHint.END,
    };

    this.emit(Op.OP_ENDIF, endLocationData);
    this.scopeDepth -= 1;
  }

  visitDoWhile(node: DoWhileNode): Node {
    this.chooseScopedReassignment(node, (relayoutLoopHead) => {
      const outerStack = [...this.stack];
      if (relayoutLoopHead) this.relayoutLoopHead(node, () => this.emitDoWhile(node));
      this.emitDoWhile(node);
      if (relayoutLoopHead) this.reconcileStack(outerStack, node);
    });
    return node;
  }

  // Returns the layout at the end of the loop body, before it is reconciled (see relayoutLoopHead)
  private emitDoWhile(node: DoWhileNode): string[] {
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, { location: node.location, positionHint: PositionHint.START });

    // Every iteration ends in the layout the loop was entered with
    const entryStack = this.snapshotStack();
    node.block = this.visit(node.block);
    const exitStack = [...this.stack];
    this.reconcileStack(entryStack, node.block);

    node.condition = this.visit(node.condition);
    this.emit(Op.OP_NOT, { location: node.location, positionHint: PositionHint.END });

    this.emit(Op.OP_UNTIL, { location: node.location, positionHint: PositionHint.END });
    this.popFromStack();

    this.scopeDepth -= 1;
    return exitStack;
  }

  visitWhile(node: WhileNode): Node {
    this.chooseScopedReassignment(node, (relayoutLoopHead) => {
      const outerStack = [...this.stack];
      if (relayoutLoopHead) this.relayoutLoopHead(node, () => this.emitWhile(node));
      this.emitWhile(node);
      if (relayoutLoopHead) this.reconcileStack(outerStack, node);
    });
    return node;
  }

  // Returns the layout at the end of the loop body, before it is reconciled (see relayoutLoopHead)
  private emitWhile(node: WhileNode): string[] {
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, { location: node.location, positionHint: PositionHint.START });

    node.condition = this.visit(node.condition);
    this.emit(Op.OP_DUP, { location: node.condition.location, positionHint: PositionHint.END });
    this.pushToStack('(value)');
    this.emit(Op.OP_TOALTSTACK, { location: node.condition.location, positionHint: PositionHint.END });
    this.popFromStack();

    this.popFromStack();
    this.emit(Op.OP_IF, { location: node.block.location, positionHint: PositionHint.START });

    const bodyEntryStack = this.snapshotStack();
    node.block = this.visit(node.block) as BlockNode;
    const exitStack = [...this.stack];
    this.reconcileStack(bodyEntryStack, node.block);

    this.emitLoopCondition(node);

    this.scopeDepth -= 1;
    return exitStack;
  }

  visitFor(node: ForNode): Node {
    this.chooseScopedReassignment(node, (relayoutLoopHead) => this.emitFor(node, relayoutLoopHead));
    return node;
  }

  private emitFor(node: ForNode, relayoutLoopHead: boolean): void {
    // If the init is a re-assignment, we need to increment the scope depth so it gets treated as a scoped reassignment
    // (and therefore the stack value gets properly replaced)
    const isReassignment = node.init instanceof AssignNode;
    if (isReassignment) this.scopeDepth += 1;
    node.init = this.visit(node.init) as VariableDefinitionNode | AssignNode;
    if (isReassignment) this.scopeDepth -= 1;

    // What remains after the loop: the stack after the init (which may have consumed variables), without a
    // declared loop variable
    const forScopeStack = this.snapshotStack()
      .filter((name) => !(node.init instanceof VariableDefinitionNode && name === node.init.name));

    if (relayoutLoopHead) this.relayoutLoopHead(node, () => this.emitForLoop(node));
    this.emitForLoop(node);

    // After the loop the loop variable goes. A relaid-out loop head is also put back in order, which keeps
    // the code after the loop unaffected; otherwise an enclosing scope restores the order if it needs to.
    this.reconcileStack(forScopeStack, node, relayoutLoopHead);
  }

  // Returns the layout at the end of the loop body and update, before it is reconciled (see relayoutLoopHead)
  private emitForLoop(node: ForNode): string[] {
    this.scopeDepth += 1;
    this.emit(Op.OP_BEGIN, { location: node.location, positionHint: PositionHint.START });

    node.condition = this.visit(node.condition);
    this.emit(Op.OP_DUP, { location: node.condition.location, positionHint: PositionHint.END });
    this.pushToStack('(value)');
    this.emit(Op.OP_TOALTSTACK, { location: node.condition.location, positionHint: PositionHint.END });
    this.popFromStack();

    this.popFromStack();
    this.emit(Op.OP_IF, { location: node.block.location, positionHint: PositionHint.START });

    const bodyEntryStack = this.snapshotStack();
    node.block = this.visit(node.block) as BlockNode;

    const updateStartIndex = this.output.length;
    node.update = this.visit(node.update) as AssignNode;
    const updateEndIndex = this.output.length - 1;
    this.sourceTags.push({ startIndex: updateStartIndex, endIndex: updateEndIndex, kind: SourceTagKind.FOR_UPDATE });

    // Every iteration (body and update) ends in the layout the loop was entered with
    const exitStack = [...this.stack];
    this.reconcileStack(bodyEntryStack, node.block);

    this.emitLoopCondition(node);

    this.scopeDepth -= 1;
    return exitStack;
  }

  // Renaming leaves reassigned loop-carried variables in a different order at the end of the body than at
  // the loop head, so every iteration pays for rolling them back. Instead, the loop head can take the order
  // they have at the end of the body: compile the loop once to see that order, then discard it and permute
  // the stack into that order once before the loop. When the body reassigns the same variables in the same
  // order every iteration, this layout is a fixed point and the per-iteration reconcile only drops values.
  // The caller puts the stack back in its original order after the loop.
  private relayoutLoopHead(node: Node, emitLoop: () => string[]): void {
    const beforeLoop = this.saveState();
    const exitStack = emitLoop();
    this.restoreState(beforeLoop);

    const exitPosition = (name: string): number => {
      const index = exitStack.indexOf(name);
      return index === -1 ? Infinity : index;
    };
    const headLayout = [...this.stack].sort((a, b) => exitPosition(a) - exitPosition(b));
    this.reconcileStack(headLayout, node, true, PositionHint.START);
  }

  // Emits the loop-back epilogue shared by while- and for-loops: OP_ENDIF closes the body branch,
  // then OP_FROMALTSTACK OP_NOT OP_UNTIL re-checks the saved condition and jumps back. These are
  // compiler-injected and map to the closing brace; tag them so the debug reconstruction renders a
  // ">>> loop condition check" annotation line (and the following loop-variable cleanup) before the brace.
  private emitLoopCondition(node: WhileNode | ForNode): void {
    const tagStartIndex = this.output.length;
    this.emit(Op.OP_ENDIF, { location: node.block.location, positionHint: PositionHint.END });
    this.emit(Op.OP_FROMALTSTACK, { location: node.block.location, positionHint: PositionHint.END });
    this.pushToStack('(value)');
    this.emit(Op.OP_NOT, { location: node.location, positionHint: PositionHint.END });
    this.emit(Op.OP_UNTIL, { location: node.location, positionHint: PositionHint.END });
    this.popFromStack();
    this.sourceTags.push({
      startIndex: tagStartIndex,
      endIndex: this.output.length - 1,
      kind: SourceTagKind.LOOP_CONDITION,
    });
  }

  private tagScopeCleanup(tagStartIndex: number): void {
    if (this.output.length <= tagStartIndex) return;
    this.sourceTags.push({
      startIndex: tagStartIndex,
      endIndex: this.output.length - 1,
      kind: SourceTagKind.SCOPE_CLEANUP,
    });
  }

  visitCast(node: CastNode): Node {
    node.expression = this.visit(node.expression);

    this.emit(
      compileCast(node.expression.type as PrimitiveType, node.type, node.isUnsafe),
      { location: node.location, positionHint: PositionHint.END },
    );
    this.popFromStack();
    this.pushToStack('(value)');
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    if (node.identifier.name === GlobalFunction.CHECKMULTISIG) {
      return this.visitMultiSig(node);
    }

    const symbol = node.identifier.symbol!;

    if (symbol.definition instanceof FunctionDefinitionNode) {
      this.stageUserFunctionArguments(node);
    } else {
      node.parameters = this.visitList(node.parameters);
    }

    const startIp = this.output.length + this.constructorParameterCount;
    const endIp = startIp + symbol.bytecode!.length - 1;

    this.emit(symbol.bytecode!, { location: node.location, positionHint: PositionHint.END });

    if (symbol.inlinedFrame) {
      this.inlineRanges.push({ startIp, endIp, frame: symbol.inlinedFrame, line: node.location.start.line });
    }

    this.popFromStack(node.parameters.length);

    // The call leaves one value per declared return type (none for a void function); a multi-return
    // function's values (a TupleType) are subsequently bound by visitTupleAssignment.
    const returnValueCount = symbol.type === PrimitiveType.VOID ? 0
      : symbol.type instanceof TupleType ? symbol.type.elementTypes.length : 1;
    for (let i = 0; i < returnValueCount; i += 1) this.pushToStack('(value)');

    return node;
  }

  // User function arguments are staged right-to-left so the first argument ends up on top of the
  // stack (the layout the function body is compiled against). With arguments that are variables in
  // declaration order, the emitted ROLLs then cancel to nothing in the optimiser, so a typical call
  // costs zero staging instructions. Because reversed emission breaks the textual final-use order,
  // a variable is only allowed to ROLL when it appears exactly once across the whole argument tree
  // (see isOpRoll); everything else stays a PICK.
  private stageUserFunctionArguments(node: FunctionCallNode): void {
    const isOutermostCall = this.userCallArgDepth === 0;
    if (isOutermostCall) {
      const counter = new ArgIdentifierCounter();
      node.parameters.forEach((argument) => counter.visit(argument));
      this.callArgNameCounts = counter.counts;
    }

    this.userCallArgDepth += 1;
    for (let i = node.parameters.length - 1; i >= 0; i -= 1) {
      node.parameters[i] = this.visit(node.parameters[i]);
    }
    this.userCallArgDepth -= 1;

    if (isOutermostCall) this.callArgNameCounts = null;
  }

  visitMultiSig(node: FunctionCallNode): Node {
    this.emit(encodeBool(false), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    node.parameters = this.visitList(node.parameters);
    this.emit(Op.OP_CHECKMULTISIG, { location: node.location, positionHint: PositionHint.END });
    const sigs = node.parameters[0] as ArrayNode;
    const pks = node.parameters[1] as ArrayNode;
    this.popFromStack(sigs.elements.length + pks.elements.length + 3);
    this.pushToStack('(value)');

    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    if (node.identifier.name === Class.LOCKING_BYTECODE_P2PKH) {
      // OP_DUP OP_HASH160 OP_PUSH<20>
      this.emit(hexToBin('76a914'), { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      // <pkh>
      this.visit(node.parameters[0]);
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      // OP_EQUAL OP_CHECKSIG
      this.emit(hexToBin('88ac'), { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack(2);
    } else if (node.identifier.name === Class.LOCKING_BYTECODE_P2SH20) {
      // OP_HASH160 OP_PUSH<20>
      this.emit(hexToBin('a914'), { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      // <script hash>
      this.visit(node.parameters[0]);
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      // OP_EQUAL
      this.emit(hexToBin('87'), { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack(2);
    } else if (node.identifier.name === Class.LOCKING_BYTECODE_P2SH32) {
      // OP_HASH256 OP_PUSH<32>
      this.emit(hexToBin('aa20'), { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      // <script hash>
      this.visit(node.parameters[0]);
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      // OP_EQUAL
      this.emit(hexToBin('87'), { location: node.location, positionHint: PositionHint.END });
      this.emit(Op.OP_CAT, { location: node.location, positionHint: PositionHint.END });
      this.popFromStack(2);
    } else if (node.identifier.name === Class.LOCKING_BYTECODE_NULLDATA) {
      // Total script = OP_RETURN (<push opcode> <chunk>)+
      // OP_RETURN
      this.emit(hexToBin('6a'), { location: node.location, positionHint: PositionHint.START });
      this.pushToStack('(value)');
      const { elements } = node.parameters[0] as ArrayNode;
      elements.forEach((element) => this.emitNullDataChunk(element));
      this.popFromStack();
    } else {
      throw new Error(); // Should not happen
    }

    this.pushToStack('(value)');

    return node;
  }

  // Appends <push opcode> <chunk> to the OP_RETURN script on top of the stack. The push opcode has to match
  // encodeNullDataScript(): OP_PUSHBYTES_N for 1-75 bytes, and OP_PUSHDATA1 N for 0 or 76-255 bytes
  private emitNullDataChunk(element: ExpressionNode): void {
    const startLocationData = { location: element.location, positionHint: PositionHint.START };
    const endLocationData = { location: element.location, positionHint: PositionHint.END };

    // Chunks with a value known at compile time are pushed together with their push opcode
    // (encodeNullDataScript() without an OP_RETURN encodes just the chunk, exactly like the SDK does)
    const compileTimeValue = getCompileTimeBytes(element);
    if (compileTimeValue !== undefined) {
      this.emit(encodeNullDataScript([compileTimeValue]), startLocationData);
      this.emit(Op.OP_CAT, endLocationData);
      return;
    }

    // Chunks with a length known at compile time (e.g. bytes20) are preceded by a constant push opcode
    if (element.type instanceof BytesType && element.type.bound !== undefined) {
      this.emit(encodeNullDataPushOpcode(element.type.bound), startLocationData);
      this.pushToStack('(value)');
      this.visit(element);
      this.emit(Op.OP_CAT, endLocationData);
      this.emit(Op.OP_CAT, endLocationData);
      this.popFromStack(2);
      return;
    }

    // Otherwise the push opcode is computed from the chunk's size at runtime
    this.visit(element);

    // OP_SIZE is a signed VM number, so it is empty for empty elements, and has an extra 0x00 byte for 128-255 bytes.
    // In those cases (and for 76-127 bytes) we convert it to a single byte, and prepend OP_PUSHDATA1. Chunks over 255
    // bytes are not supported, so the size's high byte has to be 0x00 (an OP_0 would be empty and never match it).
    this.emit(Op.OP_SIZE, endLocationData);
    this.emit(Op.OP_DUP, endLocationData);
    this.emit(encodeInt(1n), endLocationData);
    this.emit(encodeInt(76n), endLocationData);
    this.emit(Op.OP_WITHIN, endLocationData);
    this.emit(Op.OP_NOTIF, endLocationData);
    this.emit(encodeInt(2n), endLocationData);
    this.emit(Op.OP_NUM2BIN, endLocationData);
    this.emit(encodeInt(1n), endLocationData);
    this.emit(Op.OP_SPLIT, endLocationData);
    this.emit(hexToBin('00'), endLocationData);
    this.emit(Op.OP_EQUALVERIFY, endLocationData);
    this.emit(hexToBin('4c'), endLocationData);
    this.emit(Op.OP_SWAP, endLocationData);
    this.emit(Op.OP_CAT, endLocationData);
    this.emit(Op.OP_ENDIF, endLocationData);

    // Concat push opcode and chunk to the OP_RETURN script
    this.emit(Op.OP_SWAP, endLocationData);
    this.emit(Op.OP_CAT, endLocationData);
    this.emit(Op.OP_CAT, endLocationData);
    this.popFromStack();
  }

  visitTupleIndexOp(node: TupleIndexOpNode): Node {
    node.tuple = this.visit(node.tuple);

    const locationData = { location: node.location, positionHint: PositionHint.END };

    if (node.index === 0) {
      this.emit(Op.OP_DROP, locationData);
      this.popFromStack();
    } else if (node.index === 1) {
      this.emit(Op.OP_NIP, locationData);
      this.nipFromStack();
    }

    return node;
  }

  // element.slice(start, end) is equivalent to element.split(end)[0].split(start)[1]
  visitSlice(node: SliceNode): Node {
    node.element = this.visit(node.element);

    const locationData = { location: node.location, positionHint: PositionHint.END };

    this.visit(node.end);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_DROP, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');

    this.visit(node.start);
    this.emit(Op.OP_SPLIT, locationData);
    this.emit(Op.OP_NIP, locationData);
    this.popFromStack(2);
    this.pushToStack('(value)');

    return node;
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    node.left = this.visit(node.left);
    node.right = this.visit(node.right);
    const bothOperandsAreNumeric = isNumericType(node.left.type) && isNumericType(node.right.type);
    this.emit(
      compileBinaryOp(node.operator, bothOperandsAreNumeric),
      { location: node.location, positionHint: PositionHint.END },
    );
    this.popFromStack(2);
    this.pushToStack('(value)');
    if (node.operator === BinaryOperator.SPLIT) this.pushToStack('(value)');
    return node;
  }

  visitUnaryOp(node: UnaryOpNode): Node {
    node.expression = this.visit(node.expression);
    this.emit(compileUnaryOp(node.operator), { location: node.location, positionHint: PositionHint.END });
    this.popFromStack();
    this.pushToStack('(value)');
    return node;
  }

  visitNullaryOp(node: NullaryOpNode): Node {
    this.emit(compileNullaryOp(node.operator), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitArray(node: ArrayNode): Node {
    node.elements = this.visitList(node.elements);
    this.emit(encodeInt(BigInt(node.elements.length)), { location: node.location, positionHint: PositionHint.END });
    this.pushToStack('(value)');
    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    const stackIndex = this.getStackIndex(node.name);
    this.emit(encodeInt(BigInt(stackIndex)), { location: node.location, positionHint: PositionHint.START });

    // If the final use is inside an if-statement, we still OP_PICK it
    // We do this so that there's no difference in stack depths between execution paths
    if (this.isOpRoll(node)) {
      // A consumed read is not a final use: the variable is renamed onto the stack right after it
      if (!this.consumedReads.has(node)) {
        this.finalStackUsage[node.name] = {
          type: node.symbol!.type.toString(),
          stackIndex,
          ip: this.getMostRecentInstructionPointer(),
        };
      }

      this.emit(Op.OP_ROLL, { location: node.location, positionHint: PositionHint.START });
      this.removeFromStack(stackIndex);
    } else {
      this.emit(Op.OP_PICK, { location: node.location, positionHint: PositionHint.START });
    }

    this.pushToStack('(value)');
    return node;
  }

  isOpRoll(node: IdentifierNode): boolean {
    if (this.consumedReads.has(node)) {
      return this.userCallArgDepth === 0 || this.callArgNameCounts?.get(node.name) === 1;
    }

    if (this.currentFunction.opRolls.get(node.name) !== node) return false;
    if (this.scopeDepth !== 0 && !this.isBlockLocalFinalRead(node)) return false;

    // Inside a user function call's argument list, only variables that appear exactly once across
    // the whole argument tree may ROLL (see stageUserFunctionArguments)
    if (this.userCallArgDepth > 0) return this.callArgNameCounts?.get(node.name) === 1;

    return true;
  }

  // Inside a branch or loop, final reads are picked by default, so that every execution path leaves the
  // same stack. When renaming, a variable's final read can roll it if the read is in the block the variable
  // was declared in: that block's own reconcileStack would drop it anyway, and since the read is not in a
  // nested loop or branch, it happens exactly once per execution of the block.
  private isBlockLocalFinalRead(node: IdentifierNode): boolean {
    return this.scopedReassignment === 'rename' && this.declarationScopeDepths.get(node.name) === this.scopeDepth;
  }

  visitBoolLiteral(node: BoolLiteralNode): Node {
    this.emit(encodeBool(node.value), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitIntLiteral(node: IntLiteralNode): Node {
    this.emit(encodeInt(node.value), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitStringLiteral(node: StringLiteralNode): Node {
    this.emit(encodeString(node.value), { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }

  visitHexLiteral(node: HexLiteralNode): Node {
    this.emit(node.value, { location: node.location, positionHint: PositionHint.START });
    this.pushToStack('(value)');
    return node;
  }
}

// Collects the variable reads of an expression (callee identifiers are not stack-variable reads)
class IdentifierReadCollector extends AstTraversal {
  reads: IdentifierNode[] = [];

  visitIdentifier(node: IdentifierNode): Node {
    this.reads.push(node);
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }
}

class ReassignmentFinder extends AstTraversal {
  found = false;

  visitAssign(node: AssignNode): Node {
    this.found = true;
    return node;
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    if (node.targets.some((target) => target.isReassignment)) this.found = true;
    return node;
  }
}

function containsReassignment(node: Node): boolean {
  const finder = new ReassignmentFinder();
  finder.visit(node);
  return finder.found;
}

// Lexicographic comparison of two costs
function compareCosts(a: number[], b: number[]): number {
  const index = a.findIndex((value, i) => value !== b[i]);
  return index === -1 ? 0 : a[index] - b[index];
}

// Counts identifier reads across a user function call's whole argument tree. Callee identifiers
// are not stack-variable reads, so only the call arguments are counted.
class ArgIdentifierCounter extends AstTraversal {
  counts: Map<string, number> = new Map();

  visitIdentifier(node: IdentifierNode): Node {
    this.counts.set(node.name, (this.counts.get(node.name) ?? 0) + 1);
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }
}
