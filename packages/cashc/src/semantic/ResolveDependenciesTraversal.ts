import fs from 'fs';
import path from 'path';
import {
  SourceFileNode,
  LibraryNode,
  ConstantDefinitionNode,
  ContractNode,
  Node,
  ExpressionNode,
  IdentifierNode,
  FunctionCallNode,
  InstantiationNode,
  AssignNode,
  VariableDefinitionNode,
  TupleAssignmentNode,
  ParameterNode,
  LiteralNode,
  IntLiteralNode,
  BoolLiteralNode,
  HexLiteralNode,
  StringLiteralNode,
  BinaryOpNode,
  UnaryOpNode,
  CastNode,
} from '../ast/AST.js';
import AstTraversal from '../ast/AstTraversal.js';
import { cloneNode } from '../ast/clone.js';
import { BinaryOperator, UnaryOperator } from '../ast/Operator.js';
import {
  ImportResolutionError,
  ImportCycleError,
  ConstantDefinitionError,
  ConstantRedefinitionError,
  ConstantNameCollisionError,
  MissingContractError,
} from '../Errors.js';

export type ParseFn = (code: string) => SourceFileNode;

/**
 * Resolves a source file's `import` directives, merges every imported (and locally declared) library
 * into the single contract, and inlines all compile-time constants. Runs *before* any semantic
 * traversal, producing a plain single-contract AST that the rest of the pipeline can consume
 * unchanged.
 *
 * Library functions are emitted ahead of the contract's own functions in dependency order (a library
 * appears after the libraries it imports), so a callee is always defined before its callers — exactly
 * as a hand-written contract that declares its field tower bottom-up.
 *
 * @param ast - The parsed source file (with unresolved imports/libraries/constants).
 * @param basePath - The directory the source file lives in, used to resolve relative import paths.
 *   Undefined when compiling from a raw string with no imports.
 * @param parse - Parses an imported file's source into a SourceFileNode (shares the caller's error listener).
 */
export function resolveDependencies(
  ast: SourceFileNode,
  basePath: string | undefined,
  parse: ParseFn,
): SourceFileNode {
  // Backwards-compatible fast path: a plain single-contract file with no dependencies is unchanged.
  if (ast.imports.length === 0 && ast.libraries.length === 0 && ast.constants.length === 0) {
    return ast;
  }

  const orderedLibraries: LibraryNode[] = [];
  const allConstants: ConstantDefinitionNode[] = [];
  const visitedPaths = new Set<string>();

  collectDependencies(ast, basePath, parse, visitedPaths, orderedLibraries, allConstants, []);

  const { contract } = ast;
  if (!contract) throw new MissingContractError();

  // Merge every library's functions (dependency order) ahead of the contract's own functions.
  const libraryFunctions = orderedLibraries.flatMap((library) => library.functions);
  contract.functions = [...libraryFunctions, ...contract.functions];

  // Evaluate constants and inline them at every use site.
  inlineConstants(contract, allConstants);

  return new SourceFileNode(contract);
}

// Post-order DFS over the import graph: a file's imports are fully collected before the file's own
// libraries/constants, so dependencies are ordered before dependents. Files are deduped by absolute
// path (handling the diamond where two files import the same library), and a path currently on the
// DFS stack signals a circular import.
function collectDependencies(
  sourceFile: SourceFileNode,
  fileDir: string | undefined,
  parse: ParseFn,
  visitedPaths: Set<string>,
  orderedLibraries: LibraryNode[],
  allConstants: ConstantDefinitionNode[],
  stack: string[],
): void {
  for (const importNode of sourceFile.imports) {
    if (fileDir === undefined) {
      throw new ImportResolutionError(importNode, 'Cannot resolve imports without a base path (compile from a file)');
    }

    const absolutePath = path.resolve(fileDir, importNode.path);

    if (stack.includes(absolutePath)) {
      throw new ImportCycleError(importNode, [...stack, absolutePath]);
    }
    if (visitedPaths.has(absolutePath)) continue;
    visitedPaths.add(absolutePath);

    let code: string;
    try {
      code = fs.readFileSync(absolutePath, { encoding: 'utf-8' });
    } catch {
      throw new ImportResolutionError(
        importNode,
        `Could not read imported file '${importNode.path}' (resolved to ${absolutePath})`,
      );
    }

    const importedAst = parse(code);
    collectDependencies(
      importedAst,
      path.dirname(absolutePath),
      parse,
      visitedPaths,
      orderedLibraries,
      allConstants,
      [...stack, absolutePath],
    );
  }

  // This file's own top-level constants and libraries come after its imports.
  allConstants.push(...sourceFile.constants);
  for (const library of sourceFile.libraries) {
    allConstants.push(...library.constants);
    orderedLibraries.push(library);
  }
}

