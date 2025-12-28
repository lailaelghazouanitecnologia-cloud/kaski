/**
 * PSP GPU - Graphics Processing Unit
 *
 * Main GPU implementation with display list processing.
 * Executes GE commands and batches primitives for rendering.
 */

import { Memory } from '../memory/Memory';
import { GpuOpCodes as Op } from './GpuOpCodes';
import { GpuState, DisplayListStatus, PrimitiveType, IndexEnum } from './GpuState';
import { VertexInfo } from './VertexInfo';
import { OptimizedDrawBuffer, OptimizedBatch, BatchTransferBuilder } from './VertexBuffer';
import { WebGpuDriver } from './WebGpuDriver';

// ============================================
// Types
// ============================================

export interface GpuCallback
{
  signalFunction: number;
  signalArgument: number;
  finishFunction: number;
  finishArgument: number;
}

export interface GpuStats
{
  totalCommands: number;
  totalStalls: number;
  primCount: number;
  batchCount: number;
  vertexCount: number;
  indexCount: number;
  nonIndexCount: number;
  trianglePrimCount: number;
  triangleStripPrimCount: number;
  spritePrimCount: number;
  otherPrimCount: number;
  timePerFrame: number;
  hashMemoryCount: number;
  hashMemorySize: number;
}

// ============================================
// Helper functions
// ============================================

function param3(p: number, offset: number): number { return (p >>> offset) & 0x7; }
function param8(p: number, offset: number): number { return (p >>> offset) & 0xFF; }
function param16(p: number, offset: number): number { return (p >>> offset) & 0xFFFF; }
function param24(p: number): number { return p & 0xFFFFFF; }

function float1(p: number): number
{
  const buffer = new ArrayBuffer(4);
  const intView = new Int32Array(buffer);
  const floatView = new Float32Array(buffer);
  intView[0] = p << 8;
  return floatView[0];
}

// ============================================
// Draw Type
// ============================================

const enum PrimDrawType
{
  SINGLE_DRAW = 0,
  BATCH_DRAW = 1,
  BATCH_DRAW_DEGENERATE = 2,
}

const DRAW_TYPE_CONV = [
  PrimDrawType.BATCH_DRAW,            // Points = 0
  PrimDrawType.BATCH_DRAW,            // Lines = 1
  PrimDrawType.BATCH_DRAW_DEGENERATE, // LineStrip = 2
  PrimDrawType.BATCH_DRAW,            // Triangles = 3
  PrimDrawType.BATCH_DRAW_DEGENERATE, // TriangleStrip = 4
  PrimDrawType.SINGLE_DRAW,           // TriangleFan = 5
  PrimDrawType.BATCH_DRAW,            // Sprites = 6
];

const enum PrimAction
{
  NOTHING = 0,
  FLUSH_PRIM = 1,
}

// ============================================
// Display List
// ============================================

class GpuDisplayList
{
  current4: number = 0;
  stall4: number = 0;
  callbackId: number = 0;
  completed: boolean = false;
  status: DisplayListStatus = DisplayListStatus.Paused;
  errorCount: number = 0;

  private callstack = new Int32Array(1024);
  private callstackIndex = 0;

  private primBatchPrimitiveType: number = -1;
  private batchPrimCount = 0;
  private vertexInfo = new VertexInfo();

  private promiseResolve: ((value: number) => void) | null = null;
  private promiseReject: ((reason: Error) => void) | null = null;
  private promise: Promise<number> | null = null;

  constructor(
    public id: number,
    private memory: Memory,
    private runner: GpuDisplayListRunner,
    private gpu: Gpu,
    private state: GpuState,
    private drawBuffer: OptimizedDrawBuffer,
    private stats: GpuStats
  ) {}

  start(): void
  {
    this.status = DisplayListStatus.Queued;
    this.completed = false;

    this.promise = new Promise((resolve, reject) =>
    {
      this.promiseResolve = resolve;
      this.promiseReject = reject;
    });

    this.enqueueRunUntilStall();
  }

  complete(): void
  {
    this.completed = true;
    this.runner.deallocate(this);
    this.promiseResolve?.(0);
  }

  updateStall(stall: number): void
  {
    this.stall4 = (stall >>> 2) & 0x3FFFFFFF;
    this.enqueueRunUntilStall();
  }

  waitAsync(): Promise<number>
  {
    return this.promise ?? Promise.resolve(0);
  }

  private get isStalled(): boolean
  {
    return this.stall4 !== 0 && this.current4 >= this.stall4;
  }

  private get hasMoreInstructions(): boolean
  {
    return !this.completed && !this.isStalled;
  }

  private enqueueRunUntilStall(): void
  {
    queueMicrotask(() => this.runUntilStall());
  }

