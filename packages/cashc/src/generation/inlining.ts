import {
  encodeInt,
  Op,
  OptimizationTarget,
  OptimiseBytecodeResult,
  Script,
  scriptToBytecode,
} from '@cashscript/utils';
import {
  AssignNode,
  BlockNode,
  BranchNode,
  DoWhileNode,
  ForNode,
  FunctionCallNode,
  FunctionDefinitionNode,
  Node,
  SourceFileNode,
  VariableDefinitionNode,
  WhileNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { Symbol } from '../ast/SymbolTable.js';
import type { InternalCompilerOptions } from '../compiler.js';

export const shouldInline = (
  symbol: Symbol,
  optimisedResult: OptimiseBytecodeResult,
  reachableCalls: FunctionCallNode[],
  entryReachableCalls: FunctionCallNode[][],
  loopResidentFunctions: Set<FunctionDefinitionNode>,
  nextFunctionId: number,
  compilerOptions: InternalCompilerOptions,
): boolean => {
  if (compilerOptions.disableInlining) return false;
  if (symbol.functionId !== undefined) return false;

  // Loop-resident functions stay OP_DEFINE'd to avoid stepping cost (see
  // collectLoopResidentFunctions). Tiny bodies (<= 2 script elements) are exempt, since inlined
  // they step no more opcodes than the 2-op invoke site.
  const definition = symbol.definition;
  if (
    definition instanceof FunctionDefinitionNode
    && loopResidentFunctions.has(definition)
    && optimisedResult.script.length > 2
  ) {
    return false;
  }

  const callCount = reachableCalls.filter((call) => call.identifier.symbol === symbol).length;
  const entryCallCounts = entryReachableCalls
    .map((calls) => calls.filter((call) => call.identifier.symbol === symbol).length);
  return isWorthInlining(nextFunctionId, optimisedResult.script, callCount, entryCallCounts, compilerOptions.optimizeFor);
};

// Op-cost accounting (CHIP-2021-05 VM limits): every evaluated instruction costs a base 100 and
// stack pushes add 1 per pushed byte, so sharing a body of B bytes (1-byte funcid) pays
// <body push> <id push> OP_DEFINE = 301 + 2B once per spend (OP_DEFINE re-prices the body's
// stack-pushed bytes) plus <id push> OP_INVOKE = 201 per call, while an inlined body executes at
// identical cost to an invoked one. For EXECUTED call sites inlining therefore always wins
// op-cost, so under the 'opcost' objective tiny bodies inline regardless of use count. The cap
// bounds the collateral bytes: each inlined call site costs B bytes instead of the ~2-byte invoke
// site, so 6 tolerates ~4 extra bytes per additional call site (~50 op-cost bought per byte).
// Loop-resident bodies are excluded before this rule (stepping a skipped inlined body costs
// 100/opcode per ITERATION), and the density guard below excludes bodies whose call sites are
// spread across contract entry functions.
const OPCOST_INLINE_MAX_BODY_BYTES = 6;

function isWorthInlining(
  candidateFunctionId: number,
  bodyScript: Script,
  callCount: number,
  entryCallCounts: number[],
  optimizeFor?: OptimizationTarget,
): boolean {
  const bodyBytecode = scriptToBytecode(bodyScript);
  if (
    optimizeFor !== 'size'
    && bodyBytecode.length <= OPCOST_INLINE_MAX_BODY_BYTES
    && passesDensityGuard(entryCallCounts, bodyScript.length, bodyBytecode.length)
  ) {
    return true;
  }

  const functionId = encodeInt(BigInt(candidateFunctionId));

  const defineBytes = scriptToBytecode([bodyBytecode, functionId, Op.OP_DEFINE]).length;
  const invokeBytes = scriptToBytecode([functionId, Op.OP_INVOKE]).length;

  const bytesWhenDefined = defineBytes + callCount * invokeBytes;
  const bytesWhenInlined = callCount * bodyBytecode.length;

  // A byte tie is free to inline under 'opcost' (it removes the invoke overhead), but under 'size'
  // the shared body is kept: inlining at parity gains nothing directly, and keeping the call
  // sites small measurably helps the downstream stack rescheduling on large contracts.
  return optimizeFor === 'size' ? bytesWhenInlined < bytesWhenDefined : bytesWhenInlined <= bytesWhenDefined;
}

// A multi-function contract compiles into one script with a selector branch per entry function,
// and the VM steps (and charges 100/opcode for) the branches a spend does NOT take. An inlined
// copy in an untaken branch therefore costs 100 x elements per spend where an invoke site costs
// 200 — so a tiny body is only forced inline when no spend path can lose op-cost: for every entry
// function, the extra stepping of the OTHER entries' copies must not exceed what inlining saves
// (the one-time define and the entry's own invoke overhead). Single-entry contracts pass
// trivially (no other branches); bodies of <= 2 elements pass at any spread (a copy steps no more
// than the invoke site it replaces). No spend-frequency assumptions: the bound must hold for
// every entry. Call sites inside still-defined helpers are attributed to every entry reaching the
// helper, an over-approximation that only makes the guard more conservative (keeps OP_DEFINE and
// forgoes at most the 201/call invoke saving — never a stepping regression).
function passesDensityGuard(entryCallCounts: number[], bodyElements: number, bodyBytes: number): boolean {
  if (bodyElements <= 2) return true;
  const totalCalls = entryCallCounts.reduce((total, count) => total + count, 0);
  const defineCost = 301 + 2 * bodyBytes;
  return entryCallCounts.every((count) => (
    100 * (bodyElements - 2) * (totalCalls - count) <= defineCost + 201 * count
  ));
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

// Call sites reachable from each contract entry function: the entry's own body plus the bodies
// of every global function it (transitively) calls. Feeds the inlining density guard, which
// needs to know how a callee's call sites distribute over the selector branches.
export function collectEntryReachableCalls(node: SourceFileNode): FunctionCallNode[][] {
  return (node.contract?.functions ?? []).map((entry) => {
    const calls = [...collectFunctionCalls(entry)];
    const seen = new Set<FunctionDefinitionNode>();
    const queue = callDefinitions(calls);
    while (queue.length > 0) {
      const definition = queue.shift()!;
      if (seen.has(definition)) continue;
      seen.add(definition);
      const inner = collectFunctionCalls(definition.body);
      calls.push(...inner);
      queue.push(...callDefinitions(inner));
    }
    return calls;
  });
}

const callDefinitions = (calls: FunctionCallNode[]): FunctionDefinitionNode[] => calls
  .map((call) => call.identifier.symbol?.definition)
  .filter((definition): definition is FunctionDefinitionNode => definition instanceof FunctionDefinitionNode);

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

// Functions with a call site inside a loop — directly, or via the callee chain of such a function.
// The VM charges op-cost for every opcode a loop steps over each iteration, even in untaken
// branches, so inlining a body into a loop multiplies its cost by the iteration count, while a
// defined function costs just 2 stepped opcodes at the call site. The exclusion is deliberately
// coarse rather than branch-aware: keeping an always-executed call defined sacrifices only the 2
// invoke ops per iteration, while inlining a conditionally-executed one risks stepping the whole
// body every iteration.
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
      // The init statement runs once, before OP_BEGIN, so a call there is not loop-resident;
      // only the condition, update, and body are re-stepped every iteration.
      n.init = this.visit(n.init) as VariableDefinitionNode | AssignNode;
      loopDepth += 1;
      n.condition = this.visit(n.condition);
      n.update = this.visit(n.update) as AssignNode;
      n.block = this.visit(n.block) as BlockNode;
      loopDepth -= 1;
      return n;
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

// The functions that must stay OP_DEFINE'd because of loop stepping: those with a call site
// inside a branch (if/else) that repeats, i.e. a branch inside a loop body or inside the body of a
// loop-resident function. Such a branch can be skipped on some iterations, and the VM still steps
// (and charges 100/opcode for) an inlined body there. A call site that executes on every iteration
// costs the same inlined as invoked, minus the 2 invoke ops, so it does not block inlining.
// Callees need no closure: while a function stays defined, bodies inlined into it are stepped
// only when it is invoked.
export function collectLoopConditionalFunctions(
  node: SourceFileNode, loopResident: Set<FunctionDefinitionNode>,
): Set<FunctionDefinitionNode> {
  const conditional = new Set<FunctionDefinitionNode>();
  let loopDepth = 0;
  let branchDepth = 0;
  let repeatedBody = false;

  // Branches only count inside the innermost repeated region, so the branch depth restarts at 0
  // when a loop is entered (a loop inside a branch is skipped as a whole, once).
  const inLoop = <T>(visit: () => T): T => {
    const outerBranchDepth = branchDepth;
    loopDepth += 1;
    branchDepth = 0;
    try {
      return visit();
    } finally {
      loopDepth -= 1;
      branchDepth = outerBranchDepth;
    }
  };

  const collector = new class extends AstTraversal {
    visitWhile(n: WhileNode): Node {
      return inLoop(() => super.visitWhile(n));
    }

    visitDoWhile(n: DoWhileNode): Node {
      return inLoop(() => super.visitDoWhile(n));
    }

    visitFor(n: ForNode): Node {
      n.init = this.visit(n.init) as VariableDefinitionNode | AssignNode;
      return inLoop(() => {
        n.condition = this.visit(n.condition);
        n.update = this.visit(n.update) as AssignNode;
        n.block = this.visit(n.block) as BlockNode;
        return n;
      });
    }

    visitBranch(n: BranchNode): Node {
      n.condition = this.visit(n.condition);
      branchDepth += 1;
      try {
        n.ifBlock = this.visit(n.ifBlock) as BlockNode;
        n.elseBlock = this.visitOptional(n.elseBlock) as BlockNode | undefined;
      } finally {
        branchDepth -= 1;
      }
      return n;
    }

    visitFunctionCall(n: FunctionCallNode): Node {
      const definition = n.identifier.symbol?.definition;
      // the branch must itself repeat: inside a loop, or anywhere in a loop-resident body
      const repeats = loopDepth > 0 || repeatedBody;
      if (repeats && branchDepth > 0 && definition instanceof FunctionDefinitionNode) conditional.add(definition);
      return super.visitFunctionCall(n);
    }
  }();

  // A branch outside any loop in a non-repeated body is stepped at most once; in a loop-resident
  // body every branch repeats.
  const visitBody = (body: Node, repeated: boolean): void => {
    repeatedBody = repeated;
    loopDepth = 0;
    branchDepth = 0;
    collector.visit(body);
  };
  node.functions.forEach((func) => visitBody(func.body, loopResident.has(func)));
  if (node.contract) visitBody(node.contract, false);
  return conditional;
}
