import { Memory } from '../memory';
import { CpuState } from './CpuState';
import { Instruction } from './Instruction';
import { Interpreter, ExecutionResult } from './Interpreter';
import { InstructionTable } from './InstructionTable';
import { disassembler, type DisassemblyResult } from './Disassembler';

/**
 * CPU execution mode
 */
export const enum CpuMode {
  /** Interpreter mode (instruction by instruction) */
  INTERPRETER = 0,
  /** JIT compilation mode (future) */
  JIT = 1,
}

/**
 * CPU execution status
 */
export const enum CpuStatus {
  /** CPU is stopped */
  STOPPED = 0,
  /** CPU is running */
  RUNNING = 1,
  /** CPU hit a breakpoint */
  BREAKPOINT = 2,
  /** CPU executed syscall */
  SYSCALL = 3,
  /** CPU encountered an error */
  ERROR = 4,
}

/**
 * Syscall handler function type
 */
export type SyscallHandler = (cpu: Cpu, code: number) => void;

/**
 * Breakpoint callback type
 */
export type BreakpointCallback = (cpu: Cpu, address: number) => boolean;

/**
 * CPU Event types
 */
export interface CpuEvents {
  onSyscall?: SyscallHandler;
  onBreakpoint?: BreakpointCallback;
  onStep?: (cpu: Cpu, instruction: Instruction) => void;
  onError?: (cpu: Cpu, error: Error) => void;
}

/**
 * PSP CPU - Complete MIPS R4000 CPU implementation
 *
 * Integrates:
 * - Memory subsystem
 * - CPU state (registers)
 * - Instruction decoder
 * - Interpreter execution
 *
 * Future:
 * - JIT compilation
 * - Static analysis / decompilation
 */
export class Cpu {
  /** Memory subsystem */
  readonly memory: Memory;

  /** CPU state (registers) */
  readonly state: CpuState;

  /** Instruction interpreter */
  private readonly interpreter: Interpreter;

  /** Instruction table for decoding */
  private readonly table: InstructionTable;

  /** Current execution mode */
  private mode: CpuMode = CpuMode.INTERPRETER;

  /** Current status */
  private _status: CpuStatus = CpuStatus.STOPPED;

  /** Breakpoints (address -> enabled) */
  private breakpoints: Map<number, boolean> = new Map();

  /** Event handlers */
  private events: CpuEvents = {};

  /** Instructions executed counter */
  private _instructionsExecuted: number = 0;

  /** Cycles counter (approximation) */
  private _cycles: number = 0;

  constructor(memory?: Memory) {
    this.memory = memory ?? new Memory();
    this.state = new CpuState(this.memory);
    this.interpreter = new Interpreter();
    this.table = InstructionTable.instance;
  }

  // ============================================
  // Status and Properties
  // ============================================

  get status(): CpuStatus {
    return this._status;
  }

  get pc(): number {
    return this.state.pc;
  }

  set pc(value: number) {
    this.state.pc = value >>> 0;
  }

  get instructionsExecuted(): number {
    return this._instructionsExecuted;
  }

  get cycles(): number {
    return this._cycles;
  }

  get isRunning(): boolean {
    return this._status === CpuStatus.RUNNING;
  }

  // ============================================
  // Event Registration
  // ============================================

  /**
   * Register event handlers
   */
  on(events: CpuEvents): void {
    this.events = { ...this.events, ...events };
  }

  /**
   * Set syscall handler
   */
  setSyscallHandler(handler: SyscallHandler): void {
    this.events.onSyscall = handler;
  }

  // ============================================
  // Breakpoint Management
  // ============================================

  /**
   * Add a breakpoint at address
   */
  addBreakpoint(address: number): void {
    this.breakpoints.set(address >>> 0, true);
  }

  /**
   * Remove a breakpoint
   */
  removeBreakpoint(address: number): void {
    this.breakpoints.delete(address >>> 0);
  }

