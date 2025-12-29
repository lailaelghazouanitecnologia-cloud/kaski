import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, STRING, U32} from "../utils";

/**
 * PSP HTTP Module - Based on PPSSPP implementation
 * Most games that use HTTP just need init/term to succeed
 */
export class sceHttp {
	constructor(private context: EmulatorContext) { }

	private templateId = 1;
	private connectionId = 1;
	private requestId = 1;
	private initialized = false;

	/** Initialize the HTTP library */
	@nativeFunction(0xAB1ABE07, 150)
	@I32 sceHttpInit(@U32 poolSize: number) {
		this.initialized = true;
		return 0;
	}

	/** Terminate the HTTP library */
	@nativeFunction(0xD1C8945E, 150)
	@I32 sceHttpEnd() {
		this.initialized = false;
		return 0;
	}

	/** Create a HTTP template */
	@nativeFunction(0x9B1F1F36, 150)
	@I32 sceHttpCreateTemplate(@STRING agent: string, @I32 httpVer: number, @I32 autoProxyConf: number) {
		return this.templateId++;
	}

	/** Delete a HTTP template */
	@nativeFunction(0xFCF8C055, 150)
	@I32 sceHttpDeleteTemplate(@I32 templateId: number) {
		return 0;
	}

	/** Create a HTTP connection */
	@nativeFunction(0xCDF8ECB9, 150)
	@I32 sceHttpCreateConnection(@I32 templateId: number, @STRING host: string, @STRING scheme: string, @U32 port: number, @I32 enableKeepalive: number) {
		return this.connectionId++;
	}

	/** Create a HTTP connection with URL */
	@nativeFunction(0x8EEEE411, 150)
	@I32 sceHttpCreateConnectionWithURL(@I32 templateId: number, @STRING url: string, @I32 enableKeepalive: number) {
		return this.connectionId++;
	}

	/** Delete a HTTP connection */
	@nativeFunction(0x5152773B, 150)
	@I32 sceHttpDeleteConnection(@I32 connectionId: number) {
		return 0;
	}

	/** Create a HTTP request */
	@nativeFunction(0x47347B50, 150)
	@I32 sceHttpCreateRequest(@I32 connectionId: number, @I32 method: number, @STRING path: string, @U32 contentLength: number) {
		return this.requestId++;
	}

	/** Create a HTTP request with URL */
	@nativeFunction(0xB509B09E, 150)
	@I32 sceHttpCreateRequestWithURL(@I32 connectionId: number, @I32 method: number, @STRING url: string, @U32 contentLength: number) {
		return this.requestId++;
	}

	/** Delete a HTTP request */
	@nativeFunction(0xA5512E01, 150)
	@I32 sceHttpDeleteRequest(@I32 requestId: number) {
		return 0;
	}

	/** Send a HTTP request - stub returns error (no actual HTTP) */
	@nativeFunction(0xBB70706F, 150)
	@I32 sceHttpSendRequest(@I32 requestId: number, @PTR data: Stream, @U32 dataSize: number) {
		// Return error - actual HTTP requests are not supported
		return 0x80431001; // SCE_HTTP_ERROR_BEFORE_INIT
	}

	/** Abort a HTTP request */
	@nativeFunction(0xC10B6BD9, 150)
	@I32 sceHttpAbortRequest(@I32 requestId: number) {
		return 0;
	}

	/** Get response content length */
	@nativeFunction(0x0B12ABFB, 150)
	@I32 sceHttpGetContentLength(@I32 requestId: number, @PTR contentLengthPtr: Stream) {
		contentLengthPtr.writeInt64(0);
		return 0x80431001;
	}

	/** Get response status code */
	@nativeFunction(0x4CC7D78F, 150)
	@I32 sceHttpGetStatusCode(@I32 requestId: number, @PTR statusCodePtr: Stream) {
		statusCodePtr.writeInt32(0);
		return 0x80431001;
	}

	/** Read response data */
	@nativeFunction(0xEDEEB999, 150)
	@I32 sceHttpReadData(@I32 requestId: number, @PTR data: Stream, @U32 dataSize: number) {
		return 0; // No data to read
	}

	/** Set resolve timeout */
	@nativeFunction(0x03D9526F, 150)
	@I32 sceHttpSetResolveTimeOut(@I32 id: number, @U32 timeout: number) {
		return 0;
	}

	/** Set connect timeout */
	@nativeFunction(0x8ACD1F73, 150)
	@I32 sceHttpSetConnectTimeOut(@I32 id: number, @U32 timeout: number) {
		return 0;
	}

	/** Set send timeout */
	@nativeFunction(0x9988172D, 150)
	@I32 sceHttpSetSendTimeOut(@I32 id: number, @U32 timeout: number) {
		return 0;
	}

	/** Set receive timeout */
	@nativeFunction(0x1F0FC3E3, 150)
	@I32 sceHttpSetRecvTimeOut(@I32 id: number, @U32 timeout: number) {
		return 0;
	}

	/** Enable redirect */
	@nativeFunction(0x0DAFA58F, 150)
	@I32 sceHttpEnableRedirect(@I32 id: number) {
		return 0;
	}

	/** Disable redirect */
	@nativeFunction(0x1A0EBB69, 150)
	@I32 sceHttpDisableRedirect(@I32 id: number) {
		return 0;
	}

	/** Enable cookie */
	@nativeFunction(0x0809C831, 150)
	@I32 sceHttpEnableCookie(@I32 id: number) {
		return 0;
	}

	/** Disable cookie */
	@nativeFunction(0x15540184, 150)
	@I32 sceHttpDisableCookie(@I32 id: number) {
		return 0;
	}

	/** Add extra header */
	@nativeFunction(0x3EABA285, 150)
	@I32 sceHttpAddExtraHeader(@I32 requestId: number, @STRING name: string, @STRING value: string, @I32 mode: number) {
		return 0;
	}

	/** Delete header */
	@nativeFunction(0x70F10B12, 150)
	@I32 sceHttpDeleteHeader(@I32 requestId: number, @STRING name: string) {
		return 0;
	}
}
