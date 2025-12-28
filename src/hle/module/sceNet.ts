import {mac2string, string2mac} from "../../global/utils";
import {Stream} from "../../global/stream";
import {xrange} from "../../global/math";
import {EmulatorContext} from "../../emu/context";
import {FBYTES, I32, nativeFunction, PTR, STRING, U32} from "../utils";
import {Struct, StructInt32} from "../../global/struct";

/** Network memory allocation statistics */
class SceNetMallocStat extends Struct {
	@StructInt32 pool: number = 0x20000      // Total pool size (128KB default)
	@StructInt32 maximum: number = 0          // Maximum memory used
	@StructInt32 free: number = 0x20000       // Free memory available
}

export class sceNet {
	constructor(private context: EmulatorContext) { }

	// Network memory stats (initialized with defaults like PPSSPP)
	private mallocStat = new SceNetMallocStat();

	@nativeFunction(0x39AF39A6, 150)
	@I32 sceNetInit(
        @I32 memoryPoolSize: number,
        @I32 calloutprio: number,
        @I32 calloutstack: number,
        @I32 netintrprio: number,
        @I32 netintrstack: number
    ) {
		this.context.container['mac'] = new Uint8Array(xrange(0, 6).map(index => Math.random() * 255));

		// Initialize malloc stats based on pool size
		this.mallocStat.pool = memoryPoolSize > 0 ? memoryPoolSize : 0x20000;
		this.mallocStat.maximum = 0;
		this.mallocStat.free = this.mallocStat.pool;

		return 0;
	}

	@nativeFunction(0x281928A9, 150)
	@I32 sceNetTerm() {
		return 0;
	}

	/**
	 * Free thread info after thread deletion
	 * Based on PPSSPP: Returns 0 (stub implementation)
	 */
	@nativeFunction(0x50647530, 150)
	@I32 sceNetFreeThreadinfo(@I32 threadId: number) {
		// PPSSPP returns 0 for this stub
		return 0;
	}

	/**
	 * Abort a network thread operation
	 * Based on PPSSPP: Returns 0 (stub implementation)
	 */
	@nativeFunction(0xAD6844c6, 150)
	@I32 sceNetThreadAbort(@I32 threadId: number) {
		// PPSSPP returns 0 for this stub
		return 0;
	}

	/** Convert string to a Mac address **/
	@nativeFunction(0xD27961C9, 150)
	@I32 sceNetEtherStrton(@STRING string: string, @FBYTES(6) mac: Uint8Array) {
		mac.set(string2mac(string));
		return 0;
	}

	/** Convert Mac address to a string **/
	@nativeFunction(0x89360950, 150)
	@I32 sceNetEtherNtostr(@FBYTES(6) mac: Uint8Array, @PTR outputAddress: Stream) {
		outputAddress.writeStringz(mac2string(mac));
		return 0;
	}

	/** Retrieve the local Mac address **/
	@nativeFunction(0x0BF0A3AE, 150)
	@I32 sceNetGetLocalEtherAddr(@FBYTES(6) macOut: Uint8Array) {
		console.info("sceNetGetLocalEtherAddr: ", mac2string(this.context.netManager.mac));
		macOut.set(this.context.netManager.mac);
		return 0;
	}

	/**
	 * Get network memory allocation statistics
	 * Based on PPSSPP implementation
	 */
	@nativeFunction(0xCC393E48, 150)
	@I32 sceNetGetMallocStat(@PTR statPtr: Stream) {
		if (statPtr == Stream.INVALID) {
			return -1; // Invalid address
		}

		// Write the malloc stat structure
		statPtr.writeInt32(this.mallocStat.pool);
		statPtr.writeInt32(this.mallocStat.maximum);
		statPtr.writeInt32(this.mallocStat.free);

		return 0;
	}
}