// Evaluates every constant to a literal (in collection order, so a constant may reference an earlier
// one) and inlines them at every use site in the contract's functions.
function inlineConstants(contract: ContractNode, constantDefinitions: ConstantDefinitionNode[]): void {
  if (constantDefinitions.length === 0) return;

  const values = new Map<string, LiteralNode>();
  for (const definition of constantDefinitions) {
    if (values.has(definition.name)) throw new ConstantRedefinitionError(definition);
    values.set(definition.name, evaluateConstant(definition.expression, values, definition));
  }

  const inliner = new ConstantInliner(values);
  contract.functions = contract.functions.map((func) => inliner.visit(func)) as ContractNode['functions'];
}

// Folds a constant initializer to a literal node. Supports literals, references to previously defined
// constants, and arithmetic/logical/bitwise/comparison operators over them. Anything that depends on
// runtime/introspection values is rejected (constants must be known at compile time).
function evaluateConstant(
  expression: ExpressionNode,
  known: Map<string, LiteralNode>,
  definition: ConstantDefinitionNode,
): LiteralNode {
  if (expression instanceof IntLiteralNode) return new IntLiteralNode(expression.value);
  if (expression instanceof BoolLiteralNode) return new BoolLiteralNode(expression.value);
  if (expression instanceof HexLiteralNode) return new HexLiteralNode(expression.value);
  if (expression instanceof StringLiteralNode) return new StringLiteralNode(expression.value, expression.quote);

  if (expression instanceof IdentifierNode) {
    const value = known.get(expression.name);
    if (!value) {
      throw new ConstantDefinitionError(
        definition,
        `Constant '${definition.name}' references '${expression.name}', which is not a known constant`,
      );
    }
    return cloneNode(value);
  }

  if (expression instanceof UnaryOpNode) {
    const operand = evaluateConstant(expression.expression, known, definition);
    return foldUnary(expression.operator, operand, definition);
  }

  if (expression instanceof BinaryOpNode) {
    const left = evaluateConstant(expression.left, known, definition);
    const right = evaluateConstant(expression.right, known, definition);
    return foldBinary(expression.operator, left, right, definition);
  }

  if (expression instanceof CastNode) {
    // Allow trivial numeric casts of constant expressions (e.g. int(...)); the value is unchanged.
    return evaluateConstant(expression.expression, known, definition);
  }

  throw new ConstantDefinitionError(
    definition,
    `Constant '${definition.name}' must be a compile-time constant expression (no introspection or runtime values)`,
  );
}

function foldUnary(operator: UnaryOperator, operand: LiteralNode, definition: ConstantDefinitionNode): LiteralNode {
  if (operator === UnaryOperator.NEGATE && operand instanceof IntLiteralNode) {
    return new IntLiteralNode(-operand.value);
  }
  if (operator === UnaryOperator.INVERT && operand instanceof IntLiteralNode) {
    return new IntLiteralNode(-operand.value - 1n);
  }
  if (operator === UnaryOperator.NOT && operand instanceof BoolLiteralNode) {
    return new BoolLiteralNode(!operand.value);
  }
  throw new ConstantDefinitionError(
    definition,
    `Constant '${definition.name}' uses operator '${operator}' on an unsupported constant operand`,
  );
}

