/**
 * InterruptManager
 *
 * Interrupt management module.
 * Handles sub-interrupt registration and control.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * PSP interrupt types
 */
export const enum PspInterrupts
{
  GPIO = 4,
  ATA = 5,
  UMD = 6,
  MSCM0 = 7,
  WLAN = 8,
  AUDIO = 10,
  I2C = 12,
  SIRS = 14,
  SYSTIMER0 = 15,
  SYSTIMER1 = 16,
  SYSTIMER2 = 17,
  SYSTIMER3 = 18,
  THREAD0 = 19,
  NAND = 20,
  DMACPLUS = 21,
  DMA0 = 22,
  DMA1 = 23,
  MEMLMD = 24,
  GE = 25,
  VBLANK = 30,
  MECODEC = 31,
  HPRM = 36,
  MSCM1 = 60,
  MSCM2 = 61,
  NUMBER_INTERRUPTS = 67,
}

/**
 * Interrupt handler info
 */
interface InterruptHandler
{
  enabled: boolean;
  address: number;
  argument: number;
}

@hleModule('InterruptManager')
export class InterruptManager
{
  readonly name = 'InterruptManager';

  private ctx!: EmulatorContext;

  // Interrupt handlers: interrupt -> handler index -> handler
  private handlers: Map<number, Map<number, InterruptHandler>> = new Map();

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.handlers.clear();
  }

  private getHandler(interrupt: number, index: number): InterruptHandler
  {
    if (!this.handlers.has(interrupt))
    {
      this.handlers.set(interrupt, new Map());
    }

    const interruptHandlers = this.handlers.get(interrupt)!;
    if (!interruptHandlers.has(index))
    {
      interruptHandlers.set(index, {
        enabled: false,
        address: 0,
        argument: 0,
      });
    }

    return interruptHandlers.get(index)!;
  }

  /**
   * sceKernelRegisterSubIntrHandler
   * Register a sub-interrupt handler
   *
   * @param interrupt - Interrupt type
   * @param handlerIndex - Handler index
   * @param callbackAddress - Callback function address
   * @param callbackArgument - Callback argument
   * @returns 0 on success
   */
  @nativeFunction(0xCA04A2B9, 150)
  sceKernelRegisterSubIntrHandler(): number
  {
    const interrupt = this.ctx.arg(0) as PspInterrupts;
    const handlerIndex = this.ctx.arg(1);
    const callbackAddress = this.ctx.arg(2);
    const callbackArgument = this.ctx.arg(3);

    this.ctx.log(`sceKernelRegisterSubIntrHandler(${PspInterrupts[interrupt] || interrupt}, ${handlerIndex}, 0x${callbackAddress.toString(16)})`);

    const handler = this.getHandler(interrupt, handlerIndex);
    handler.address = callbackAddress;
    handler.argument = callbackArgument;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelEnableSubIntr
   * Enable a sub-interrupt handler
   *
   * @param interrupt - Interrupt type
   * @param handlerIndex - Handler index
   * @returns 0 on success
   */
  @nativeFunction(0xFB8E22EC, 150)
  sceKernelEnableSubIntr(): number
  {
    const interrupt = this.ctx.arg(0) as PspInterrupts;
    const handlerIndex = this.ctx.arg(1);

    if (interrupt >= PspInterrupts.NUMBER_INTERRUPTS)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    const handler = this.getHandler(interrupt, handlerIndex);
    handler.enabled = true;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelDisableSubIntr
   * Disable a sub-interrupt handler
   *
   * @param interrupt - Interrupt type
   * @param handlerIndex - Handler index
   * @returns 0 on success
   */
  @nativeFunction(0x8DFBD787, 150)
  sceKernelDisableSubIntr(): number
  {
    const interrupt = this.ctx.arg(0) as PspInterrupts;
    const handlerIndex = this.ctx.arg(1);

    if (interrupt >= PspInterrupts.NUMBER_INTERRUPTS)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    const handler = this.getHandler(interrupt, handlerIndex);
    handler.enabled = false;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelReleaseSubIntrHandler
   * Release a sub-interrupt handler
   *
   * @param interrupt - Interrupt type
   * @param handlerIndex - Handler index
   * @returns 0 on success
   */
  @nativeFunction(0xD61E6961, 150)
  sceKernelReleaseSubIntrHandler(): number
  {
    const interrupt = this.ctx.arg(0) as PspInterrupts;
    const handlerIndex = this.ctx.arg(1);

    if (interrupt >= PspInterrupts.NUMBER_INTERRUPTS)
    {
      return SceKernelErrors.ERROR_KERNEL_ILLEGAL_ARGUMENT;
    }

    const interruptHandlers = this.handlers.get(interrupt);
    if (interruptHandlers)
    {
      interruptHandlers.delete(handlerIndex);
    }

    return SceKernelErrors.ERROR_OK;
  }
}
