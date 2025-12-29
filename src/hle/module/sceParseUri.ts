import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, STRING, U32} from "../utils";

/**
 * PSP URI Parser Module - Based on PPSSPP implementation
 * Parses URLs into components
 */
export class sceParseUri {
	constructor(private context: EmulatorContext) { }

	/** Build a URL from components */
	@nativeFunction(0x568518C9, 150)
	@I32 sceUriParse(@PTR workAreaPtr: Stream, @STRING url: string, @PTR parsedPtr: Stream, @PTR requiredLenPtr: Stream, @I32 workAreaLen: number) {
		// Just return the work area length needed
		if (requiredLenPtr != Stream.INVALID) {
			requiredLenPtr.writeInt32(url.length + 100);
		}
		return 0;
	}

	/** Build a URL from parsed components */
	@nativeFunction(0x062BB07E, 150)
	@I32 sceUriBuild(@PTR destPtr: Stream, @PTR destLenPtr: Stream, @I32 destSize: number, @PTR parsedPtr: Stream, @I32 flags: number) {
		// Stub - just indicate no URL was built
		if (destLenPtr != Stream.INVALID) {
			destLenPtr.writeInt32(0);
		}
		return 0;
	}

	/** Escape a string for use in URLs */
	@nativeFunction(0x49E950EC, 150)
	@I32 sceUriEscape(@PTR destPtr: Stream, @PTR destLenPtr: Stream, @I32 destSize: number, @STRING src: string) {
		// Just copy the string as-is for now
		if (destPtr != Stream.INVALID && src) {
			destPtr.writeStringz(src);
		}
		if (destLenPtr != Stream.INVALID) {
			destLenPtr.writeInt32(src ? src.length : 0);
		}
		return 0;
	}

	/** Unescape a URL-encoded string */
	@nativeFunction(0x7EE318AF, 150)
	@I32 sceUriUnescape(@PTR destPtr: Stream, @PTR destLenPtr: Stream, @I32 destSize: number, @STRING src: string) {
		// Just copy the string as-is for now
		if (destPtr != Stream.INVALID && src) {
			destPtr.writeStringz(src);
		}
		if (destLenPtr != Stream.INVALID) {
			destLenPtr.writeInt32(src ? src.length : 0);
		}
		return 0;
	}
}