function foldBinary(
  operator: BinaryOperator,
  left: LiteralNode,
  right: LiteralNode,
  definition: ConstantDefinitionNode,
): LiteralNode {
  if (left instanceof IntLiteralNode && right instanceof IntLiteralNode) {
    const a = left.value;
    const b = right.value;
    switch (operator) {
      case BinaryOperator.PLUS: return new IntLiteralNode(a + b);
      case BinaryOperator.MINUS: return new IntLiteralNode(a - b);
      case BinaryOperator.MUL: return new IntLiteralNode(a * b);
      case BinaryOperator.DIV: return new IntLiteralNode(a / b);
      case BinaryOperator.MOD: return new IntLiteralNode(a % b);
      case BinaryOperator.SHIFT_LEFT: return new IntLiteralNode(a << b);
      case BinaryOperator.SHIFT_RIGHT: return new IntLiteralNode(a >> b);
      case BinaryOperator.BIT_AND: return new IntLiteralNode(a & b);
      case BinaryOperator.BIT_OR: return new IntLiteralNode(a | b);
      case BinaryOperator.BIT_XOR: return new IntLiteralNode(a ^ b);
      case BinaryOperator.LT: return new BoolLiteralNode(a < b);
      case BinaryOperator.LE: return new BoolLiteralNode(a <= b);
      case BinaryOperator.GT: return new BoolLiteralNode(a > b);
      case BinaryOperator.GE: return new BoolLiteralNode(a >= b);
      case BinaryOperator.EQ: return new BoolLiteralNode(a === b);
      case BinaryOperator.NE: return new BoolLiteralNode(a !== b);
      default: break;
    }
  }

  if (left instanceof BoolLiteralNode && right instanceof BoolLiteralNode) {
    switch (operator) {
      case BinaryOperator.AND: return new BoolLiteralNode(left.value && right.value);
      case BinaryOperator.OR: return new BoolLiteralNode(left.value || right.value);
      case BinaryOperator.EQ: return new BoolLiteralNode(left.value === right.value);
      case BinaryOperator.NE: return new BoolLiteralNode(left.value !== right.value);
      default: break;
    }
  }

  throw new ConstantDefinitionError(
    definition,
    `Constant '${definition.name}' uses operator '${operator}' on unsupported constant operands`,
  );
}

// Replaces every identifier that names a constant with a clone of the constant's literal value.
// Callee identifiers (function/instantiation names) are left untouched, and any local that shadows a
// constant name is rejected (it would silently break inlining).
class ConstantInliner extends AstTraversal {
  constructor(private constants: Map<string, LiteralNode>) {
    super();
  }

  visitIdentifier(node: IdentifierNode): Node {
    const value = this.constants.get(node.name);
    if (value) {
      // The inlined literal takes the use site's source location (a folded constant value may have
      // none of its own), so source-map generation always has a valid location to point at.
      const literal = cloneNode(value);
      literal.location = node.location;
      return literal;
    }
    return node;
  }

  visitFunctionCall(node: FunctionCallNode): Node {
    // Do NOT inline the callee identifier (it is a function name, not a value).
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitInstantiation(node: InstantiationNode): Node {
    node.parameters = this.visitList(node.parameters);
    return node;
  }

  visitParameter(node: ParameterNode): Node {
    this.assertNotConstant(node.name, node);
    return node;
  }

  visitVariableDefinition(node: VariableDefinitionNode): Node {
    this.assertNotConstant(node.name, node);
    return super.visitVariableDefinition(node);
  }

  visitTupleAssignment(node: TupleAssignmentNode): Node {
    node.targets.forEach((target) => this.assertNotConstant(target.name, node));
    return super.visitTupleAssignment(node);
  }

  visitAssign(node: AssignNode): Node {
    this.assertNotConstant(node.identifier.name, node);
    return super.visitAssign(node);
  }

  private assertNotConstant(name: string, node: Node): void {
    if (this.constants.has(name)) throw new ConstantNameCollisionError(node, name);
  }
}
