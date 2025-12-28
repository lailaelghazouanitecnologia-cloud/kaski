import {Cancelable, PromiseFast, Signal0, UidCollection} from "../../global/utils";
import {Stream} from "../../global/stream";
import {
    Int8, Struct,
    StructInt16,
    StructInt32,
    StructStructArray,
    StructUInt32
} from "../../global/struct";
import {xrange} from "../../global/math";
import {EmulatorContext} from "../../emu/context";
import {MemoryPartition} from "../manager/memory";
import {BYTES, FBYTES, I32, nativeFunction, PTR, U32} from "../utils";
import {NetPacket} from "../manager/net";

export class sceNetAdhoc {
	constructor(private context: EmulatorContext) {
	}

	// @ts-ignore
    private partition: MemoryPartition;

	/** Initialise the adhoc library. */
	@nativeFunction(0xE1D621D7, 150)
	@I32 sceNetAdhocInit() {
		this.partition = this.context.memoryManager.kernelPartition.allocateLow(0x4000);
		return 0;
	}

	/** Terminate the adhoc library */
	@nativeFunction(0xA62C6F57, 150)
    @I32 sceNetAdhocTerm() {
		this.partition.deallocate();
		return 0;
	}

	/** Poll sockets for events */
	@nativeFunction(0x7A662D6B, 150)
    @I32 sceNetAdhocPollSocket(@I32 socketAddress: number, @I32 count: number, @I32 timeout: number, @I32 nonblock: number) {
		// Stub implementation - returns 0 (no events)
		// A full implementation would check socket states and return event count
		return 0;
	}

	private pdps = new UidCollection<Pdp>(1);

	/** Create a PDP object. */
	@nativeFunction(0x6F92741B, 150)
    @I32 sceNetAdhocPdpCreate(@FBYTES(6) mac: Uint8Array, @I32 port: number, @U32 bufsize: number, @I32 unk1: number) {
        const pdp = new Pdp(this.context, mac, port, bufsize);
		pdp.id = this.pdps.allocate(pdp);
		return pdp.id;
	}

	/** Delete a PDP object. */
	@nativeFunction(0x7F27BB5E, 150)
    @I32 sceNetAdhocPdpDelete(@I32 pdpId: number, @I32 unk1: number) {
        const pdp = this.pdps.get(pdpId);
		pdp.dispose();
		this.pdps.remove(pdpId);
		return 0;
	}

	/** Send a PDP packet to a destination. */
	@nativeFunction(0xABED3790, 150)
    @I32 sceNetAdhocPdpSend(@I32 pdpId: number, @FBYTES(6) destMac: Uint8Array, @I32 port: number, @FBYTES(6) dataStream: Stream, @I32 timeout: number, @I32 nonblock: number) {
        const pdp = this.pdps.get(pdpId);
        const data = dataStream.readBytes(dataStream.length);
		pdp.send(port, destMac, data);

		return 0;
	}

	/** Receive a PDP packet */
	@nativeFunction(0xDFE53E03, 150)
    @I32 async sceNetAdhocPdpRecv(@I32 pdpId: number, @FBYTES(6) srcMac: Uint8Array, @PTR portPtr: Stream, @PTR data: Stream, @PTR dataLengthPtr: Stream, @I32 timeout: number, @I32 nonblock: number) {
        const block = !nonblock;
        const pdp = this.pdps.get(pdpId);
		const recvOne = (chunk: NetPacket) => {
			srcMac.set(chunk.mac);
			data.writeBytes(chunk.payload);
			portPtr.writeInt16(pdp.port);
			dataLengthPtr.writeInt32(chunk.payload.length);
			return 0;
		};

		// block
		if (block) {
            const data = await pdp.recvOneAsync()
			return recvOne(data)
		} else {
			if (pdp.chunks.length <= 0) return 0x80410709; // ERROR_NET_ADHOC_NO_DATA_AVAILABLE
			return recvOne(pdp.chunks.shift()!);
		}
	}

	/** Get the status of all PDP objects */
	@nativeFunction(0xC7C1FC57, 150)
    @I32 sceNetAdhocGetPdpStat(@PTR sizeStream: Stream, @PTR pdpStatStruct: Stream) {
        const maxSize = sizeStream.sliceWithLength(0).readInt32();
        const pdps = this.pdps.list();
        const totalSize = pdps.length * PdpStatStruct.struct.length;
        sizeStream.sliceWithLength(0).writeInt32(totalSize);
		//const outStream = this.context.memory.getPointerStream(this.partition.low, this.partition.size);
        const pos = 0;
        pdps.forEach(pdp => {
            const stat = new PdpStatStruct();
            stat.nextPointer = 0;
			stat.pdpId = pdp.id;
			stat.port = pdp.port;
			stat.mac = xrange(0, 6).map(index => pdp.mac[index]);
			stat.rcvdData = pdp.getDataLength();
			//console.log("sceNetAdhocGetPdpStat:", stat);
			PdpStatStruct.struct.write(pdpStatStruct, stat);
		});
		return 0;
	}

	// GameMode stubs - returns 1 as dummy ID/success
	private gameModeId = 1;

	/** Create own game object type data. */
	@nativeFunction(0x7F75C338, 150)
    @I32 sceNetAdhocGameModeCreateMaster(@BYTES data: Stream) {
		// Stub: return dummy ID
		return this.gameModeId++;
	}

	/** Create peer game object type data. */
	@nativeFunction(0x3278AB0C, 150)
    @I32 sceNetAdhocGameModeCreateReplica(@FBYTES(6) mac: Uint8Array, @BYTES data: Stream) {
		// Stub: return dummy ID
		return this.gameModeId++;
	}

