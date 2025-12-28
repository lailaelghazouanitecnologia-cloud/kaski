/**
 * AST Builder - Convenience methods for building AST nodes
 *
 * Provides a fluent API for constructing AST nodes,
 * especially for CPU-specific operations.
 */

import {
  AstNode, Expr, Stmt, LValue,
  Int32, Uint32, Float, Raw,
  Var, ArrayAccess, PropAccess, TemplateAccess,
  BinOp, UnOp, Ternary, Call, ToInt32, ToUint32,
  ExprStmt, Assign, VarDecl, Return, If, Block, RawStmt, Label, Jump,
  type BinaryOp, type UnaryOp,
} from './nodes';

/**
 * Generic AST Builder
 */
export class AstBuilder
{
  // ============================================
  // Literals
  // ============================================

  /** 32-bit signed integer */
  i32(value: number): Int32
  {
    return new Int32(value);
  }

  /** 32-bit unsigned integer */
  u32(value: number): Uint32
  {
    return new Uint32(value);
  }

  /** Float */
  float(value: number): Float
  {
    return new Float(value);
  }

  /** Raw JavaScript expression */
  raw(code: string): Raw
  {
    return new Raw(code);
  }

  // ============================================
  // Variables
  // ============================================

  /** Variable reference */
  v(name: string): Var
  {
    return new Var(name);
  }

  /** Array access */
  index(array: Expr | string, index: Expr | number): ArrayAccess
  {
    const arr = typeof array === 'string' ? this.v(array) : array;
    const idx = typeof index === 'number' ? this.i32(index) : index;
    return new ArrayAccess(arr, idx);
  }

  /** Property access */
  prop(obj: Expr | string, prop: string): PropAccess
  {
    const o = typeof obj === 'string' ? this.v(obj) : obj;
    return new PropAccess(o, prop);
  }

  /** Template-based access */
  template(getter: string, setter: string, ...args: Expr[]): TemplateAccess
  {
    return new TemplateAccess(getter, setter, args);
  }

  // ============================================
  // Operators
  // ============================================

  /** Binary operation */
  binop(left: Expr, op: BinaryOp, right: Expr): BinOp
  {
    return new BinOp(left, op, right);
  }

  /** Binary operation with immediate right */
  binopI(left: Expr, op: BinaryOp, right: number): BinOp
  {
    return new BinOp(left, op, this.i32(right));
  }

  /** Unary operation */
  unop(op: UnaryOp, expr: Expr): UnOp
  {
    return new UnOp(op, expr);
  }

  /** Ternary conditional */
  ternary(cond: Expr, then: Expr, else_: Expr): Ternary
  {
    return new Ternary(cond, then, else_);
  }

  /** Function call */
  call(func: Expr | string, ...args: Expr[]): Call
  {
    return new Call(func, args);
  }

  // ============================================
  // Arithmetic helpers
  // ============================================

  add(left: Expr, right: Expr): BinOp { return this.binop(left, '+', right); }
  sub(left: Expr, right: Expr): BinOp { return this.binop(left, '-', right); }
  mul(left: Expr, right: Expr): BinOp { return this.binop(left, '*', right); }
  div(left: Expr, right: Expr): BinOp { return this.binop(left, '/', right); }
  mod(left: Expr, right: Expr): BinOp { return this.binop(left, '%', right); }

  and(left: Expr, right: Expr): BinOp { return this.binop(left, '&', right); }
  or(left: Expr, right: Expr): BinOp { return this.binop(left, '|', right); }
  xor(left: Expr, right: Expr): BinOp { return this.binop(left, '^', right); }
  not(expr: Expr): UnOp { return this.unop('~', expr); }

  sll(left: Expr, right: Expr): BinOp { return this.binop(left, '<<', right); }
  srl(left: Expr, right: Expr): BinOp { return this.binop(left, '>>>', right); }
  sra(left: Expr, right: Expr): BinOp { return this.binop(left, '>>', right); }

  // ============================================
  // Comparison helpers
  // ============================================

