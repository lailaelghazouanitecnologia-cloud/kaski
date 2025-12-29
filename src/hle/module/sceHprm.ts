import {Stream} from "../../global/stream";
import {EmulatorContext} from "../../emu/context";
import {I32, nativeFunction, PTR, U32} from "../utils";

/**
 * PSP Headphone Remote Module
 * Handles headphone remote control buttons
 */
export class sceHprm {
	constructor(private context: EmulatorContext) { }

	/** Check current key state (non-blocking) */
	@nativeFunction(0x1910B327, 150)
    @U32 sceHprmPeekCurrentKey(@PTR keyPtr: Stream) {
		if (keyPtr != Stream.INVALID) {
			keyPtr.writeInt32(0); // No key pressed
		}
		return 0;
	}

	/** Read current key (blocking) */
	@nativeFunction(0x2BCEC83E, 150)
	@U32 sceHprmReadLatch(@PTR latchPtr: Stream) {
		if (latchPtr != Stream.INVALID) {
			latchPtr.writeInt32(0); // uiMake
			latchPtr.writeInt32(0); // uiBreak
			latchPtr.writeInt32(0); // uiPress
			latchPtr.writeInt32(0); // uiRelease
		}
		return 0;
	}

	/** Check if headphones are connected */
	@nativeFunction(0x208DB1BD, 150)
	@I32 sceHprmIsHeadphoneExist() {
		return 0; // No headphones
	}

	/** Check if remote is connected */
	@nativeFunction(0x7E69EDA4, 150)
	@I32 sceHprmIsRemoteExist() {
		return 0; // No remote
	}

	/** Check if microphone is connected */
	@nativeFunction(0x219C58F1, 150)
	@I32 sceHprmIsMicrophoneExist() {
		return 0; // No microphone
	}

	/** Register callback */
	@nativeFunction(0xC7154136, 150)
	@I32 sceHprmRegisterCallback(@I32 cbId: number) {
		return 0;
	}

	/** Unregister callback */
	@nativeFunction(0x444ED0B7, 150)
	@I32 sceHprmUnregisterCallback(@I32 cbId: number) {
		return 0;
	}
}
