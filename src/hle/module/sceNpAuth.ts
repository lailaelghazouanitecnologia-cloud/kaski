import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, U32} from "../utils";

/**
 * PSP PlayStation Network Authentication Module
 * Returns offline/not-signed-in for all authentication requests
 */
export class sceNpAuth {
	constructor(private context: EmulatorContext) { }

	private initialized = false;

	/** Initialize NP Auth library */
	@nativeFunction(0x4EC1F667, 150)
	@I32 sceNpAuthInit(@U32 poolSize: number, @I32 priority: number, @I32 stack: number) {
		this.initialized = true;
		return 0;
	}

	/** Terminate NP Auth library */
	@nativeFunction(0x7AC7C8D5, 150)
	@I32 sceNpAuthTerm() {
		this.initialized = false;
		return 0;
	}

	/** Create ticket request */
	@nativeFunction(0xA1DE86F8, 150)
	@I32 sceNpAuthCreateStartRequest(@PTR paramsPtr: Stream) {
		// Return request ID
		return 1;
	}

	/** Get ticket */
	@nativeFunction(0xD99455DD, 150)
	@I32 sceNpAuthGetTicket(@I32 requestId: number, @PTR ticketPtr: Stream, @U32 ticketSize: number) {
		// Not signed in
		return 0x80550402;
	}

	/** Abort request */
	@nativeFunction(0x3F1C1F70, 150)
	@I32 sceNpAuthAbortRequest(@I32 requestId: number) {
		return 0;
	}

	/** Destroy request */
	@nativeFunction(0xF4531ADC, 150)
	@I32 sceNpAuthDestroyRequest(@I32 requestId: number) {
		return 0;
	}

	/** Get memory stat */
	@nativeFunction(0x72BB0467, 150)
	@I32 sceNpAuthGetMemoryStat(@PTR statPtr: Stream) {
		if (statPtr != Stream.INVALID) {
			statPtr.writeInt32(0); // poolSize
			statPtr.writeInt32(0); // maxPoolSize
			statPtr.writeInt32(0); // freePoolSize
		}
		return 0;
	}
}
