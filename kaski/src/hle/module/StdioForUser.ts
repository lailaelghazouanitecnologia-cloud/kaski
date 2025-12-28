/**
 * StdioForUser
 *
 * Standard I/O file descriptors.
 * Provides access to stdin, stdout, stderr.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';

/**
 * Standard file descriptor IDs
 */
const STDIN_FD = 0;
const STDOUT_FD = 1;
const STDERR_FD = 2;

@hleModule('StdioForUser')
export class StdioForUser
{
  readonly name = 'StdioForUser';

  private ctx!: EmulatorContext;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceKernelStdin
   * Get stdin file descriptor
   *
   * @returns File descriptor (0)
   */
  @nativeFunction(0x172D316E, 150)
  sceKernelStdin(): number
  {
    return STDIN_FD;
  }

  /**
   * sceKernelStdout
   * Get stdout file descriptor
   *
   * @returns File descriptor (1)
   */
  @nativeFunction(0xA6BAB2E9, 150)
  sceKernelStdout(): number
  {
    return STDOUT_FD;
  }

  /**
   * sceKernelStderr
   * Get stderr file descriptor
   *
   * @returns File descriptor (2)
   */
  @nativeFunction(0xF78BA90A, 150)
  sceKernelStderr(): number
  {
    return STDERR_FD;
  }
}
