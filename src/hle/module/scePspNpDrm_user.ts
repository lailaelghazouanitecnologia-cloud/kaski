import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, STRING} from "../utils";

/**
 * PSP NP DRM Module - Based on PPSSPP implementation
 * Handles DRM checks - returns success to allow games to run
 */
export class scePspNpDrm_user {
	constructor(private context: EmulatorContext) { }

	/** Check validity of a DRM protected file */
	@nativeFunction(0xA1336091, 150)
	@I32 sceNpDrmSetLicenseeKey(@PTR keyPtr: Stream) {
		// Accept any key
		return 0;
	}

	/** Clear licensee key */
	@nativeFunction(0x9B745542, 150)
	@I32 sceNpDrmClearLicenseeKey() {
		return 0;
	}

	/** Open protected content */
	@nativeFunction(0x275987D1, 150)
	@I32 sceNpDrmRenameCheck(@STRING fileName: string) {
		// File is valid
		return 0;
	}

	/** Verify EDAT header */
	@nativeFunction(0x08D98894, 150)
	@I32 sceNpDrmEdataSetupKey(@I32 edataFd: number) {
		// Success - allow file to be read
		return 0;
	}

	/** Get EDAT header info */
	@nativeFunction(0x219EF5CC, 150)
	@I32 sceNpDrmEdataGetDataSize(@I32 edataFd: number) {
		// Return -1 to indicate unknown size (fallback to normal file size)
		return -1;
	}

	/** Open protected PGD */
	@nativeFunction(0x2BAA4294, 150)
	@I32 sceNpDrmOpen(@STRING fileName: string, @I32 flags: number, @I32 mode: number) {
		// Let the normal file system handle it
		return -1; // Fall back to regular open
	}
}
