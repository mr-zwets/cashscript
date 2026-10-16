import { binToHex } from '@bitauth/libauth';
import { encodeInt, scriptToBytecode } from '@cashscript/utils';
import {
  SourceFileNode,
  FunctionDefinitionNode,
  BlockNode,
  LiteralNode,
  IntLiteralNode,
  HexLiteralNode,
  IdentifierNode,
  VariableDefinitionNode,
  ParameterNode,
  TupleAssignmentNode,
  BinaryOpNode,
  UnaryOpNode,
  SliceNode,
  FunctionCallNode,
  ConsoleStatementNode,
  TimeOpNode,
  ExpressionNode,
  Node,
  ForNode,
  WhileNode,
  DoWhileNode,
  AssignNode,
} from './ast/AST.js';
import { BinaryOperator, UnaryOperator } from './ast/Operator.js';
import { GlobalFunction } from './ast/Globals.js';
import AstTraversal from './ast/AstTraversal.js';

// Byte-size optimisation with an op-cost trade-off, so gated behind `optimizeFor: 'size'`:
// a literal that occurs two or more times within one function body is bound to a local at the
// top of the body when that is cheaper by exact byte accounting, and the occurrences become
// identifier references. The second and later uses then cost a stack pick instead of re-pushing
// the literal (~-30 bytes per duplicate of a 32-byte field prime), at the price of a couple of
// extra ops per call for the binding and cleanup.
//
// That trade is right for size-scored contracts and wrong for op-bound ones (where unlocking
// scripts are zero-padded to buy op budget, byte savings are free anyway and the extra ops
// translate directly into more padding) — hence the default 'opcost' objective skips it.
//
// Runs before semantic analysis, so the introduced locals get symbols like any other variable.
// Only raw literals are targeted: uses of named top-level constants are still identifiers at
// this point, and repeated large constants are already deduplicated by the shared-definition
// mechanism (LowerGlobalConstantsTraversal + OP_DEFINE/OP_INVOKE sharing).
//
// Several later passes pattern-match literal nodes in specific syntactic positions, so those
// occurrences must keep their literal shape and are excluded from both counting and replacement
// (see ExcludedLiteralCollector). The pass is additionally guarded in compileCode: the hoisted
// compile is only kept when the final artifact is strictly smaller than the unhoisted one.

// 'all': hoist every repeated literal of a body whose duplicates pay for the binding (bytes only).
// 'frequency': decide per occurrence, from how often it executes (see hoistByFrequency).
export type HoistMode = 'all' | 'frequency';

export function hoistRepeatedConstants(ast: SourceFileNode, mode: HoistMode = 'all'): SourceFileNode {
  const frequencies = mode === 'frequency' ? functionFrequencies(ast) : undefined;
  ast.functions.forEach((func) => hoistInBody(func.body, func.parameters, mode, frequencies?.get(func.name) ?? 1));
  ast.contract?.functions.forEach((func: FunctionDefinitionNode) => hoistInBody(func.body, func.parameters, mode, 1));
  return ast;
}

// ---------- execution frequency estimates ----------

// Trip count assumed for a loop whose bounds are not literals.
const DEFAULT_TRIPS = 16;
// One byte of unlocking bytecode buys 800 op-cost of budget ((41 + bytes) * 800 per input), so a
// change that saves b bytes and costs c op-cost pays when 800 * b > c, whether or not the input
// is op-bound (an op-bound input buys the extra op-cost back with zero-padding at that rate).
const OP_COST_PER_BYTE = 800;
// A stack read in place of a literal push costs one extra instruction (the depth push), ~101.
const READ_EXTRA_OP_COST = 101;

