/**
 * AST - Abstract Syntax Tree for JIT Code Generation
 *
 * This module provides a structured way to build JavaScript code
 * for the JIT compiler. Instead of string concatenation, we build
 * an AST that can be optimized and then converted to JavaScript.
 */

// ============================================
// Base Classes
// ============================================

/**
 * Base AST node
 */
export abstract class AstNode
{
  /**
   * Generate JavaScript code
   */
  abstract toJs(): string;

  /**
   * Optimize this node and children
   */
  optimize(): AstNode
  {
    return this;
  }
}

/**
 * Expression node - produces a value
 */
export abstract class Expr extends AstNode {}

/**
 * Statement node - performs an action
 */
export abstract class Stmt extends AstNode {}

/**
 * L-value expression - can be assigned to
 */
export abstract class LValue extends Expr
{
  /**
   * Generate assignment code
   */
  abstract toJsAssign(value: string): string;
}

// ============================================
// Literal Expressions
// ============================================

/**
 * 32-bit signed integer literal
 */
export class Int32 extends Expr
{
  constructor(public readonly value: number) { super(); }

  toJs(): string
  {
    if (this.value < 0)
    {
      return `(${this.value | 0})`;
    }
    return `${this.value | 0}`;
  }
}

/**
 * 32-bit unsigned integer literal
 */
export class Uint32 extends Expr
{
  constructor(public readonly value: number) { super(); }

  toJs(): string
  {
    const v = this.value >>> 0;
    if (v > 0x7FFFFFFF)
    {
      return `0x${v.toString(16)}`;
    }
    return `${v}`;
  }
}

/**
 * Float literal
 */
export class Float extends Expr
{
  constructor(public readonly value: number) { super(); }

  toJs(): string
  {
    if (Number.isNaN(this.value)) return 'NaN';
    if (!Number.isFinite(this.value))
    {
      return this.value > 0 ? 'Infinity' : '-Infinity';
    }
    return this.value.toString();
  }
}

/**
 * Raw JavaScript expression
 */
export class Raw extends Expr
{
  constructor(public readonly code: string) { super(); }

  toJs(): string
  {
    return this.code;
  }
}

// ============================================
// Variable/Register Access
// ============================================

/**
 * Simple variable access
 */
export class Var extends LValue
{
  constructor(public readonly name: string) { super(); }

  toJs(): string
  {
    return this.name;
  }

  toJsAssign(value: string): string
  {
    return `${this.name} = ${value}`;
  }
}

/**
 * Array element access: array[index]
 */
export class ArrayAccess extends LValue
{
  constructor(
    public readonly array: Expr,
    public readonly index: Expr
  ) { super(); }

  toJs(): string
  {
    return `${this.array.toJs()}[${this.index.toJs()}]`;
  }

  toJsAssign(value: string): string
  {
    return `${this.array.toJs()}[${this.index.toJs()}] = ${value}`;
  }
}

/**
 * Property access: obj.prop
 */
export class PropAccess extends LValue
{
  constructor(
    public readonly obj: Expr,
    public readonly prop: string
  ) { super(); }

  toJs(): string
  {
    return `${this.obj.toJs()}.${this.prop}`;
  }

  toJsAssign(value: string): string
  {
    return `${this.obj.toJs()}.${this.prop} = ${value}`;
  }
}

/**
 * Template-based getter/setter for complex access patterns
 *
 * Example:
 *   getter: "state.getVfpr($0)"
 *   setter: "state.setVfpr($0, #)"
 *   args: [index]
 *
 * $0, $1, ... are replaced with args
 * # is replaced with the value being set
 */
export class TemplateAccess extends LValue
{
  constructor(
    public readonly getter: string,
    public readonly setter: string,
    public readonly args: Expr[] = []
  ) { super(); }

  toJs(): string
  {
    return this.applyTemplate(this.getter);
  }

  toJsAssign(value: string): string
  {
    return this.applyTemplate(this.setter.replace('#', value));
  }

  private applyTemplate(template: string): string
  {
    return template.replace(/\$(\d+)/g, (_, n) =>
    {
      const index = parseInt(n, 10);
      return this.args[index]?.toJs() ?? `$${n}`;
    });
  }
}

// ============================================
// Operators
// ============================================

export type BinaryOp =
  | '+' | '-' | '*' | '/' | '%'
  | '&' | '|' | '^'
  | '<<' | '>>' | '>>>'
  | '==' | '===' | '!=' | '!=='
  | '<' | '<=' | '>' | '>='
  | '&&' | '||';

export type UnaryOp = '-' | '~' | '!' | '+';

/**
 * Binary operation: left op right
 */
export class BinOp extends Expr
{
  constructor(
    public readonly left: Expr,
    public readonly op: BinaryOp,
    public readonly right: Expr
  ) { super(); }

  toJs(): string
  {
    return `(${this.left.toJs()} ${this.op} ${this.right.toJs()})`;
  }

