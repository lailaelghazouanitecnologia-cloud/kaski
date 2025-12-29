import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, U32} from "../utils";

/**
 * PSP SSL Module - Based on PPSSPP implementation
 * Most games just need init/term to succeed
 */
export class sceSsl {
	constructor(private context: EmulatorContext) { }

	private initialized = false;

	/** Initialize the SSL library */
	@nativeFunction(0x957ECBE2, 150)
	@I32 sceSslInit(@U32 poolSize: number) {
		this.initialized = true;
		return 0;
	}

	/** Terminate the SSL library */
	@nativeFunction(0x191CDEFF, 150)
	@I32 sceSslEnd() {
		this.initialized = false;
		return 0;
	}

	/** Get used memory size */
	@nativeFunction(0x5BFB6B61, 150)
	@I32 sceSslGetUsedMemoryMax(@PTR sizePtr: Stream) {
		if (sizePtr != Stream.INVALID) {
			sizePtr.writeInt32(0);
		}
		return 0;
	}

	/** Get current memory usage */
	@nativeFunction(0x0EB43B06, 150)
	@I32 sceSslGetUsedMemoryCurrent(@PTR sizePtr: Stream) {
		if (sizePtr != Stream.INVALID) {
			sizePtr.writeInt32(0);
		}
		return 0;
	}
}
