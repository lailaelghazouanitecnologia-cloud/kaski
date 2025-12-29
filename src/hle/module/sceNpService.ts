import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, U32} from "../utils";

/**
 * PSP PlayStation Network Service Module
 * Stub implementation - returns success for init/term
 */
export class sceNpService {
	constructor(private context: EmulatorContext) { }

	private initialized = false;

	/** Initialize NP Service library */
	@nativeFunction(0x0F8F5821, 150)
	@I32 sceNpServiceInit(@U32 poolSize: number, @I32 priority: number, @I32 stack: number) {
		this.initialized = true;
		return 0;
	}

	/** Terminate NP Service library */
	@nativeFunction(0x00ACFAC3, 150)
	@I32 sceNpServiceTerm() {
		this.initialized = false;
		return 0;
	}

	/** Get memory stat */
	@nativeFunction(0x5494274B, 150)
	@I32 sceNpServiceGetMemoryStat(@PTR statPtr: Stream) {
		if (statPtr != Stream.INVALID) {
			statPtr.writeInt32(0); // poolSize
			statPtr.writeInt32(0); // maxPoolSize
			statPtr.writeInt32(0); // freePoolSize
		}
		return 0;
	}
}
