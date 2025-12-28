/**
 * sceHttp
 *
 * HTTP client module.
 * Provides HTTP request functionality.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * HTTP template
 */
interface HttpTemplate
{
  id: number;
  inUse: boolean;
  userAgent: string;
}

/**
 * HTTP connection
 */
interface HttpConnection
{
  id: number;
  templateId: number;
  host: string;
  port: number;
}

/**
 * HTTP request
 */
interface HttpRequest
{
  id: number;
  connectionId: number;
  method: number;
  url: string;
  contentLength: number;
}

@hleModule('sceHttp')
export class sceHttp
{
  readonly name = 'sceHttp';

  private ctx!: EmulatorContext;

  private templates: HttpTemplate[] = [];
  private connections: HttpConnection[] = [];
  private requests: HttpRequest[] = [];
  private nextTemplateId = 1;
  private nextConnectionId = 1;
  private nextRequestId = 1;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
    this.templates = [];
    this.connections = [];
    this.requests = [];
    this.nextTemplateId = 1;
    this.nextConnectionId = 1;
    this.nextRequestId = 1;
  }

  /**
   * sceHttpInit
   * Initialize HTTP library
   *
   * @param memSize - Memory pool size
   * @returns 0 on success
   */
  @nativeFunction(0xAB1ABE07, 150)
  sceHttpInit(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpEnd
   * Terminate HTTP library
   *
   * @returns 0 on success
   */
  @nativeFunction(0xD1C8945E, 150)
  sceHttpEnd(): number
  {
    this.templates = [];
    this.connections = [];
    this.requests = [];
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpCreateTemplate
   * Create HTTP template
   *
   * @returns Template ID or error
   */
  @nativeFunction(0x9B1F1F36, 150)
  sceHttpCreateTemplate(): number
  {
    const template: HttpTemplate = {
      id: this.nextTemplateId++,
      inUse: true,
      userAgent: 'PSP',
    };
    this.templates.push(template);

    return template.id;
  }

  /**
   * sceHttpDeleteTemplate
   * Delete HTTP template
   *
   * @returns 0 on success
   */
  @nativeFunction(0xFCF8C055, 150)
  sceHttpDeleteTemplate(): number
  {
    const templateId = this.ctx.arg(0);

    const index = this.templates.findIndex(t => t.id === templateId);
    if (index >= 0)
    {
      this.templates.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpCreateConnection
   * Create HTTP connection
   *
   * @returns Connection ID or error
   */
  @nativeFunction(0xCDF8ECB9, 150)
  sceHttpCreateConnection(): number
  {
    const templateId = this.ctx.arg(0);
    const hostPtr = this.ctx.argPtr(1);
    const port = this.ctx.arg(3);

    const host = hostPtr ? this.ctx.readStringZ(hostPtr) : 'localhost';

    const connection: HttpConnection = {
      id: this.nextConnectionId++,
      templateId,
      host,
      port,
    };
    this.connections.push(connection);

    return connection.id;
  }

  /**
   * sceHttpCreateConnectionWithURL
   * Create HTTP connection with URL
   *
   * @returns Connection ID or error
   */
  @nativeFunction(0xD081EC8F, 150)
  sceHttpCreateConnectionWithURL(): number
  {
    const templateId = this.ctx.arg(0);

    const connection: HttpConnection = {
      id: this.nextConnectionId++,
      templateId,
      host: 'localhost',
      port: 80,
    };
    this.connections.push(connection);

    return connection.id;
  }

  /**
   * sceHttpDeleteConnection
   * Delete HTTP connection
   *
   * @returns 0 on success
   */
  @nativeFunction(0x5152773B, 150)
  sceHttpDeleteConnection(): number
  {
    const connectionId = this.ctx.arg(0);

    const index = this.connections.findIndex(c => c.id === connectionId);
    if (index >= 0)
    {
      this.connections.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpCreateRequest
   * Create HTTP request
   *
   * @returns Request ID or error
   */
  @nativeFunction(0xB509B09E, 150)
  sceHttpCreateRequest(): number
  {
    const connectionId = this.ctx.arg(0);
    const method = this.ctx.arg(1);
    const urlPtr = this.ctx.argPtr(2);
    const contentLength = this.ctx.arg(3);

    const url = urlPtr ? this.ctx.readStringZ(urlPtr) : '/';

    const request: HttpRequest = {
      id: this.nextRequestId++,
      connectionId,
      method,
      url,
      contentLength,
    };
    this.requests.push(request);

    return request.id;
  }

  /**
   * sceHttpCreateRequestWithURL
   * Create HTTP request with URL
   *
   * @returns Request ID or error
   */
  @nativeFunction(0xB3FAF831, 150)
  sceHttpCreateRequestWithURL(): number
  {
    const connectionId = this.ctx.arg(0);
    const method = this.ctx.arg(1);

    const request: HttpRequest = {
      id: this.nextRequestId++,
      connectionId,
      method,
      url: '/',
      contentLength: 0,
    };
    this.requests.push(request);

    return request.id;
  }

  /**
   * sceHttpDeleteRequest
   * Delete HTTP request
   *
   * @returns 0 on success
   */
  @nativeFunction(0xA5512E01, 150)
  sceHttpDeleteRequest(): number
  {
    const requestId = this.ctx.arg(0);

    const index = this.requests.findIndex(r => r.id === requestId);
    if (index >= 0)
    {
      this.requests.splice(index, 1);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSendRequest
   * Send HTTP request
   *
   * @returns 0 on success
   */
  @nativeFunction(0xBB70706F, 150)
  sceHttpSendRequest(): number
  {
    // Network not available
    return 0x80431082; // SCE_HTTP_ERROR_NETWORK
  }

  /**
   * sceHttpAbortRequest
   * Abort HTTP request
   *
   * @returns 0 on success
   */
  @nativeFunction(0xC10B6B76, 150)
  sceHttpAbortRequest(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpReadData
   * Read response data
   *
   * @returns Bytes read or error
   */
  @nativeFunction(0xEDEEB999, 150)
  sceHttpReadData(): number
  {
    return 0; // EOF
  }

  /**
   * sceHttpGetContentLength
   * Get content length
   *
   * @returns 0 on success
   */
  @nativeFunction(0x0282A3BD, 150)
  sceHttpGetContentLength(): number
  {
    const lengthPtr = this.ctx.argPtr(1);

    if (lengthPtr)
    {
      this.ctx.write64(lengthPtr, 0n);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpGetStatusCode
   * Get HTTP status code
   *
   * @returns 0 on success
   */
  @nativeFunction(0x4CC7D78F, 150)
  sceHttpGetStatusCode(): number
  {
    const statusPtr = this.ctx.argPtr(1);

    if (statusPtr)
    {
      this.ctx.write32(statusPtr, 200);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetResolveRetry
   * Set resolve retry count
   *
   * @returns 0 on success
   */
  @nativeFunction(0x47347B50, 150)
  sceHttpSetResolveRetry(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetResolveTimeOut
   * Set resolve timeout
   *
   * @returns 0 on success
   */
  @nativeFunction(0x03D9526F, 150)
  sceHttpSetResolveTimeOut(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetConnectTimeOut
   * Set connect timeout
   *
   * @returns 0 on success
   */
  @nativeFunction(0x8ACD1F73, 150)
  sceHttpSetConnectTimeOut(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetSendTimeOut
   * Set send timeout
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9988172D, 150)
  sceHttpSetSendTimeOut(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetRecvTimeOut
   * Set receive timeout
   *
   * @returns 0 on success
   */
  @nativeFunction(0x1F0FC3E3, 150)
  sceHttpSetRecvTimeOut(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpEnableKeepAlive
   * Enable keep-alive
   *
   * @returns 0 on success
   */
  @nativeFunction(0x78A0D3EC, 150)
  sceHttpEnableKeepAlive(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpDisableKeepAlive
   * Disable keep-alive
   *
   * @returns 0 on success
   */
  @nativeFunction(0xC7EF2559, 150)
  sceHttpDisableKeepAlive(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpEnableRedirect
   * Enable redirect
   *
   * @returns 0 on success
   */
  @nativeFunction(0x0B12ABFB, 150)
  sceHttpEnableRedirect(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpDisableRedirect
   * Disable redirect
   *
   * @returns 0 on success
   */
  @nativeFunction(0x1A0EBB69, 150)
  sceHttpDisableRedirect(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpEnableCookie
   * Enable cookies
   *
   * @returns 0 on success
   */
  @nativeFunction(0x0DAFA58F, 150)
  sceHttpEnableCookie(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpDisableCookie
   * Disable cookies
   *
   * @returns 0 on success
   */
  @nativeFunction(0x0B12ABFC, 150)
  sceHttpDisableCookie(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpAddExtraHeader
   * Add extra header
   *
   * @returns 0 on success
   */
  @nativeFunction(0x15540184, 150)
  sceHttpAddExtraHeader(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpDeleteHeader
   * Delete header
   *
   * @returns 0 on success
   */
  @nativeFunction(0x76D1363B, 150)
  sceHttpDeleteHeader(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpGetAllHeader
   * Get all headers
   *
   * @returns 0 on success
   */
  @nativeFunction(0xDB266CCF, 150)
  sceHttpGetAllHeader(): number
  {
    const headerSizePtr = this.ctx.argPtr(2);

    if (headerSizePtr)
    {
      this.ctx.write32(headerSizePtr, 0);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetAuthInfoCB
   * Set auth info callback
   *
   * @returns 0 on success
   */
  @nativeFunction(0xF49934F6, 150)
  sceHttpSetAuthInfoCB(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSetMallocFunction
   * Set malloc function
   *
   * @returns 0 on success
   */
  @nativeFunction(0xCC7F3B75, 150)
  sceHttpSetMallocFunction(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpLoadSystemCookie
   * Load system cookies
   *
   * @returns 0 on success
   */
  @nativeFunction(0x9668864C, 150)
  sceHttpLoadSystemCookie(): number
  {
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceHttpSaveSystemCookie
   * Save system cookies
   *
   * @returns 0 on success
   */
  @nativeFunction(0x76D1363C, 150)
  sceHttpSaveSystemCookie(): number
  {
    return SceKernelErrors.ERROR_OK;
  }
}
