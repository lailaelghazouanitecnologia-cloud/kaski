import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR} from "../utils";

/**
 * PSP PlayStation Network Module - Based on PPSSPP implementation
 * Returns offline status for all network features
 */
export class sceNp {
	constructor(private context: EmulatorContext) { }

	private initialized = false;

	/** Initialize NP library */
	@nativeFunction(0x857B47D3, 150)
	@I32 sceNpInit() {
		this.initialized = true;
		return 0;
	}

	/** Terminate NP library */
	@nativeFunction(0x37E1E274, 150)
	@I32 sceNpTerm() {
		this.initialized = false;
		return 0;
	}

	/** Get NP status - always offline */
	@nativeFunction(0xAD218C35, 150)
	@I32 sceNpGetOnlineId(@PTR onlineIdPtr: Stream) {
		// Not signed in
		return 0x80550402; // SCE_NP_ERROR_NOT_SIGNED_IN
	}

	/** Get user profile */
	@nativeFunction(0x6E0F2D55, 150)
	@I32 sceNpGetUserProfile(@PTR profilePtr: Stream) {
		return 0x80550402; // SCE_NP_ERROR_NOT_SIGNED_IN
	}

	/** Get content rating flag */
	@nativeFunction(0xA0BE3C4B, 150)
	@I32 sceNpGetContentRatingFlag(@PTR ratingPtr: Stream, @PTR resultPtr: Stream) {
		if (ratingPtr != Stream.INVALID) {
			ratingPtr.writeInt32(0); // No restrictions
		}
		return 0;
	}

	/** Get my language */
	@nativeFunction(0x95C90E3E, 150)
	@I32 sceNpGetMyLanguages(@PTR languagesPtr: Stream) {
		if (languagesPtr != Stream.INVALID) {
			languagesPtr.writeInt32(1); // English
		}
		return 0;
	}
}
