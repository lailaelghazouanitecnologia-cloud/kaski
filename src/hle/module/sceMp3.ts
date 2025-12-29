import {EmulatorContext} from "../../emu/context";
import {Stream} from "../../global/stream";
import {I32, nativeFunction, PTR, U32} from "../utils";

/**
 * PSP MP3 Decoder Module - Based on PPSSPP implementation
 * Stub implementation - returns errors for actual decoding
 */
export class sceMp3 {
	constructor(private context: EmulatorContext) { }

	private handleId = 1;

	/** Initialize MP3 library */
	@nativeFunction(0x07EC321A, 150)
	@I32 sceMp3ReserveMp3Handle(@PTR mp3Args: Stream) {
		return this.handleId++;
	}

	/** Release MP3 handle */
	@nativeFunction(0x0DB149F4, 150)
	@I32 sceMp3ReleaseMp3Handle(@I32 handle: number) {
		return 0;
	}

	/** Initialize MP3 resource */
	@nativeFunction(0x44E07129, 150)
	@I32 sceMp3Init(@I32 handle: number) {
		return 0;
	}

	/** Decode MP3 frame */
	@nativeFunction(0xD021C0FB, 150)
	@I32 sceMp3Decode(@I32 handle: number, @PTR outPtr: Stream) {
		// Return 0 samples decoded (no actual MP3 support)
		return 0;
	}

	/** Check if more data needed */
	@nativeFunction(0xA703FE0F, 150)
	@I32 sceMp3CheckStreamDataNeeded(@I32 handle: number) {
		return 0; // No data needed
	}

	/** Get info */
	@nativeFunction(0xD8F54A51, 150)
	@I32 sceMp3GetInfoToAddStreamData(@I32 handle: number, @PTR dstPtr: Stream, @PTR toWritePtr: Stream, @PTR srcPosPtr: Stream) {
		return 0;
	}

	/** Notify add stream data */
	@nativeFunction(0x0840E808, 150)
	@I32 sceMp3NotifyAddStreamData(@I32 handle: number, @I32 size: number) {
		return 0;
	}

	/** Get sum decoded sample */
	@nativeFunction(0x3548AEC8, 150)
	@I32 sceMp3GetSumDecodedSample(@I32 handle: number) {
		return 0;
	}

	/** Get max output sample */
	@nativeFunction(0x87677E40, 150)
	@I32 sceMp3GetMaxOutputSample(@I32 handle: number) {
		return 1152; // Standard MP3 frame size
	}

	/** Get sampling rate */
	@nativeFunction(0x87C263D1, 150)
	@I32 sceMp3GetSamplingRate(@I32 handle: number) {
		return 44100;
	}

	/** Get channel num */
	@nativeFunction(0x7F696782, 150)
	@I32 sceMp3GetMp3ChannelNum(@I32 handle: number) {
		return 2; // Stereo
	}

	/** Get bit rate */
	@nativeFunction(0x8F450998, 150)
	@I32 sceMp3GetBitRate(@I32 handle: number) {
		return 128; // 128 kbps
	}

	/** Set loop num */
	@nativeFunction(0xD0A56296, 150)
	@I32 sceMp3SetLoopNum(@I32 handle: number, @I32 loopNum: number) {
		return 0;
	}

	/** Get loop num */
	@nativeFunction(0x354D27EA, 150)
	@I32 sceMp3GetLoopNum(@I32 handle: number) {
		return 0;
	}

	/** Reset playback position */
	@nativeFunction(0xF5478233, 150)
	@I32 sceMp3ResetPlayPosition(@I32 handle: number) {
		return 0;
	}
}

