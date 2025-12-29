import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, STRING, U32} from "../utils";

/**
 * PSP HTTP Parser Module - Based on PPSSPP implementation
 * Parses HTTP headers and responses
 */
export class sceParseHttp {
	constructor(private context: EmulatorContext) { }

	/** Initialize HTTP parser */
	@nativeFunction(0x8077A433, 150)
	@I32 sceParseHttpStatusLine(@STRING line: string, @PTR majorVerPtr: Stream, @PTR minorVerPtr: Stream, @PTR statusCodePtr: Stream, @PTR reasonPhrasePtr: Stream, @PTR reasonPhraseLenPtr: Stream) {
		// Parse "HTTP/1.1 200 OK" format
		// For now just return success with default values
		if (majorVerPtr != Stream.INVALID) majorVerPtr.writeInt32(1);
		if (minorVerPtr != Stream.INVALID) minorVerPtr.writeInt32(1);
		if (statusCodePtr != Stream.INVALID) statusCodePtr.writeInt32(200);
		return 0;
	}

	/** Parse HTTP response header */
	@nativeFunction(0xAD7BFDEF, 150)
	@I32 sceParseHttpResponseHeader(@PTR headerPtr: Stream, @U32 headerLen: number, @STRING fieldName: string, @PTR valuePtr: Stream, @PTR valueLenPtr: Stream) {
		// Return not found for now
		return -1;
	}
}