// `for (int i = a; i < b; i = i + s)` (or `<=`) with literals a, b, s: the exact trip count.
function tripCount(node: ForNode): number {
  const { init, condition, update } = node;
  if (!(init instanceof VariableDefinitionNode) || !(init.expression instanceof IntLiteralNode)) return DEFAULT_TRIPS;
  if (!(condition instanceof BinaryOpNode) || !(condition.right instanceof IntLiteralNode)) return DEFAULT_TRIPS;
  if (!(condition.left instanceof IdentifierNode) || condition.left.name !== init.name) return DEFAULT_TRIPS;
  const step = update instanceof AssignNode && update.identifier.name === init.name
    && update.expression instanceof BinaryOpNode && update.expression.operator === BinaryOperator.PLUS
    && update.expression.left instanceof IdentifierNode && update.expression.left.name === init.name
    && update.expression.right instanceof IntLiteralNode ? update.expression.right.value : 0n;
  if (step <= 0n) return DEFAULT_TRIPS;
  const start = init.expression.value;
  const bound = condition.right.value;
  let span = -1n;
  if (condition.operator === BinaryOperator.LT) span = bound - start;
  else if (condition.operator === BinaryOperator.LE) span = bound - start + 1n;
  return span < 0n ? DEFAULT_TRIPS : Number((span + step - 1n) / step);
}

// Tracks how many times the node being visited executes per execution of the enclosing body.
class LoopWeightedTraversal extends AstTraversal {
  protected weight = 1;

  private weighted<T>(factor: number, visit: () => T): T {
    const outer = this.weight;
    this.weight = outer * factor;
    try {
      return visit();
    } finally {
      this.weight = outer;
    }
  }

  visitFor(node: ForNode): Node {
    node.init = this.visit(node.init) as VariableDefinitionNode | AssignNode;
    return this.weighted(tripCount(node), () => {
      node.condition = this.visit(node.condition);
      node.update = this.visit(node.update) as AssignNode;
      node.block = this.visit(node.block) as BlockNode;
      return node;
    });
  }

  visitWhile(node: WhileNode): Node {
    return this.weighted(DEFAULT_TRIPS, () => super.visitWhile(node));
  }

  visitDoWhile(node: DoWhileNode): Node {
    return this.weighted(DEFAULT_TRIPS, () => super.visitDoWhile(node));
  }
}

class CallSiteCollector extends LoopWeightedTraversal {
  calls: { callee: string, weight: number }[] = [];

  constructor(private globalNames: Set<string>) {
    super();
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    if (this.globalNames.has(node.identifier.name)) this.calls.push({ callee: node.identifier.name, weight: this.weight });
    return super.visitFunctionCall(node);
  }
}

// Executions of each global function per contract-function execution: the sum over its call
// sites of the calling function frequency times the call site loop weight (the call graph is
// acyclic, so iterating once per function reaches the fixed point).
function functionFrequencies(ast: SourceFileNode): Map<string, number> {
  const globalNames = new Set(ast.functions.map((func) => func.name));
  const callsOf = (body: BlockNode): { callee: string, weight: number }[] => {
    const collector = new CallSiteCollector(globalNames);
    collector.visit(body);
    return collector.calls;
  };
  const callers = [
    ...ast.functions.map((func) => ({ name: func.name as string | undefined, calls: callsOf(func.body) })),
    ...(ast.contract?.functions ?? []).map((func) => ({ name: undefined, calls: callsOf(func.body) })),
  ];
  const propagate = (frequency: Map<string, number>): Map<string, number> => {
    const next = new Map<string, number>([...globalNames].map((name) => [name, 0]));
    callers.forEach(({ name, calls }) => {
      const callerFrequency = name === undefined ? 1 : frequency.get(name) ?? 0;
      calls.forEach(({ callee, weight }) => next.set(callee, next.get(callee)! + callerFrequency * weight));
    });
    return next;
  };
  let frequency = new Map<string, number>();
  for (let round = 0; round <= globalNames.size; round += 1) frequency = propagate(frequency);
  return frequency;
}

// For each repeated literal, bind it to a local and read the local at the occurrences that
// execute least often, as many as maximises 800 * (bytes saved) - (op-cost added): a hot
// occurrence (in a loop, or in a function called from one) keeps its literal push, the cheapest
// per execution, while cold ones share one binding. Byte accounting as in worthHoisting: k reads
// save (k - 1) * (pushBytes - 2) - 1 bytes; the binding costs a push and a cleanup per execution
// of the body, and each read one extra instruction per execution.
function hoistByFrequency(
  sites: { node: Hoistable, weight: number }[], pushBytes: number, bodyFrequency: number,
): Hoistable[] {
  const sorted = [...sites].sort((a, b) => a.weight - b.weight);
  let best = 0;
  let bestCount = 0;
  let weightSum = 0;
  sorted.forEach(({ weight }, index) => {
    const count = index + 1;
    weightSum += weight;
    const bytesSaved = (count - 1) * (pushBytes - 2) - 1;
    const opAdded = bodyFrequency * (READ_EXTRA_OP_COST * weightSum + 200 + pushBytes);
    const benefit = OP_COST_PER_BYTE * bytesSaved - opAdded;
    if (benefit > best) {
      best = benefit;
      bestCount = count;
    }
  });
  return sorted.slice(0, bestCount).map(({ node }) => node);
}