  /**
   * Check if breakpoint exists at address
   */
  hasBreakpoint(address: number): boolean {
    return this.breakpoints.get(address >>> 0) === true;
  }

  /**
   * Enable/disable a breakpoint
   */
  toggleBreakpoint(address: number, enabled: boolean): void {
    if (this.breakpoints.has(address >>> 0)) {
      this.breakpoints.set(address >>> 0, enabled);
    }
  }

  /**
   * Clear all breakpoints
   */
  clearBreakpoints(): void {
    this.breakpoints.clear();
  }

  /**
   * Get all breakpoint addresses
   */
  getBreakpoints(): number[] {
    return Array.from(this.breakpoints.keys());
  }

  // ============================================
  // Execution Control
  // ============================================

  /**
   * Execute a single instruction at current PC
   */
  step(): CpuStatus {
    if (this._status === CpuStatus.ERROR) {
      return this._status;
    }

    try {
      // Check for breakpoint
      if (this.hasBreakpoint(this.state.pc)) {
        if (this.events.onBreakpoint) {
          const shouldContinue = this.events.onBreakpoint(this, this.state.pc);
          if (!shouldContinue) {
            this._status = CpuStatus.BREAKPOINT;
            return this._status;
          }
        } else {
          this._status = CpuStatus.BREAKPOINT;
          return this._status;
        }
      }

      // Fetch instruction
      const instr = Instruction.fromMemory(this.memory, this.state.pc);

      // Notify step event
      if (this.events.onStep) {
        this.events.onStep(this, instr);
      }

      // Execute
      const result = this.interpreter.execute(this.state, instr);
      this._instructionsExecuted++;
      this._cycles++;

      // Handle result
      switch (result) {
        case ExecutionResult.CONTINUE:
          this.state.pc = (this.state.pc + 4) >>> 0;
          this._status = CpuStatus.RUNNING;
          break;

        case ExecutionResult.BRANCH:
          // PC already set by branch handler
          this._status = CpuStatus.RUNNING;
          break;

        case ExecutionResult.SYSCALL:
          if (this.events.onSyscall) {
            const syscallCode = instr.syscall;
            this.events.onSyscall(this, syscallCode);
          }
          this.state.pc = (this.state.pc + 4) >>> 0;
          this._status = CpuStatus.SYSCALL;
          break;

        case ExecutionResult.BREAK:
          this._status = CpuStatus.BREAKPOINT;
          break;

        case ExecutionResult.UNKNOWN:
          this._status = CpuStatus.ERROR;
          break;
      }

      return this._status;
    } catch (error) {
      this._status = CpuStatus.ERROR;
      if (this.events.onError) {
        this.events.onError(this, error as Error);
      }
      return this._status;
    }
  }

  /**
   * Run until stopped, breakpoint, or max instructions reached
   */
  run(maxInstructions: number = 1000000): CpuStatus {
    this._status = CpuStatus.RUNNING;

    for (let i = 0; i < maxInstructions; i++) {
      const status = this.step();

      if (status !== CpuStatus.RUNNING) {
        return status;
      }
    }

    return this._status;
  }

  /**
   * Run until specific address is reached
   */
  runUntil(address: number, maxInstructions: number = 1000000): CpuStatus {
    const targetAddress = address >>> 0;
    this._status = CpuStatus.RUNNING;

    for (let i = 0; i < maxInstructions; i++) {
      if (this.state.pc === targetAddress) {
        this._status = CpuStatus.STOPPED;
        return this._status;
      }

      const status = this.step();

      if (status !== CpuStatus.RUNNING) {
        return status;
      }
    }

    return this._status;
  }

  /**
   * Stop execution
   */
  stop(): void {
    this._status = CpuStatus.STOPPED;
  }

  /**
   * Reset CPU to initial state
   */
  reset(): void {
    this.state.reset();
    this._status = CpuStatus.STOPPED;
    this._instructionsExecuted = 0;
    this._cycles = 0;
  }

  // ============================================
  // Program Loading
  // ============================================