	/** Update own game object type data. */
	@nativeFunction(0x98C204C8, 150)
    @I32 sceNetAdhocGameModeUpdateMaster() {
		// Stub: success
		return 0;
	}

	/** Update peer game object type data. */
	@nativeFunction(0xFA324B4E, 150)
    @I32 sceNetAdhocGameModeUpdateReplica(@I32 id: number, @I32 unk1: number) {
		// Stub: success
		return 0;
	}

	/** Delete own game object type data. */
	@nativeFunction(0xA0229362, 150)
    @I32 sceNetAdhocGameModeDeleteMaster() {
		// Stub: success
		return 0;
	}

	/** Delete peer game object type data. */
	@nativeFunction(0x0B2228E9, 150)
    @I32 sceNetAdhocGameModeDeleteReplica(@I32 id: number) {
		// Stub: success
		return 0;
	}

	// PTP (Peer To Peer) stubs
	private ptpId = 1;

	/** Open a PTP (Peer To Peer) connection */
	@nativeFunction(0x877F6D66, 150)
    @I32 sceNetAdhocPtpOpen(@FBYTES(6) srcmac: Uint8Array, @I32 srcport: number, @PTR destmac: Stream, @I32 destport: number, @I32 bufsize: number, @I32 delay: number, @I32 count: number, @I32 unk1: number) {
		// Stub: return dummy PTP ID
		return this.ptpId++;
	}

	/** Wait for an incoming PTP connection */
	@nativeFunction(0xE08BDAC1, 150)
    @I32 sceNetAdhocPtpListen(@FBYTES(6) srcmac: Uint8Array, @I32 srcport: number, @I32 bufsize: number, @I32 delay: number, @I32 count: number, @I32 queue: number, @I32 unk1: number) {
		// Stub: return dummy PTP ID
		return this.ptpId++;
	}

	/** Wait for connection created by sceNetAdhocPtpOpen */
	@nativeFunction(0xFC6FC07B, 150)
    @I32 sceNetAdhocPtpConnect(@I32 id: number, @I32 timeout: number, @I32 nonblock: number) {
		// Stub: success (connection established)
		return 0;
	}

	/** Accept an incoming PTP connection */
	@nativeFunction(0x9DF81198, 150)
    @I32 sceNetAdhocPtpAccept(@I32 id: number, @PTR mac: Stream, @PTR portPtr: Stream, @I32 timeout: number, @I32 nonblock: number) {
		// Stub: return new connection ID
		return this.ptpId++;
	}

	/** Send data */
	@nativeFunction(0x4DA4C788, 150)
    @I32 sceNetAdhocPtpSend(@I32 id: number, @PTR data: Stream, @PTR datasize: Stream, @I32 timeout: number, @I32 nonblock: number) {
		// Stub: pretend all data was sent
		return 0;
	}

	/** Receive data */
	@nativeFunction(0x8BEA2B3E, 150)
    @I32 sceNetAdhocPtpRecv(@I32 id: number, @PTR data: Stream, @PTR datasize: Stream, @I32 timeout: number, @I32 nonblock: number) {
		// Stub: no data available (would block or return immediately)
		if (nonblock) {
			return 0x80410709; // ERROR_NET_ADHOC_NO_DATA_AVAILABLE
		}
		// For blocking, just return 0 (no data)
		datasize.writeInt32(0);
		return 0;
	}

	/** Wait for data in the buffer to be sent */
	@nativeFunction(0x9AC2EEAC, 150)
    @I32 sceNetAdhocPtpFlush(@I32 id: number, @I32 timeout: number, @I32 nonblock: number) {
		// Stub: all data flushed
		return 0;
	}

	/** Close a socket */
	@nativeFunction(0x157E6225, 150)
    @I32 sceNetAdhocPtpClose(@I32 id: number, @I32 unk1: number) {
		// Stub: success
		return 0;
	}

	/** Get the status of all PTP objects */
	@nativeFunction(0xB9685118, 150)
    @I32 sceNetAdhocGetPtpStat(@PTR sizePtr: Stream, @PTR stat: Stream) {
		// Stub: no PTP connections, write 0 size
		sizePtr.writeInt32(0);
		return 0;
	}
}



class PdpRecv {
	port = 0;
	mac = new Uint8Array(6);
	data = new Uint8Array(0);
}

export class Pdp {
	id: number = 0
	onMessageCancel: Cancelable | null;
	chunks = <NetPacket[]>[];
	onChunkRecv = new Signal0();

	constructor(private context: EmulatorContext, public mac: Uint8Array, public port: number, public bufsize: number) {
		this.onMessageCancel = this.context.netManager.onmessage(port).add(packet => {
			this.chunks.push(packet);
			this.onChunkRecv.dispatch();
		})
	}

	recvOneAsync() {
		return new PromiseFast<NetPacket>((resolve, reject) => {
			this.onChunkRecv.once(() => {
				resolve(this.chunks.shift());
			});
		});
	}

	send(port: number, destMac: Uint8Array, data: Uint8Array) {
		this.context.netManager.send(port, 'sceNetAdhocPdpSend', destMac, data);
	}

	getDataLength() {
		return this.chunks.sum(chunk => chunk.payload.length);
	}

	dispose() {
		if (this.onMessageCancel) {
			this.onMessageCancel.cancel();
			this.onMessageCancel = null;
		}
	}
}

class PdpStatStruct extends Struct {
	@StructUInt32 nextPointer = 0
    @StructInt32 pdpId = 0
	@StructStructArray(Int8, 6) mac = [0, 0, 0, 0, 0, 0]
	@StructInt16 port = 0
    @StructUInt32 rcvdData = 0
}
