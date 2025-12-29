import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, STRING, U32} from "../utils";

/**
 * PSP DNS Resolver Module - Based on PPSSPP implementation
 */
export class sceNetResolver {
	constructor(private context: EmulatorContext) { }

	private resolverId = 1;

	/** Initialize the resolver library */
	@nativeFunction(0xF3370E61, 150)
	@I32 sceNetResolverInit() {
		return 0;
	}

	/** Terminate the resolver library */
	@nativeFunction(0x6138194A, 150)
	@I32 sceNetResolverTerm() {
		return 0;
	}

	/** Create a resolver */
	@nativeFunction(0x244172AF, 150)
	@I32 sceNetResolverCreate(@PTR ridPtr: Stream, @PTR buf: Stream, @I32 bufLen: number) {
		ridPtr.writeInt32(this.resolverId++);
		return 0;
	}

	/** Delete a resolver */
	@nativeFunction(0x94523E09, 150)
	@I32 sceNetResolverDelete(@I32 rid: number) {
		return 0;
	}

	/** Start name resolution - stub returns error */
	@nativeFunction(0x224C5F44, 150)
	@I32 sceNetResolverStartNtoA(@I32 rid: number, @STRING hostname: string, @PTR addrPtr: Stream, @U32 timeout: number, @I32 retry: number) {
		// Return fake IP address (127.0.0.1 = 0x7F000001)
		addrPtr.writeInt32(0x7F000001);
		return 0;
	}

	/** Start address to name resolution - stub */
	@nativeFunction(0x629E2FB7, 150)
	@I32 sceNetResolverStartAtoN(@I32 rid: number, @PTR addr: Stream, @PTR hostnamePtr: Stream, @U32 hostnameLen: number, @U32 timeout: number, @I32 retry: number) {
		hostnamePtr.writeStringz("localhost");
		return 0;
	}

	/** Stop resolver */
	@nativeFunction(0x808F6063, 150)
	@I32 sceNetResolverStop(@I32 rid: number) {
		return 0;
	}
}