  eq(left: Expr, right: Expr): BinOp { return this.binop(left, '===', right); }
  ne(left: Expr, right: Expr): BinOp { return this.binop(left, '!==', right); }
  lt(left: Expr, right: Expr): BinOp { return this.binop(left, '<', right); }
  le(left: Expr, right: Expr): BinOp { return this.binop(left, '<=', right); }
  gt(left: Expr, right: Expr): BinOp { return this.binop(left, '>', right); }
  ge(left: Expr, right: Expr): BinOp { return this.binop(left, '>=', right); }

  // ============================================
  // Type conversions
  // ============================================

  /** Cast to signed 32-bit: expr | 0 */
  toI32(expr: Expr): ToInt32
  {
    return new ToInt32(expr);
  }

  /** Cast to unsigned 32-bit: expr >>> 0 */
  toU32(expr: Expr): ToUint32
  {
    return new ToUint32(expr);
  }

  // ============================================
  // Statements
  // ============================================

  /** Expression statement */
  stmt(expr: Expr): ExprStmt
  {
    return new ExprStmt(expr);
  }

  /** Assignment */
  assign(target: LValue, value: Expr): Assign
  {
    return new Assign(target, value);
  }

  /** Variable declaration */
  varDecl(name: string, value: Expr): VarDecl
  {
    return new VarDecl(name, value);
  }

  /** Return statement */
  ret(value?: Expr): Return
  {
    return new Return(value);
  }

  /** If statement */
  if_(cond: Expr, then: Stmt | Stmt[], else_?: Stmt | Stmt[]): If
  {
    return new If(cond, then, else_);
  }

  /** Block of statements */
  block(...stmts: Stmt[]): Block
  {
    return new Block(stmts);
  }

  /** Raw JavaScript statement */
  rawStmt(code: string): RawStmt
  {
    return new RawStmt(code);
  }

  /** Label */
  label(address: number): Label
  {
    return new Label(address);
  }

  /** Jump */
  jump(target: number, cond?: Expr, beforeJump?: Stmt): Jump
  {
    return new Jump(target, cond, beforeJump);
  }
}

/**
 * MIPS-specific AST Builder
 *
 * Provides convenience methods for CPU register access and common patterns.
 */
export class MipsAstBuilder extends AstBuilder
{
  private readonly state: Var;
  private readonly gprArray: Var;
  private readonly fprArray: Var;
  private readonly memory: Var;

  constructor(stateVar: string = 'state')
  {
    super();
    this.state = this.v(stateVar);
    this.gprArray = this.v('gpr');
    this.fprArray = this.v('fpr');
    this.memory = this.v('memory');
  }

  // ============================================
  // Register Access
  // ============================================

  /** General purpose register (GPR) */
  gpr(index: number | Expr): ArrayAccess
  {
    const idx = typeof index === 'number' ? this.i32(index) : index;
    return new ArrayAccess(this.gprArray, idx);
  }

  /** GPR as signed (cast to i32) */
  gprS(index: number | Expr): ToInt32
  {
    return this.toI32(this.gpr(index));
  }

  /** GPR as unsigned (cast to u32) */
  gprU(index: number | Expr): ToUint32
  {
    return this.toU32(this.gpr(index));
  }

  /** Floating point register */
  fpr(index: number | Expr): ArrayAccess
  {
    const idx = typeof index === 'number' ? this.i32(index) : index;
    return new ArrayAccess(this.fprArray, idx);
  }

  /** FPR as integer (for bit manipulation) */
  fprI(index: number | Expr): ArrayAccess
  {
    const idx = typeof index === 'number' ? this.i32(index) : index;
    return new ArrayAccess(this.v('fprInt'), idx);
  }

  /** HI register */
  hi(): PropAccess
  {
    return this.prop(this.state, 'hi');
  }

  /** LO register */
  lo(): PropAccess
  {
    return this.prop(this.state, 'lo');
  }

  /** Program counter */
  pc(): PropAccess
  {
    return this.prop(this.state, 'pc');
  }

  /** FPU control register (fcr31) */
  fcr31(): PropAccess
  {
    return this.prop(this.state, 'fcr31');
  }

  /** VFPU register */
  vfpr(index: number | Expr): TemplateAccess
  {
    const idx = typeof index === 'number' ? this.i32(index) : index;
    return this.template('state.vfpr[$0]', 'state.vfpr[$0] = #', idx);
  }

  // ============================================
  // Memory Access
  // ============================================

