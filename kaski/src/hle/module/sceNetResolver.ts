/**
 * sceNetResolver
 *
 * DNS resolver module.
 * Provides hostname resolution.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * Resolver context
 */
interface ResolverContext
{
  id: number;
  inUse: boolean;
}

const MAX_RESOLVERS = 8;

@hleModule('sceNetResolver')
export class sceNetResolver
{
  readonly name = 'sceNetResolver';

  private ctx!: EmulatorContext;

  private resolvers: ResolverContext[] = [];
  private nextResolverId = 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.resolvers = [];
    this.nextResolverId = 1;
  }

  /**
   * sceNetResolverInit
   * Initialize resolver library
   *
   * @returns 0 on success
   */
  @nativeFunction(0xF3370E61, 150)
  sceNetResolverInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverTerm
   * Terminate resolver library
   *
   * @returns 0 on success
   */
  @nativeFunction(0x6138194A, 150)
  sceNetResolverTerm(): number
  {
    this.resolvers = [];
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverCreate
   * Create resolver
   *
   * @param resolverIdPtr - Output resolver ID
   * @param buffer - Work buffer
   * @param bufferLen - Buffer length
   * @returns 0 on success
   */
  @nativeFunction(0x244172AF, 150)
  sceNetResolverCreate(): number
  {
    const resolverIdPtr = this.ctx.argPtr(0);

    const resolver: ResolverContext = {
      id: this.nextResolverId++,
      inUse: true,
    };
    this.resolvers.push(resolver);

    if (resolverIdPtr)
    {
      this.ctx.write32(resolverIdPtr, resolver.id);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverDelete
   * Delete resolver
   *
   * @param resolverId - Resolver ID
   * @returns 0 on success
   */
  @nativeFunction(0x94523E09, 150)
  sceNetResolverDelete(): number
  {
    const resolverId = this.ctx.arg(0);

    const index = this.resolvers.findIndex(r => r.id === resolverId);
    if (index >= 0)
    {
      this.resolvers.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverStartNtoA
   * Resolve hostname to address
   *
   * @param resolverId - Resolver ID
   * @param hostname - Hostname to resolve
   * @param addrPtr - Output address
   * @param timeout - Timeout in microseconds
   * @param retries - Retry count
   * @returns 0 on success
   */
  @nativeFunction(0x224C5F44, 150)
  sceNetResolverStartNtoA(): number
  {
    const addrPtr = this.ctx.argPtr(2);

    // Return loopback address
    if (addrPtr)
    {
      // 127.0.0.1 in network byte order
      this.ctx.write32(addrPtr, 0x0100007F);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverStartAtoN
   * Resolve address to hostname
   *
   * @returns 0 on success
   */
  @nativeFunction(0x629E2FB7, 150)
  sceNetResolverStartAtoN(): number
  {
    const hostnamePtr = this.ctx.argPtr(2);

    if (hostnamePtr)
    {
      this.ctx.writeStringZ(hostnamePtr, 'localhost');
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverStop
   * Stop resolver operation
   *
   * @returns 0 on success
   */
  @nativeFunction(0x808F6063, 150)
  sceNetResolverStop(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverStartNtoAAsync
   * Async hostname resolution
   *
   * @returns 0 on success
   */
  @nativeFunction(0x12748EB9, 150)
  sceNetResolverStartNtoAAsync(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverStartAtoNAsync
   * Async address resolution
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4EE99358, 150)
  sceNetResolverStartAtoNAsync(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceNetResolverPollAsync
   * Poll async operation
   *
   * @returns 0 if complete, 1 if in progress
   */
  @nativeFunction(0x14C17EF9, 150)
  sceNetResolverPollAsync(): number
  {
    return 0; // Complete
  }

  /**
   * sceNetResolverWaitAsync
   * Wait for async operation
   *
   * @returns 0 on success
   */
  @nativeFunction(0x3A2B930C, 150)
  sceNetResolverWaitAsync(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
