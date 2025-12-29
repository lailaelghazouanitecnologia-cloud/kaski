import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {BOOL, I32, nativeFunction, PTR} from "../utils";

/**
 * PSP WLAN Driver Module
 * Controls WiFi hardware - returns enabled but disconnected
 */
export class sceWlanDrv {
	constructor(private context: EmulatorContext) { }

	/** Get WLAN switch state (hardware switch) */
	@nativeFunction(0xD7763699, 150)
	@BOOL sceWlanGetSwitchState() {
		return true; // WLAN switch is ON
	}

	/** Get WLAN driver state */
	@nativeFunction(0x93440B11, 150)
	@I32 sceWlanDevIsPowerOn() {
		return 1; // Power is ON
	}

	/** Get ethernet address (MAC) */
	@nativeFunction(0x0C622081, 150)
	@I32 sceWlanGetEtherAddr(@PTR etherAddr: Stream) {
		if (etherAddr != Stream.INVALID) {
			// Return fake MAC address
			etherAddr.writeBytes(this.context.netManager.mac);
		}
		return 0;
	}

	/** Attach to WLAN driver */
	@nativeFunction(0x482CAE9A, 150)
	@I32 sceWlanDevAttach() {
		return 0;
	}

	/** Detach from WLAN driver */
	@nativeFunction(0xC9A8CAB7, 150)
	@I32 sceWlanDevDetach() {
		return 0;
	}
}