  /**
   * Load raw binary data into memory
   */
  loadBinary(data: Uint8Array, address: number): void {
    const baseAddress = address >>> 0;
    for (let i = 0; i < data.length; i++) {
      this.memory.sb(baseAddress + i, data[i]);
    }
  }

  /**
   * Load 32-bit words into memory
   */
  loadWords(words: number[], address: number): void {
    const baseAddress = address >>> 0;
    for (let i = 0; i < words.length; i++) {
      this.memory.sw(baseAddress + i * 4, words[i]);
    }
  }

  /**
   * Set entry point and initialize stack
   */
  setEntryPoint(address: number, stackPointer?: number): void {
    this.state.pc = address >>> 0;
    if (stackPointer !== undefined) {
      this.state.sp = stackPointer >>> 0;
    }
  }

  // ============================================
  // Debugging / Inspection
  // ============================================

  /**
   * Disassemble instruction at address
   */
  disassembleAt(address: number): DisassemblyResult {
    const instr = Instruction.fromMemory(this.memory, address >>> 0);
    return disassembler.disassemble(instr);
  }

  /**
   * Disassemble range of instructions
   */
  disassembleRange(address: number, count: number): DisassemblyResult[] {
    return disassembler.disassembleRange(this.memory, address >>> 0, count);
  }

  /**
   * Get instruction at address
   */
  getInstruction(address: number): Instruction {
    return Instruction.fromMemory(this.memory, address >>> 0);
  }

  /**
   * Dump CPU state for debugging
   */
  dump(): string {
    const lines: string[] = [];
    lines.push('=== CPU State ===');
    lines.push(`Status: ${CpuStatus[this._status]}`);
    lines.push(`Instructions: ${this._instructionsExecuted}`);
    lines.push(`Cycles: ${this._cycles}`);
    lines.push('');
    lines.push(this.state.dumpGpr());
    lines.push('');
    lines.push('=== Current Instruction ===');
    const disasm = this.disassembleAt(this.state.pc);
    lines.push(`0x${this.state.pc.toString(16).padStart(8, '0')}: ${disasm.text}`);
    return lines.join('\n');
  }

  /**
   * Read memory as hex dump
   */
  hexDump(address: number, length: number): string {
    const lines: string[] = [];
    const baseAddr = address >>> 0;

    for (let offset = 0; offset < length; offset += 16) {
      const addr = baseAddr + offset;
      let hex = '';
      let ascii = '';

      for (let i = 0; i < 16 && offset + i < length; i++) {
        const byte = this.memory.lbu(addr + i);
        hex += byte.toString(16).padStart(2, '0') + ' ';
        ascii += byte >= 32 && byte < 127 ? String.fromCharCode(byte) : '.';
      }

      lines.push(
        `${addr.toString(16).padStart(8, '0')}: ${hex.padEnd(48)} ${ascii}`
      );
    }

    return lines.join('\n');
  }

  // ============================================
  // Register Access Shortcuts
  // ============================================

  getGpr(index: number): number {
    return this.state.getGpr(index);
  }

  setGpr(index: number, value: number): void {
    this.state.setGpr(index, value);
  }

  get v0(): number { return this.state.v0; }
  set v0(value: number) { this.state.v0 = value; }

  get v1(): number { return this.state.v1; }
  set v1(value: number) { this.state.v1 = value; }

  get a0(): number { return this.state.a0; }
  set a0(value: number) { this.state.a0 = value; }

  get a1(): number { return this.state.a1; }
  set a1(value: number) { this.state.a1 = value; }

  get a2(): number { return this.state.a2; }
  set a2(value: number) { this.state.a2 = value; }

  get a3(): number { return this.state.a3; }
  set a3(value: number) { this.state.a3 = value; }

  get sp(): number { return this.state.sp; }
  set sp(value: number) { this.state.sp = value; }

  get ra(): number { return this.state.ra; }
  set ra(value: number) { this.state.ra = value; }
}
