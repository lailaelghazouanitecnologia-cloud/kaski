/**
 * LoadExecForUser
 *
 * Module loading and execution control.
 * Provides functions to load and execute modules/games.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

@hleModule('LoadExecForUser')
export class LoadExecForUser
{
  readonly name = 'LoadExecForUser';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceKernelExitGame
   * Exit the game and return to XMB
   *
   * @returns Never returns
   */
  @nativeFunction(0x05572A5F, 150)
  sceKernelExitGame(): number
  {
    this.ctx.log('sceKernelExitGame called - stopping emulator');
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelExitGameWithStatus
   * Exit the game with a status code
   *
   * @param status - Exit status
   * @returns Never returns
   */
  @nativeFunction(0x2AC9954B, 150)
  sceKernelExitGameWithStatus(): number
  {
    const status = this.ctx.arg(0);
    this.ctx.log(`sceKernelExitGameWithStatus(${status}) - stopping emulator`);
    this.ctx.stop();
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelRegisterExitCallback
   * Register exit callback
   *
   * @param cbid - Callback ID
   * @returns 0 on success
   */
  @nativeFunction(0x4AC57943, 150)
  sceKernelRegisterExitCallback(): number
  {
    const cbid = this.ctx.arg(0);
    this.ctx.log(`sceKernelRegisterExitCallback(${cbid})`);
    // Store callback but don't do anything special
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceKernelLoadExec
   * Load and execute a module
   *
   * @param file - Path to executable
   * @param param - Load parameters
   * @returns Never returns on success
   */
  @nativeFunction(0xBD2F1094, 150)
  sceKernelLoadExec(): number
  {
    const filePtr = this.ctx.argPtr(0);
    const file = this.ctx.readString(filePtr);

    this.ctx.log(`sceKernelLoadExec("${file}") - not implemented`);

    // In a real implementation, this would:
    // 1. Load the new executable
    // 2. Reset the emulator state
    // 3. Start the new program
    // For now, return error
    return SceKernelErrors.ERROR_NOT_SUPPORTED;
  }

  /**
   * sceKernelLoadExecVSHMs2
   * Load and execute from Memory Stick (VSH)
   *
   * @param file - Path to executable
   * @param param - Load parameters
   * @returns Never returns on success
   */
  @nativeFunction(0xD1FB50DC, 150)
  sceKernelLoadExecVSHMs2(): number
  {
    return this.sceKernelLoadExec();
  }

  /**
   * sceKernelLoadExecVSHDisc
   * Load and execute from disc (VSH)
   *
   * @param file - Path to executable
   * @param param - Load parameters
   * @returns Never returns on success
   */
  @nativeFunction(0xD8320A28, 150)
  sceKernelLoadExecVSHDisc(): number
  {
    return this.sceKernelLoadExec();
  }
}