// Exact byte accounting: replacing each duplicate push with an identifier access costs about
// 2 bytes (depth + OP_PICK; the declaration itself re-uses the first push) plus ~1 byte of
// end-of-scope cleanup, so hoisting pays when the duplicates' push bytes beat that overhead.
const worthHoisting = (pushBytes: number, count: number): boolean => (count - 1) * pushBytes > 2 * (count - 1) + 1;

function hoistInBody(body: BlockNode, parameters: ParameterNode[], mode: HoistMode, bodyFrequency: number): void {
  if (!body.statements || body.statements.length === 0) return;

  const excluded = collectExcludedLiterals(body);

  const counter = new LiteralCounter(excluded);
  // Parameters live outside the body, so seed their names explicitly — a parameter named `hc0`
  // must not collide with a generated local.
  parameters.forEach((parameter) => counter.usedNames.add(parameter.name));
  counter.visit(body);

  const selected = new Set<Node>();
  const hoisted = [...counter.literals.values()].filter(({ pushBytes, count, sites }) => {
    if (mode === 'all') return worthHoisting(pushBytes, count);
    const chosen = hoistByFrequency(sites, pushBytes, bodyFrequency);
    chosen.forEach((node) => selected.add(node));
    return chosen.length > 0;
  });
  if (hoisted.length === 0) return;

  // Fresh local names that collide with nothing already named in the body.
  const names = new Map<string, string>();
  let n = 0;
  for (const { key } of hoisted) {
    while (counter.usedNames.has(`hc${n}`)) n += 1;
    names.set(key, `hc${n}`);
    n += 1;
  }

  new LiteralReplacer(names, excluded, mode === 'frequency' ? selected : undefined).visit(body);

  // Declarations go at the very top of the body; source locations borrow from the first
  // statement so source-map generation always has a valid location to point at.
  const location = body.statements[0].location;
  const declarations = hoisted.map(({ key, template }) => {
    const literal = cloneLiteral(template);
    literal.location = location;
    const definition = new VariableDefinitionNode(template.type!, [], names.get(key)!, literal);
    definition.location = location;
    return definition;
  });
  body.statements.unshift(...declarations);
}

type Hoistable = IntLiteralNode | HexLiteralNode;

const literalKey = (node: Hoistable): string => (
  node instanceof IntLiteralNode ? `i${node.value}` : `x${binToHex(node.value)}`
);

const literalPushBytes = (node: Hoistable): number => (
  scriptToBytecode([node instanceof IntLiteralNode ? encodeInt(node.value) : node.value]).length
);

function cloneLiteral(node: Hoistable): LiteralNode {
  return node instanceof IntLiteralNode ? new IntLiteralNode(node.value) : new HexLiteralNode(node.value);
}

function collectExcludedLiterals(body: BlockNode): Set<Node> {
  const collector = new ExcludedLiteralCollector();
  collector.visit(body);
  return collector.excluded;
}

// Split bounds and bit-shift counts: TypeCheckTraversal keys bounded-type inference and the
// static IndexOutOfBoundsError / BitshiftBitcountNegativeError checks on a literal right operand.
const BOUND_SENSITIVE_OPERATORS = [BinaryOperator.SPLIT, BinaryOperator.SHIFT_LEFT, BinaryOperator.SHIFT_RIGHT];

const isSizeOp = (node: ExpressionNode): boolean => (
  node instanceof UnaryOpNode && node.operator === UnaryOperator.SIZE
);