  private runUntilStall(): void
  {
    this.status = DisplayListStatus.Drawing;
    while (this.hasMoreInstructions)
    {
      this.runUntilStallInner();
    }
  }

  private finishPrimBatch(): void
  {
    if (this.drawBuffer.hasElements)
    {
      this.batchPrimCount = 0;
      const batch = this.drawBuffer.createBatch(
        this.state,
        this.primBatchPrimitiveType as PrimitiveType,
        this.vertexInfo,
        this.memory
      );
      this.gpu.queueBatch(batch);
      this.primBatchPrimitiveType = -1;
      this.stats.batchCount++;
    }
  }

  private runUntilStallInner(): void
  {
    const memory = this.memory;
    const state = this.state;
    let stall4 = this.stall4;
    let current4 = this.current4;
    let totalCommandsLocal = 0;
    let localPrimCount = 0;

    if (stall4 === 0) stall4 = 0x7FFFFFFF;

    loop: while (current4 < stall4)
    {
      totalCommandsLocal++;
      const instructionPC4 = current4++;
      const instruction = memory.lw(instructionPC4 << 2);
      const op = (instruction >>> 24) & 0xFF;
      const p = instruction & 0xFFFFFF;

      // Prevent infinite loops
      if (totalCommandsLocal >= 30000)
      {
        console.error('GPU hang!');
        break;
      }

      switch (op)
      {
        case Op.PRIM:
        {
          this.current4 = current4;
          localPrimCount++;
          const primitiveType = param3(p, 16) as PrimitiveType;
          if (this.primBatchPrimitiveType !== primitiveType)
          {
            this.finishPrimBatch();
          }
          if (this.prim(param24(p)) === PrimAction.FLUSH_PRIM)
          {
            this.finishPrimBatch();
          }
          current4 = this.current4;
          break;
        }

        case Op.BEZIER:
          this.finishPrimBatch();
          // TODO: Bezier surfaces
          break;

        case Op.SPLINE:
          this.finishPrimBatch();
          // TODO: Spline surfaces
          break;

        case Op.END:
          this.finishPrimBatch();
          this.complete();
          break loop;

        case Op.TFLUSH:
          this.finishPrimBatch();
          break;

        case Op.TSYNC:
          break;

        case Op.NOP:
        case Op.DUMMY:
          break;

        case Op.JUMP:
        case Op.CALL:
          if (op === Op.CALL)
          {
            this.callstack[this.callstackIndex++] = (instructionPC4 << 2) + 4;
            this.callstack[this.callstackIndex++] = (state.baseOffset >>> 2) & 0x3FFFFFFF;
          }
          current4 = ((state.baseAddress + (param24(p) & ~3)) >>> 2) & 0x3FFFFFFF;
          break;

        case Op.RET:
          if (this.callstackIndex > 0 && this.callstackIndex < 1024)
          {
            state.baseOffset = this.callstack[--this.callstackIndex];
            current4 = (this.callstack[--this.callstackIndex] >>> 2) & 0x3FFFFFFF;
          }
          else
          {
            console.warn('GPU callstack empty or overflow');
          }
          break;

        case Op.FINISH:
        {
          const callback = this.gpu.callbacks.get(this.callbackId);
          if (callback?.finishFunction)
          {
            // TODO: Execute callback
          }
          break;
        }

        case Op.SIGNAL:
          console.warn('GPU SIGNAL not implemented');
          break;

        // Matrix data commands
        case Op.PROJMATRIXDATA:
          state.writeFloat(Op.PROJMATRIXNUMBER, Op.MAT_PROJ, float1(p));
          break;
        case Op.VIEWMATRIXDATA:
          state.writeFloat(Op.VIEWMATRIXNUMBER, Op.MAT_VIEW, float1(p));
          break;
        case Op.WORLDMATRIXDATA:
          state.writeFloat(Op.WORLDMATRIXNUMBER, Op.MAT_WORLD, float1(p));
          break;
        case Op.BONEMATRIXDATA:
          state.writeFloat(Op.BONEMATRIXNUMBER, Op.MAT_BONES, float1(p));
          break;
        case Op.TGENMATRIXDATA:
          state.writeFloat(Op.TGENMATRIXNUMBER, Op.MAT_TEXTURE, float1(p));
          break;

        // Non-invalidating commands
        case Op.BASE:
        case Op.IADDR:
        case Op.VADDR:
        case Op.OFFSETADDR:
          break;

        default:
          if (state.data[op] !== p)
          {
            this.finishPrimBatch();
          }
          break;
      }

      state.data[op] = p;
    }

    this.current4 = current4;
    this.stats.totalStalls++;
    this.stats.primCount = localPrimCount;
    this.stats.totalCommands += totalCommandsLocal;
    this.status = this.isStalled ? DisplayListStatus.Stalling : DisplayListStatus.Completed;
  }

