import {UidCollection} from "../../global/utils";
import {Stream} from "../../global/stream";
import {EmulatorContext} from "../../emu/context";
import {F32, I32, nativeFunction, PTR, U32} from "../utils";

export class sceLibFont {
	constructor(private context: EmulatorContext) { }

	private fontLibUid = new UidCollection<FontLib>(1);
	private fontUid = new UidCollection<Font>(1);

	@nativeFunction(0x67F17ED7, 150)
    @U32 sceFontNewLib(@PTR paramsPtr: Stream, @PTR errorCodePtr: Stream) {
        const fontLib = new FontLib();
        return this.fontLibUid.allocate(fontLib);
	}

	@nativeFunction(0x099EF33C, 150)
    @U32 sceFontFindOptimumFont(@U32 fontLibId: number, @PTR fontStylePointer: Stream, @PTR errorCodePointer: Stream) {
        const fontLib = this.fontLibUid.get(fontLibId);
        return 0;
	}

	@nativeFunction(0xA834319D, 150)
    @U32 sceFontOpen(@I32 fontLibId: number, @I32 index: number, @I32 mode:number, @PTR errorCodePointer:Stream) {
        const fontLib = this.fontLibUid.get(fontLibId);
        return this.fontUid.allocate(new Font());
	}

	@nativeFunction(0x0DA7535E, 150)
	@U32 sceFontGetFontInfo(@I32 fontId: number, @PTR fontInfoPointer: Stream) {
        const font = this.fontUid.get(fontId);
        return 0;
	}

	@nativeFunction(0x48293280, 150)
	@U32 sceFontSetResolution(@I32 fontLibId: number, @F32 horizontalResolution: number, @F32 verticalResolution: number) {
		return 0;
	}
}

class FontLib {
}

class Font {
}