  /** Load byte signed */
  lb(addr: Expr): Call
  {
    return this.call(this.prop(this.memory, 'lb'), addr);
  }

  /** Load byte unsigned */
  lbu(addr: Expr): Call
  {
    return this.call(this.prop(this.memory, 'lbu'), addr);
  }

  /** Load halfword signed */
  lh(addr: Expr): Call
  {
    return this.call(this.prop(this.memory, 'lh'), addr);
  }

  /** Load halfword unsigned */
  lhu(addr: Expr): Call
  {
    return this.call(this.prop(this.memory, 'lhu'), addr);
  }

  /** Load word */
  lw(addr: Expr): Call
  {
    return this.call(this.prop(this.memory, 'lw'), addr);
  }

  /** Store byte */
  sb(addr: Expr, value: Expr): Call
  {
    return this.call(this.prop(this.memory, 'sb'), addr, value);
  }

  /** Store halfword */
  sh(addr: Expr, value: Expr): Call
  {
    return this.call(this.prop(this.memory, 'sh'), addr, value);
  }

  /** Store word */
  sw(addr: Expr, value: Expr): Call
  {
    return this.call(this.prop(this.memory, 'sw'), addr, value);
  }

  // ============================================
  // Common Patterns
  // ============================================

  /**
   * Calculate memory address: base + offset
   */
  memAddr(base: number, offset: number): ToUint32
  {
    return this.toU32(this.add(this.gpr(base), this.i32(offset)));
  }

  /**
   * Assign to GPR (skips R0)
   */
  assignGpr(rd: number, value: Expr): Stmt
  {
    if (rd === 0) return this.rawStmt(''); // R0 is always 0
    return this.assign(this.gpr(rd), value);
  }

  /**
   * Assign to GPR with signed cast
   */
  assignGprS(rd: number, value: Expr): Stmt
  {
    if (rd === 0) return this.rawStmt('');
    return this.assign(this.gpr(rd), this.toI32(value));
  }

  /**
   * Branch condition flag
   */
  branchFlag(): Var
  {
    return this.v('takeBranch');
  }

  /**
   * Branch target
   */
  branchTarget(): Var
  {
    return this.v('branchTarget');
  }

  /**
   * Set branch
   */
  setBranch(target: number | Expr, cond?: Expr): Stmt[]
  {
    const targetExpr = typeof target === 'number' ? this.u32(target) : target;
    const stmts: Stmt[] = [
      this.assign(this.branchFlag(), this.raw('true')),
      this.assign(this.branchTarget(), targetExpr),
    ];

    if (cond)
    {
      return [this.if_(cond, stmts)];
    }
    return stmts;
  }

  /**
   * Conditional assignment for SLT-like instructions
   */
  slt(rd: number, cond: Expr): Stmt
  {
    return this.assignGpr(rd, this.ternary(cond, this.i32(1), this.i32(0)));
  }

  /**
   * Multiply to HI:LO (64-bit result)
   */
  mult(rs: number, rt: number, signed: boolean): RawStmt
  {
    const rsExpr = signed ? `gpr[${rs}]` : `(gpr[${rs}] >>> 0)`;
    const rtExpr = signed ? `gpr[${rt}]` : `(gpr[${rt}] >>> 0)`;
    return this.rawStmt(
      `{ const r = BigInt(${rsExpr}) * BigInt(${rtExpr}); ` +
      `state.lo = Number(r & 0xFFFFFFFFn); ` +
      `state.hi = Number(r >> 32n); }`
    );
  }

  /**
   * Divide to HI:LO (quotient:remainder)
   */
  div(rs: number, rt: number, signed: boolean): RawStmt
  {
    const rsExpr = signed ? `gpr[${rs}]` : `(gpr[${rs}] >>> 0)`;
    const rtExpr = signed ? `gpr[${rt}]` : `(gpr[${rt}] >>> 0)`;
    const divOp = signed ? '| 0' : '>>> 0';
    return this.rawStmt(
      `if (gpr[${rt}] !== 0) { ` +
      `state.lo = (${rsExpr} / ${rtExpr}) ${divOp}; ` +
      `state.hi = (${rsExpr} % ${rtExpr}) ${divOp}; }`
    );
  }
}