  private prim(p: number): PrimAction
  {
    const vertexCount = param16(p, 0);
    const primitiveType = param3(p, 16) as PrimitiveType;

    if (vertexCount <= 0) return PrimAction.NOTHING;

    const memory = this.memory;
    const state = this.state;
    const vertexInfo = this.vertexInfo.setState(this.state);
    const vertexSize = vertexInfo.size;
    const vertexAddress = state.getAddressRelativeToBaseOffset(vertexInfo.address);
    const indicesAddress = state.getAddressRelativeToBaseOffset(state.indexAddress);
    const hasIndices = vertexInfo.index !== IndexEnum.Void;

    if (hasIndices)
    {
      this.stats.indexCount++;
    }
    else
    {
      this.stats.nonIndexCount++;
    }

    this.primBatchPrimitiveType = primitiveType;

    switch (primitiveType)
    {
      case PrimitiveType.Triangles:
        this.stats.trianglePrimCount++;
        break;
      case PrimitiveType.TriangleStrip:
        this.stats.triangleStripPrimCount++;
        break;
      case PrimitiveType.Sprites:
        this.stats.spritePrimCount++;
        break;
      default:
        this.stats.otherPrimCount++;
        break;
    }

    const vertexInput = memory.getPointerU8Array(vertexAddress);
    const drawType = DRAW_TYPE_CONV[primitiveType];

    if (vertexInfo.realMorphingVertexCount !== 1)
    {
      console.warn('Morphing not implemented');
      return PrimAction.NOTHING;
    }

    switch (vertexInfo.index)
    {
      case IndexEnum.Void:
        this.primOptimizedNoIndex(
          primitiveType,
          drawType === PrimDrawType.BATCH_DRAW_DEGENERATE,
          vertexSize,
          vertexInfo,
          vertexInput
        );
        break;

      case IndexEnum.Byte:
      case IndexEnum.Short:
        if (primitiveType === PrimitiveType.Sprites)
        {
          console.warn('Sprites with indices not implemented');
          return PrimAction.NOTHING;
        }

        let totalVertices = 0;
        if (vertexInfo.index === IndexEnum.Byte)
        {
          totalVertices = this.drawBuffer.addVerticesIndicesList(
            memory.getPointerU8Array(indicesAddress, vertexCount)
          );
        }
        else
        {
          totalVertices = this.drawBuffer.addVerticesIndicesList(
            memory.getPointerU16Array(indicesAddress, vertexCount * 2)
          );
        }
        this.drawBuffer.addVerticesData(vertexInput, totalVertices * vertexSize);
        return PrimAction.FLUSH_PRIM;
    }

    return drawType === PrimDrawType.SINGLE_DRAW ? PrimAction.FLUSH_PRIM : PrimAction.NOTHING;
  }

  private primOptimizedNoIndex(
    primitiveType: PrimitiveType,
    drawTypeDegenerated: boolean,
    vertexSize: number,
    vertexInfo: VertexInfo,
    vertexInput: Uint8Array
  ): void
  {
    let current4 = (this.current4 - 1) | 0;
    let batchPrimCount = this.batchPrimCount | 0;
    const memory = this.memory;
    let totalVertexCount = 0;
    const isSprite = primitiveType === PrimitiveType.Sprites;

    while (true)
    {
      const p2 = memory.lw(current4 << 2) | 0;
      if (((p2 >>> 24) & 0xFF) !== Op.PRIM || param3(p2, 16) !== primitiveType)
      {
        break;
      }

      const vertex2Count = param16(p2, 0) | 0;
      totalVertexCount += vertex2Count;

      if (isSprite)
      {
        this.drawBuffer.addVerticesIndicesSprite(vertex2Count);
      }
      else
      {
        if (drawTypeDegenerated && batchPrimCount > 0)
        {
          this.drawBuffer.join(vertexSize);
        }
        this.drawBuffer.addVerticesIndices(vertex2Count);
      }

      current4++;
      batchPrimCount++;
    }

    this.stats.vertexCount += totalVertexCount;
    const totalVerticesSize = totalVertexCount * vertexSize;

    if (isSprite)
    {
      this.drawBuffer.addVerticesDataSprite(vertexInput, totalVerticesSize, totalVertexCount, vertexInfo);
    }
    else
    {
      this.drawBuffer.addVerticesData(vertexInput, totalVerticesSize);
    }

    vertexInfo.address += totalVerticesSize;
    this.state.vertex.address = vertexInfo.address;
    this.batchPrimCount = batchPrimCount;
    this.current4 = current4;
  }
}

