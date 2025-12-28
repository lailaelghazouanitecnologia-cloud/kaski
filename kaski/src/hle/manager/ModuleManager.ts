/**
 * Module Manager
 *
 * Manages HLE modules and syscall registration.
 * Modules are collections of native functions mapped by NID.
 */

import type { EmulatorContext } from '../EmulatorContext';

// ============================================
// Types
// ============================================

/**
 * Native function handler
 */
export type NativeFunction = (ctx: EmulatorContext) => number | Promise<number> | void;

/**
 * Function info
 */
export interface FunctionInfo
{
  /** Numeric ID */
  nid: number;
  /** Function name */
  name: string;
  /** Handler */
  handler: NativeFunction;
  /** Firmware version required */
  firmwareVersion: number;
  /** Module name */
  moduleName: string;
}

/**
 * Module interface
 */
export interface HleModule
{
  /** Module name */
  readonly name: string;
  /** Initialize module with context */
  init?(ctx: EmulatorContext): void;
  /** Reset module */
  reset?(): void;
}

// ============================================
// Decorators
// ============================================

const MODULE_FUNCTIONS = Symbol('module_functions');
const MODULE_NAME = Symbol('module_name');

interface ModuleFunctionMeta
{
  nid: number;
  name: string;
  firmwareVersion: number;
}

/**
 * Decorator for module class
 */
export function hleModule(name: string): ClassDecorator
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: any) =>
  {
    target[MODULE_NAME] = name;
    return target;
  };
}

/**
 * Decorator for native function
 */
export function nativeFunction(nid: number, firmwareVersion: number = 150): MethodDecorator
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor) =>
  {
    const constructor = target.constructor;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let functions: ModuleFunctionMeta[] = (constructor as any)[MODULE_FUNCTIONS];
    if (!functions)
    {
      functions = [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (constructor as any)[MODULE_FUNCTIONS] = functions;
    }
    functions.push({
      nid,
      name: propertyKey as string,
      firmwareVersion,
    });
  };
}

// ============================================
// Module Manager
// ============================================

/**
 * Module Manager
 */
export class ModuleManager
{
  /** Functions by NID */
  private functionsByNid: Map<number, FunctionInfo> = new Map();

  /** Functions by name */
  private functionsByName: Map<string, FunctionInfo> = new Map();

  /** Functions by syscall number (for runtime lookup) */
  private functionsBySyscall: Map<number, FunctionInfo> = new Map();

  /** NID to syscall number mapping (assigned during stub patching) */
  private nidToSyscallNum: Map<number, number> = new Map();

  /** Next syscall number to assign (max 20-bit = 0xFFFFF) */
  private nextSyscallNum: number = 1;

  /** Module instances */
  private modules: Map<string, HleModule> = new Map();

  /** Emulator context */
  private context: EmulatorContext | null = null;

  constructor()
  {
  }

  /**
   * Set emulator context
   */
  setContext(ctx: EmulatorContext): void
  {
    this.context = ctx;
  }

  /**
   * Reset to initial state
   */
  reset(): void
  {
    for (const module of this.modules.values())
    {
      module.reset?.();
    }
  }

  /**
   * Register a module class
   */
  registerModule(moduleClass: new () => HleModule): void
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const moduleName = (moduleClass as any)[MODULE_NAME] as string | undefined;
    if (!moduleName)
    {
      throw new Error(`Module class ${moduleClass.name} is not decorated with @hleModule`);
    }

    const instance = new moduleClass();
    this.modules.set(moduleName, instance);

    // Initialize if context is available
    if (this.context)
    {
      instance.init?.(this.context);
    }

    // Register functions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const functions = (moduleClass as any)[MODULE_FUNCTIONS] as ModuleFunctionMeta[] | undefined;
    if (functions)
    {
      for (const func of functions)
      {
        const handler = (instance as Record<string, NativeFunction>)[func.name];
        if (typeof handler === 'function')
        {
          const info: FunctionInfo = {
            nid: func.nid,
            name: `${moduleName}::${func.name}`,
            handler: handler.bind(instance),
            firmwareVersion: func.firmwareVersion,
            moduleName,
          };
          this.functionsByNid.set(func.nid, info);
          this.functionsByName.set(info.name, info);
        }
      }
    }
  }

  /**
   * Register a standalone function
   */
  registerFunction(
    nid: number,
    name: string,
    handler: NativeFunction,
    moduleName: string = 'standalone',
    firmwareVersion: number = 150
  ): void
  {
    const info: FunctionInfo = {
      nid,
      name,
      handler,
      firmwareVersion,
      moduleName,
    };
    this.functionsByNid.set(nid, info);
    this.functionsByName.set(name, info);
  }

  /**
   * Get function by NID
   */
  getFunction(nid: number): FunctionInfo | undefined
  {
    return this.functionsByNid.get(nid);
  }

  /**
   * Get function by name
   */
  getFunctionByName(name: string): FunctionInfo | undefined
  {
    return this.functionsByName.get(name);
  }

  /**
   * Call function by NID
   */
  call(nid: number): number | Promise<number>
  {
    const func = this.functionsByNid.get(nid);
    if (!func)
    {
      console.warn(`Unknown syscall NID: 0x${nid.toString(16)}`);
      return 0;
    }

    if (!this.context)
    {
      throw new Error('Context not set');
    }

    const result = func.handler(this.context);
    if (result === undefined)
    {
      return 0;
    }
    return result;
  }

  /**
   * Get module by name
   */
  getModule<T extends HleModule>(name: string): T | undefined
  {
    return this.modules.get(name) as T | undefined;
  }

  /**
   * Initialize all modules
   */
  initAll(): void
  {
    if (!this.context) return;
    for (const module of this.modules.values())
    {
      module.init?.(this.context);
    }
  }

  /**
   * Get all registered function names
   */
  getFunctionNames(): string[]
  {
    return [...this.functionsByName.keys()];
  }

  /**
   * Get function count
   */
  get functionCount(): number
  {
    return this.functionsByNid.size;
  }

  /**
   * Get module count
   */
  get moduleCount(): number
  {
    return this.modules.size;
  }

  /**
   * Get syscall number for a NID
   *
   * Assigns a sequential syscall number (fits in 20 bits) and creates
   * a mapping for runtime lookup. The syscall number is used in the
   * patched import stubs.
   */
  getSyscallForNid(nid: number, _moduleName?: string): number | undefined
  {
    const func = this.functionsByNid.get(nid);
    if (!func)
    {
      return undefined;
    }

    // Check if we already assigned a syscall number
    let syscallNum = this.nidToSyscallNum.get(nid);
    if (syscallNum === undefined)
    {
      // Assign a new syscall number
      syscallNum = this.nextSyscallNum++;
      this.nidToSyscallNum.set(nid, syscallNum);
      this.functionsBySyscall.set(syscallNum, func);
    }

    return syscallNum;
  }

  /**
   * Get function by syscall number (used at runtime)
   */
  getFunctionBySyscall(syscallNum: number): FunctionInfo | undefined
  {
    return this.functionsBySyscall.get(syscallNum);
  }

  /**
   * Get all registered NIDs
   */
  getRegisteredNids(): number[]
  {
    return [...this.functionsByNid.keys()];
  }
}