// Marks the literal occurrences that later passes pattern-match syntactically, and which must
// therefore stay literals (they take part in neither counting nor replacement):
//  - split / bit-shift right operands and slice bounds — bounded-type inference and static
//    bounds checks in TypeCheckTraversal require literal nodes there;
//  - toPaddedBytes size arguments — inferPaddedBytesType reads a literal second parameter;
//  - literals compared against `.length` — TypeCheckTraversal narrows unbounded bytes from them;
//  - console statement parameters — logs are stripped from the real bytecode, so hoisting them
//    would materialise debug-only data as live stack values;
//  - tx.time / this.age operands — InjectLocktimeGuardTraversal's isLocktimeCheck heuristic
//    keys on a literal operand, and replacing it triggers a synthetic guard.
class ExcludedLiteralCollector extends AstTraversal {
  excluded = new Set<Node>();

  private exclude(node: Node | undefined): void {
    if (node instanceof IntLiteralNode || node instanceof HexLiteralNode) this.excluded.add(node);
  }

  visitBinaryOp(node: BinaryOpNode): Node {
    if (BOUND_SENSITIVE_OPERATORS.includes(node.operator)) this.exclude(node.right);
    if (isSizeOp(node.left)) this.exclude(node.right);
    if (isSizeOp(node.right)) this.exclude(node.left);
    return super.visitBinaryOp(node);
  }

  visitSlice(node: SliceNode): Node {
    this.exclude(node.start);
    this.exclude(node.end);
    return super.visitSlice(node);
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    if (node.identifier.name === GlobalFunction.TO_PADDED_BYTES) this.exclude(node.parameters[1]);
    return super.visitFunctionCall(node);
  }

  visitConsoleStatement(node: ConsoleStatementNode): Node {
    node.parameters.forEach((parameter) => this.exclude(parameter));
    return node;
  }

  visitTimeOp(node: TimeOpNode): Node {
    this.exclude(node.expression);
    return super.visitTimeOp(node);
  }
}

// Counts hoistable literals by value and records every name already used in the body
// (identifiers, parameters, definitions, tuple targets), so the introduced locals cannot
// shadow or be shadowed by anything.
class LiteralCounter extends LoopWeightedTraversal {
  literals = new Map<string, {
    key: string, template: Hoistable, pushBytes: number, count: number, sites: { node: Hoistable, weight: number }[],
  }>();

  usedNames = new Set<string>();

  constructor(private excluded: Set<Node>) {
    super();
  }

  private countLiteral(node: Hoistable): void {
    if (this.excluded.has(node)) return;
    const key = literalKey(node);
    const entry = this.literals.get(key);
    const site = { node, weight: this.weight };
    if (entry) {
      entry.count += 1;
      entry.sites.push(site);
    } else {
      this.literals.set(key, { key, template: node, pushBytes: literalPushBytes(node), count: 1, sites: [site] });
    }
  }

  visitIntLiteral(node: IntLiteralNode): Node {
    this.countLiteral(node);
    return node;
  }

  visitHexLiteral(node: HexLiteralNode): Node {
    this.countLiteral(node);
    return node;
  }

  visitIdentifier(node: IdentifierNode): Node {
    this.usedNames.add(node.name);
    return node;
  }

  visitParameter(node: ParameterNode): Node {
    this.usedNames.add(node.name);
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    this.usedNames.add(node.name);
    return super.visitVariableDefinition(node);
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    node.targets.forEach((target) => this.usedNames.add(target.identifier.name));
    return super.visitTupleAssignment(node);
  }
}

// Swaps each hoisted literal occurrence for a reference to its local. The identifier takes
// the literal's source location (same convention as constant inlining, in reverse).
class LiteralReplacer extends AstTraversal {
  // selected: the occurrences to replace ('frequency' mode); all occurrences when undefined
  constructor(private names: Map<string, string>, private excluded: Set<Node>, private selected?: Set<Node>) {
    super();
  }

  private replace(node: Hoistable): Node {
    if (this.excluded.has(node)) return node;
    if (this.selected !== undefined && !this.selected.has(node)) return node;
    const name = this.names.get(literalKey(node));
    if (name === undefined) return node;
    const identifier = new IdentifierNode(name);
    identifier.location = node.location;
    return identifier;
  }

  visitIntLiteral(node: IntLiteralNode): Node {
    return this.replace(node);
  }

  visitHexLiteral(node: HexLiteralNode): Node {
    return this.replace(node);
  }
}