// ============================================
// Display List Runner
// ============================================

class GpuDisplayListRunner
{
  private lists: GpuDisplayList[] = [];
  private freeLists: GpuDisplayList[] = [];
  private runningLists: GpuDisplayList[] = [];
  private state = new GpuState();

  constructor(
    private memory: Memory,
    private stats: GpuStats,
    private gpu: Gpu,
    private drawBuffer: OptimizedDrawBuffer
  )
  {
    for (let n = 0; n < 32; n++)
    {
      const list = new GpuDisplayList(
        n, memory, this, gpu, this.state, drawBuffer, stats
      );
      this.lists.push(list);
      this.freeLists.push(list);
    }
  }

  allocate(): GpuDisplayList
  {
    if (!this.freeLists.length)
    {
      throw new Error('Out of GPU free lists');
    }
    const list = this.freeLists.pop()!;
    this.runningLists.push(list);
    return list;
  }

  getById(id: number): GpuDisplayList
  {
    return this.lists[id];
  }

  deallocate(list: GpuDisplayList): void
  {
    this.freeLists.push(list);
    const idx = this.runningLists.indexOf(list);
    if (idx >= 0)
    {
      this.runningLists.splice(idx, 1);
    }
  }

  peek(): DisplayListStatus
  {
    for (const list of this.runningLists)
    {
      if (list.status !== DisplayListStatus.Completed)
      {
        return list.status;
      }
    }
    return DisplayListStatus.Completed;
  }

  async waitAsync(): Promise<DisplayListStatus>
  {
    await Promise.all(this.runningLists.map(list => list.waitAsync()));
    return DisplayListStatus.Completed;
  }
}

// ============================================
// Main GPU Class
// ============================================

export class Gpu
{
  private listRunner: GpuDisplayListRunner;
  private drawBuffer = new OptimizedDrawBuffer();
  private batches: OptimizedBatch[] = [];

  public callbacks = new Map<number, GpuCallback>();
  public stats: GpuStats = {
    totalCommands: 0,
    totalStalls: 0,
    primCount: 0,
    batchCount: 0,
    vertexCount: 0,
    indexCount: 0,
    nonIndexCount: 0,
    trianglePrimCount: 0,
    triangleStripPrimCount: 0,
    spritePrimCount: 0,
    otherPrimCount: 0,
    timePerFrame: 0,
    hashMemoryCount: 0,
    hashMemorySize: 0,
  };

  private driver: WebGpuDriver | null = null;
  private lastTime = 0;

  constructor(private memory: Memory)
  {
    this.listRunner = new GpuDisplayListRunner(
      memory, this.stats, this, this.drawBuffer
    );
  }

  async init(canvas: HTMLCanvasElement): Promise<boolean>
  {
    this.driver = new WebGpuDriver(canvas);
    return await this.driver.init();
  }

  queueBatch(batch: OptimizedBatch): void
  {
    this.batches.push(batch);
  }

  listEnqueue(start: number, stall: number, callbackId: number): number
  {
    const list = this.listRunner.allocate();
    list.current4 = (start >>> 2) & 0x3FFFFFFF;
    list.stall4 = stall;
    list.callbackId = callbackId;
    list.start();
    return list.id;
  }

  listSync(displayListId: number): Promise<number>
  {
    return this.listRunner.getById(displayListId).waitAsync();
  }

  updateStallAddr(displayListId: number, stall: number): number
  {
    this.listRunner.getById(displayListId).updateStall(stall);
    return 0;
  }

  async drawSync(): Promise<DisplayListStatus>
  {
    await this.listRunner.waitAsync();

    const end = performance.now();
    this.stats.timePerFrame = (this.stats.timePerFrame + (end - this.lastTime)) / 2;
    this.lastTime = end;

    if (this.driver && this.batches.length > 0)
    {
      const transfer = BatchTransferBuilder.buildBatchesTransfer(
        this.drawBuffer,
        this.batches
      );
      this.driver.drawBatchesTransfer(transfer);
    }

    this.drawBuffer.reset();
    this.batches = [];

    this.resetStats();
    return DisplayListStatus.Completed;
  }

  private resetStats(): void
  {
    this.stats.batchCount = 0;
    this.stats.primCount = 0;
    this.stats.vertexCount = 0;
    this.stats.indexCount = 0;
    this.stats.nonIndexCount = 0;
    this.stats.trianglePrimCount = 0;
    this.stats.triangleStripPrimCount = 0;
    this.stats.spritePrimCount = 0;
    this.stats.otherPrimCount = 0;
  }

  destroy(): void
  {
    this.driver?.destroy();
  }
}
