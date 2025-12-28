import {SimpleRelooper} from "./simplerelooper";

interface IBlock {
}

interface IRelooper {
	addBlock(code:string):IBlock;
	addBranch(from:IBlock, to:IBlock, cond?:string, onjumpcode?:string):void;
}

export function relooperProcess(callback: (r:IRelooper) => void):string {
    const sr = new SimpleRelooper();
    sr.init();
	try {
		callback(sr);
		return sr.render(sr.blocks[0]);
	} finally {
		sr.cleanup();
	}
}