  optimize(): Expr
  {
    const left = this.left.optimize() as Expr;
    const right = this.right.optimize() as Expr;

    // Constant folding for integers
    if (left instanceof Int32 && right instanceof Int32)
    {
      const l = left.value;
      const r = right.value;
      switch (this.op)
      {
        case '+': return new Int32((l + r) | 0);
        case '-': return new Int32((l - r) | 0);
        case '*': return new Int32(Math.imul(l, r));
        case '&': return new Int32(l & r);
        case '|': return new Int32(l | r);
        case '^': return new Int32(l ^ r);
        case '<<': return new Int32(l << r);
        case '>>': return new Int32(l >> r);
        case '>>>': return new Uint32(l >>> r);
      }
    }

    // Identity operations
    if (right instanceof Int32 && right.value === 0)
    {
      if (this.op === '+' || this.op === '-' || this.op === '|' || this.op === '^')
      {
        return left;
      }
      if (this.op === '<<' || this.op === '>>' || this.op === '>>>')
      {
        return left;
      }
    }

    return new BinOp(left, this.op, right);
  }
}

/**
 * Unary operation: op expr
 */
export class UnOp extends Expr
{
  constructor(
    public readonly op: UnaryOp,
    public readonly expr: Expr
  ) { super(); }

  toJs(): string
  {
    return `(${this.op}${this.expr.toJs()})`;
  }
}

/**
 * Ternary/conditional: cond ? then : else
 */
export class Ternary extends Expr
{
  constructor(
    public readonly cond: Expr,
    public readonly thenExpr: Expr,
    public readonly elseExpr: Expr
  ) { super(); }

  toJs(): string
  {
    return `(${this.cond.toJs()} ? ${this.thenExpr.toJs()} : ${this.elseExpr.toJs()})`;
  }
}

/**
 * Function call: func(args...)
 */
export class Call extends Expr
{
  constructor(
    public readonly func: Expr | string,
    public readonly args: Expr[]
  ) { super(); }

  toJs(): string
  {
    const funcStr = typeof this.func === 'string' ? this.func : this.func.toJs();
    const argsStr = this.args.map(a => a.toJs()).join(', ');
    return `${funcStr}(${argsStr})`;
  }
}

/**
 * Cast to 32-bit signed: expr | 0
 */
export class ToInt32 extends Expr
{
  constructor(public readonly expr: Expr) { super(); }

  toJs(): string
  {
    if (this.expr instanceof Int32) return this.expr.toJs();
    return `(${this.expr.toJs()} | 0)`;
  }
}

/**
 * Cast to 32-bit unsigned: expr >>> 0
 */
export class ToUint32 extends Expr
{
  constructor(public readonly expr: Expr) { super(); }

  toJs(): string
  {
    if (this.expr instanceof Uint32) return this.expr.toJs();
    return `(${this.expr.toJs()} >>> 0)`;
  }
}

// ============================================
// Statements
// ============================================

/**
 * Expression statement
 */
export class ExprStmt extends Stmt
{
  constructor(public readonly expr: Expr) { super(); }

  toJs(): string
  {
    return `${this.expr.toJs()};`;
  }
}

/**
 * Assignment statement
 */
export class Assign extends Stmt
{
  constructor(
    public readonly target: LValue,
    public readonly value: Expr
  ) { super(); }

  toJs(): string
  {
    return `${this.target.toJsAssign(this.value.toJs())};`;
  }
}

/**
 * Variable declaration: var name = value
 */
export class VarDecl extends Stmt
{
  constructor(
    public readonly name: string,
    public readonly value: Expr
  ) { super(); }

  toJs(): string
  {
    return `var ${this.name} = ${this.value.toJs()};`;
  }
}

/**
 * Return statement
 */
export class Return extends Stmt
{
  constructor(public readonly value?: Expr) { super(); }

  toJs(): string
  {
    if (this.value)
    {
      return `return ${this.value.toJs()};`;
    }
    return 'return;';
  }
}

/**
 * If statement
 */
export class If extends Stmt
{
  constructor(
    public readonly cond: Expr,
    public readonly then: Stmt | Stmt[],
    public readonly else_?: Stmt | Stmt[]
  ) { super(); }

  toJs(): string
  {
    const thenCode = Array.isArray(this.then)
      ? this.then.map(s => s.toJs()).join(' ')
      : this.then.toJs();

    if (this.else_)
    {
      const elseCode = Array.isArray(this.else_)
        ? this.else_.map(s => s.toJs()).join(' ')
        : this.else_.toJs();
      return `if (${this.cond.toJs()}) { ${thenCode} } else { ${elseCode} }`;
    }
    return `if (${this.cond.toJs()}) { ${thenCode} }`;
  }
}

/**
 * Block of statements
 */
export class Block extends Stmt
{
  constructor(public readonly stmts: Stmt[]) { super(); }

  toJs(): string
  {
    return this.stmts.map(s => s.toJs()).join('\n');
  }
}

/**
 * Raw JavaScript statement
 */
export class RawStmt extends Stmt
{
  constructor(public readonly code: string) { super(); }

  toJs(): string
  {
    return this.code;
  }
}

/**
 * Label for jump targets
 */
export class Label extends Stmt
{
  constructor(public readonly address: number) { super(); }

  toJs(): string
  {
    return `// label_0x${this.address.toString(16).padStart(8, '0')}:`;
  }
}

/**
 * Conditional jump
 */
export class Jump extends Stmt
{
  constructor(
    public readonly target: number,
    public readonly cond?: Expr,
    public readonly beforeJump?: Stmt
  ) { super(); }

  toJs(): string
  {
    const targetHex = `0x${this.target.toString(16)}`;
    if (this.cond)
    {
      const before = this.beforeJump ? this.beforeJump.toJs() + ' ' : '';
      return `if (${this.cond.toJs()}) { ${before}return ${targetHex}; }`;
    }
    return `return ${targetHex};`;
  }
}
