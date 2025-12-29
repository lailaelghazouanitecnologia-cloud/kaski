import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, U32} from "../utils";

/**
 * PSP Virtual Audio Module - Used for voice chat and special audio
 * Stub implementation
 */
export class sceVaudio {
	constructor(private context: EmulatorContext) { }

	private channelReserved = false;

	/** Reserve a channel for vaudio output */
	@nativeFunction(0x8986295E, 150)
	@I32 sceVaudioOutputBlocking(@I32 vol: number, @PTR buf: Stream) {
		// Just return success, audio is not actually played
		return 0;
	}

	/** Reserve a vaudio channel */
	@nativeFunction(0x03B6807D, 150)
	@I32 sceVaudioChReserve(@I32 sampleCount: number, @I32 freq: number, @I32 format: number) {
		this.channelReserved = true;
		return 0;
	}

	/** Release a vaudio channel */
	@nativeFunction(0x67585DFD, 150)
	@I32 sceVaudioChRelease() {
		this.channelReserved = false;
		return 0;
	}

	/** Set effect type */
	@nativeFunction(0x346FBE94, 150)
	@I32 sceVaudioSetEffectType(@I32 type: number, @I32 vol: number) {
		return 0;
	}

	/** Set ALCS mode */
	@nativeFunction(0xCBD4AC51, 150)
	@I32 sceVaudioSetAlcMode(@I32 mode: number) {
		return 0;
	}
}
