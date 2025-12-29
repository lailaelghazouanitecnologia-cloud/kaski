import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, STRING, U32} from "../utils";

/**
 * PSP Network Access Point Control Module
 * Handles WiFi connection management - stub returns disconnected
 */
export class sceNetApctl {
	constructor(private context: EmulatorContext) { }

	private state = ApctlState.Disconnected;
	private handlerId = 1;

	/** Initialize the Access Point Control library */
	@nativeFunction(0xE2F91F9B, 150)
	@I32 sceNetApctlInit(@I32 stackSize: number, @I32 priority: number) {
		return 0;
	}

	/** Terminate the Access Point Control library */
	@nativeFunction(0xB3EDD0EC, 150)
	@I32 sceNetApctlTerm() {
		return 0;
	}

	/** Get the current connection state */
	@nativeFunction(0x5DEAC81B, 150)
	@I32 sceNetApctlGetState(@PTR statePtr: Stream) {
		if (statePtr != Stream.INVALID) {
			statePtr.writeInt32(this.state);
		}
		return 0;
	}

	/** Connect to an access point */
	@nativeFunction(0xCFB957C6, 150)
	@I32 sceNetApctlConnect(@I32 configIndex: number) {
		// Simulate connection failure - no actual WiFi
		return 0x80410A0B; // SCE_NET_APCTL_ERROR_CONNECT
	}

	/** Disconnect from current access point */
	@nativeFunction(0x24FE91A1, 150)
	@I32 sceNetApctlDisconnect() {
		this.state = ApctlState.Disconnected;
		return 0;
	}

	/** Get connection info */
	@nativeFunction(0x2BEFDF23, 150)
	@I32 sceNetApctlGetInfo(@I32 code: number, @PTR infoPtr: Stream) {
		// Return empty/default info
		return 0;
	}

	/** Add event handler */
	@nativeFunction(0x8ABADD51, 150)
	@I32 sceNetApctlAddHandler(@U32 handler: number, @U32 arg: number) {
		return this.handlerId++;
	}

	/** Delete event handler */
	@nativeFunction(0x5963991B, 150)
	@I32 sceNetApctlDelHandler(@I32 handlerId: number) {
		return 0;
	}

	/** Scan for access points */
	@nativeFunction(0xF25A5006, 150)
	@I32 sceNetApctlScan() {
		return 0;
	}

	/** Get scan info */
	@nativeFunction(0x2935C45B, 150)
	@I32 sceNetApctlGetBSSDescIDList(@PTR sizePtr: Stream, @PTR listPtr: Stream) {
		if (sizePtr != Stream.INVALID) {
			sizePtr.writeInt32(0); // No APs found
		}
		return 0;
	}
}

enum ApctlState {
	Disconnected = 0,
	Scanning = 1,
	Joining = 2,
	GettingIp = 3,
	GotIp = 4,
}
