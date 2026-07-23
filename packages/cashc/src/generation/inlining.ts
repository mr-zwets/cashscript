import {
  encodeInt,
  OptimiseBytecodeResult,
  Script,
  scriptToBytecode,
} from '@cashscript/utils';
import {
  DoWhileNode,
  ForNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  Node,
  SourceFileNode,
  WhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Symbol } from '../ast/SymbolTable.js';
import type { InternalCompilerOptions } from '../compiler.js';

export const shouldInline = (
  symbol: Symbol,
  optimisedResult: OptimiseBytecodeResult,
  reachableCalls: FunctionCallNode[],
  loopResidentFunctions: Set<FunctionDefinitionNode>,
  nextFunctionId: number,
  compilerOptions: InternalCompilerOptions,
): boolean => {
  if (compilerOptions.disableInlining) return false;
  if (symbol.functionId !== undefined) return false;

  // Loop-resident functions stay OP_DEFINE'd to avoid stepping cost. Tiny bodies (<= 2 script
  // elements) are exempt: inlined they step no more opcodes than the 2-op invoke site even when
  // skipped, execute fewer when taken, and save the define/invoke bytes — strictly dominant.
  const definition = symbol.definition;
  if (
    definition instanceof FunctionDefinitionNode
    && loopResidentFunctions.has(definition)
    && optimisedResult.script.length > 2
  ) {
    return false;
  }

  const callCount = reachableCalls.filter((call) => call.identifier.symbol === symbol).length;
  return isWorthInlining(nextFunctionId, optimisedResult.script, callCount);
};

function isWorthInlining(candidateFunctionId: number, bodyScript: Script, callCount: number): boolean {
  const bodyBytes = scriptToBytecode(bodyScript).length;
  const idBytes = scriptToBytecode([encodeInt(BigInt(candidateFunctionId))]).length;

  const bytesWhenDefined = bodyBytes + idBytes + 1 + callCount * (idBytes + 1);
  const bytesWhenInlined = callCount * bodyBytes;

  return bytesWhenInlined <= bytesWhenDefined;
}

class FunctionCallCollector extends AstTraversal {
  functionCalls: FunctionCallNode[] = [];

  visitFunctionCall(node: FunctionCallNode): Node {
    this.functionCalls.push(node);
    node.parameters = this.visitList(node.parameters);
    return node;
  }
}

export function collectFunctionCalls(node: Node): FunctionCallNode[] {
  const collector = new FunctionCallCollector();
  collector.visit(node);
  return collector.functionCalls;
}

export function isRecursive(func: FunctionDefinitionNode): boolean {
  return transitiveCalledFunctions(func).includes(func);
}

function transitiveCalledFunctions(func: FunctionDefinitionNode): FunctionDefinitionNode[] {
  const callees: FunctionDefinitionNode[] = [];

  const visit = (current: FunctionDefinitionNode): void => calledFunctions(current).forEach((callee) => {
    if (callees.includes(callee)) return;
    callees.push(callee);
    visit(callee);
  });

  visit(func);
  return callees;
}

function calledFunctions(func: FunctionDefinitionNode): FunctionDefinitionNode[] {
  return collectFunctionCalls(func.body)
    .map((call) => call.identifier.symbol?.definition)
    .filter((definition): definition is FunctionDefinitionNode => definition instanceof FunctionDefinitionNode)
    .filter((definition, index, definitions) => definitions.indexOf(definition) === index);
}

// Functions that must stay OP_DEFINE'd because a call site sits inside a loop — directly, or via
// the callee chain of such a function. Splicing a body into a loop makes every iteration step over
// it, and the VM charges per-opcode cost even for opcodes in an untaken branch, so a small byte
// saving multiplies into a large op-cost regression (measured ~2.8x on sparse-input double-and-add
// loops, where the group-law body sits in a rarely-taken `if`). With OP_DEFINE the skipped call
// site costs 2 stepped opcodes instead of the whole body.
//
// The callee closure protects callees on CONDITIONAL paths inside a loop-resident caller: the
// caller's defined body is stepped end-to-end on every invoke, so a callee inlined into one of its
// untaken branches would be stepped per invocation too. A callee on the caller's always-path is
// stepped ≈ executed either way, so excluding it over-approximates — but the residual cost is only
// ~2 ops + ~5 bytes per function, so the closure is kept coarse rather than branch-aware. Same
// deliberate imprecision for always-executed call sites directly in loops: inlining there would
// actually save the 2 invoke ops per iteration, but the asymmetry (2 ops/iteration sacrificed vs
// ~100×body-size/iteration protected) makes conservative the right default.
export function collectLoopResidentFunctions(node: SourceFileNode): Set<FunctionDefinitionNode> {
  const loopResident = new Set<FunctionDefinitionNode>();
  let loopDepth = 0;

  const collector = new class extends AstTraversal {
    visitWhile(n: WhileNode): Node {
      loopDepth += 1;
      const result = super.visitWhile(n);
      loopDepth -= 1;
      return result;
    }

    visitDoWhile(n: DoWhileNode): Node {
      loopDepth += 1;
      const result = super.visitDoWhile(n);
      loopDepth -= 1;
      return result;
    }

    visitFor(n: ForNode): Node {
      loopDepth += 1;
      const result = super.visitFor(n);
      loopDepth -= 1;
      return result;
    }

    visitFunctionCall(n: FunctionCallNode): Node {
      const definition = n.identifier.symbol?.definition;
      if (loopDepth > 0 && definition instanceof FunctionDefinitionNode) loopResident.add(definition);
      return super.visitFunctionCall(n);
    }
  }();

  node.functions.forEach((func) => collector.visit(func.body));
  if (node.contract) collector.visit(node.contract);

  // Close over the callee chain of every loop-resident function.
  const queue = [...loopResident];
  while (queue.length > 0) {
    calledFunctions(queue.shift()!).forEach((callee) => {
      if (loopResident.has(callee)) return;
      loopResident.add(callee);
      queue.push(callee);
    });
  }

  return loopResident;
}
