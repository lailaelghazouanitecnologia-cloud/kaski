import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR} from "../utils";

/**
 * PSP Open PSID Module
 * Returns a fake PSID (PlayStation ID) for compatibility
 */
export class sceOpenPSID {
	constructor(private context: EmulatorContext) { }

	// Fake PSID - 16 bytes unique identifier
	private psid = new Uint8Array([
		0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
		0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F, 0x10
	]);

	/** Get the OpenPSID */
	@nativeFunction(0xC69BEBCE, 150)
	@I32 sceOpenPSIDGetOpenPSID(@PTR psidPtr: Stream) {
		if (psidPtr != Stream.INVALID) {
			psidPtr.writeBytes(this.psid);
		}
		return 0;
	}
}
