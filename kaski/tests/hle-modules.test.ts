/**
 * HLE Module Tests
 *
 * Tests for PSP HLE module implementations.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { Memory } from '../src/core/memory/Memory';
import { EmulatorContext } from '../src/hle/EmulatorContext';
import { SceKernelErrors } from '../src/hle/errors';
import { PixelFormat, SyncMode } from '../src/hle/manager/DisplayManager';
import { PspButtons, SamplingMode } from '../src/hle/manager/InputManager';
import { MemoryVfs } from '../src/hle/vfs/MemoryVfs';
import { OpenFlags, SeekMode } from '../src/hle/vfs/types';
import { GeListState, GeSyncType } from '../src/hle/manager/GpuManager';

describe('DisplayManager', () => {
  let memory: Memory;
  let ctx: EmulatorContext;

  beforeEach(() => {
    memory = new Memory();
    ctx = new EmulatorContext(memory);
  });

  it('should initialize with default mode', () => {
    const { mode, width, height } = ctx.displayManager.getMode();
    expect(mode).toBe(0);
    expect(width).toBe(480);
    expect(height).toBe(272);
  });

  it('should set and get display mode', () => {
    const result = ctx.displayManager.setMode(0, 480, 272);
    expect(result).toBe(SceKernelErrors.ERROR_OK);

    const { mode, width, height } = ctx.displayManager.getMode();
    expect(mode).toBe(0);
    expect(width).toBe(480);
    expect(height).toBe(272);
  });

  it('should set frame buffer', () => {
    const addr = 0x04000000;
    const bufferWidth = 512;
    const pixelFormat = PixelFormat.RGBA8888;
    const syncMode = SyncMode.NextFrame;

    const result = ctx.displayManager.setFrameBuf(addr, bufferWidth, pixelFormat, syncMode);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should track vcount', () => {
    const initialVcount = ctx.displayManager.getVcount();
    expect(initialVcount).toBeGreaterThanOrEqual(0);

    // Simulate a frame
    ctx.displayManager.onVblank();
    const newVcount = ctx.displayManager.getVcount();
    expect(newVcount).toBe(initialVcount + 1);
  });

  it('should report correct current hcount', () => {
    const hcount = ctx.displayManager.getCurrentHcount();
    expect(hcount).toBeGreaterThanOrEqual(0);
    expect(hcount).toBeLessThan(286); // PSP has 286 hcounts per vblank
  });

  it('should check if vblank', () => {
    const isVblank = ctx.displayManager.isVblank();
    expect(typeof isVblank).toBe('boolean');
  });
});

describe('InputManager', () => {
  let memory: Memory;
  let ctx: EmulatorContext;

  beforeEach(() => {
    memory = new Memory();
    ctx = new EmulatorContext(memory);
  });

  it('should initialize with no buttons pressed', () => {
    const buttons = ctx.inputManager.getButtons();
    expect(buttons).toBe(0);
  });

  it('should track button presses', () => {
    ctx.inputManager.setButton(PspButtons.CROSS);

    const buttons = ctx.inputManager.getButtons();
    expect(buttons & PspButtons.CROSS).toBe(PspButtons.CROSS);
  });

  it('should set multiple buttons', () => {
    ctx.inputManager.setButtons(PspButtons.CROSS | PspButtons.CIRCLE);

    const buttons = ctx.inputManager.getButtons();
    expect(buttons & PspButtons.CROSS).toBe(PspButtons.CROSS);
    expect(buttons & PspButtons.CIRCLE).toBe(PspButtons.CIRCLE);
  });

  it('should handle analog stick', () => {
    ctx.inputManager.setAnalog(200, 100);

    const data = ctx.inputManager.getCurrentData();
    expect(data.lx).toBe(200);
    expect(data.ly).toBe(100);
  });

  it('should get current data', () => {
    ctx.inputManager.setButton(PspButtons.START);
    ctx.inputManager.setAnalog(128, 128);

    const data = ctx.inputManager.getCurrentData();
    expect(data.buttons & PspButtons.START).toBe(PspButtons.START);
    expect(data.lx).toBe(128);
    expect(data.ly).toBe(128);
  });

  it('should set and get sampling mode', () => {
    ctx.inputManager.setSamplingMode(SamplingMode.Digital);
    expect(ctx.inputManager.getSamplingMode()).toBe(SamplingMode.Digital);

    ctx.inputManager.setSamplingMode(SamplingMode.Analog);
    expect(ctx.inputManager.getSamplingMode()).toBe(SamplingMode.Analog);
  });

  it('should set and get sampling cycle', () => {
    ctx.inputManager.setSamplingCycle(1000);
    expect(ctx.inputManager.getSamplingCycle()).toBe(1000);
  });

  it('should peek buffer', () => {
    ctx.inputManager.setButton(PspButtons.TRIANGLE);
    const samples = ctx.inputManager.peekBuffer(1);
    expect(samples.length).toBeGreaterThanOrEqual(0);
  });
});

describe('AudioManager', () => {
  let memory: Memory;
  let ctx: EmulatorContext;

  beforeEach(() => {
    memory = new Memory();
    ctx = new EmulatorContext(memory);
  });

  it('should reserve and release channels', () => {
    // reserveChannel(channelId, sampleCount, format)
    const channel = ctx.audioManager.reserveChannel(-1, 1024, 0);
    expect(channel).toBeGreaterThanOrEqual(0);
    expect(channel).toBeLessThan(8);

    const released = ctx.audioManager.releaseChannel(channel);
    expect(released).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should reserve specific channel', () => {
    const channel = ctx.audioManager.reserveChannel(3, 1024, 0);
    expect(channel).toBe(3);
  });

  it('should fail to reserve already reserved channel', () => {
    ctx.audioManager.reserveChannel(3, 1024, 0);
    const channel = ctx.audioManager.reserveChannel(3, 1024, 0);
    // Returns error code (large positive number)
    expect(channel).toBeGreaterThan(0x80000000 >>> 0);
  });

  it('should set channel sample count', () => {
    const channel = ctx.audioManager.reserveChannel(-1, 1024, 0);
    const result = ctx.audioManager.setChannelDataLen(channel, 2048);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should set channel volume', () => {
    const channel = ctx.audioManager.reserveChannel(-1, 1024, 0);
    const result = ctx.audioManager.setChannelVolume(channel, 0x8000, 0x8000);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should get channel remaining samples', () => {
    const channel = ctx.audioManager.reserveChannel(-1, 1024, 0);
    const remaining = ctx.audioManager.getChannelRestLen(channel);
    expect(remaining).toBeGreaterThanOrEqual(0);
  });

  it('should get channel info', () => {
    const channel = ctx.audioManager.reserveChannel(2, 1024, 0);
    const info = ctx.audioManager.getChannel(channel);
    expect(info).toBeDefined();
    expect(info!.id).toBe(2);
    expect(info!.sampleCount).toBe(1024);
    expect(info!.reserved).toBe(true);
  });

  it('should reject invalid sample count alignment', () => {
    // Sample count must be aligned to 64
    const channel = ctx.audioManager.reserveChannel(-1, 1000, 0);
    // Error codes are negative when treated as signed, or > 0x80000000 unsigned
    expect((channel >>> 0) > 0x80000000).toBe(true); // Error code
  });

  it('should handle SRC channel (output2)', () => {
    const result = ctx.audioManager.reserveOutput2(1024);
    expect(result).toBe(SceKernelErrors.ERROR_OK);

    const releaseResult = ctx.audioManager.releaseOutput2();
    expect(releaseResult).toBe(SceKernelErrors.ERROR_OK);
  });
});

describe('SyncManager', () => {
  let memory: Memory;
  let ctx: EmulatorContext;

  beforeEach(() => {
    memory = new Memory();
    ctx = new EmulatorContext(memory);
  });

  it('should create semaphore', () => {
    const { semaphore, error } = ctx.syncManager.createSemaphore('test', 0, 1, 10);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(semaphore).not.toBeNull();
    expect(semaphore!.uid).toBeGreaterThan(0);
  });

  it('should signal semaphore', () => {
    const { semaphore } = ctx.syncManager.createSemaphore('test', 0, 0, 10);
    expect(semaphore).not.toBeNull();
    // Signal increases count
    semaphore!.signal(1);
    expect(semaphore!.currentCount).toBe(1);
  });

  it('should poll semaphore (success)', () => {
    const { semaphore } = ctx.syncManager.createSemaphore('test', 0, 5, 10);
    expect(semaphore).not.toBeNull();
    // Poll to acquire 1 (non-blocking)
    const result = semaphore!.poll(1);
    expect(result).toBe(0); // Success
    expect(semaphore!.currentCount).toBe(4);
  });

  it('should poll semaphore (fail when zero)', () => {
    const { semaphore } = ctx.syncManager.createSemaphore('test', 0, 0, 10);
    expect(semaphore).not.toBeNull();
    // Should fail because count is 0
    const result = semaphore!.poll(1);
    expect(result).toBe(SceKernelErrors.ERROR_KERNEL_SEMA_ZERO);
  });

  it('should delete semaphore', () => {
    const { semaphore } = ctx.syncManager.createSemaphore('test', 0, 1, 10);
    expect(semaphore).not.toBeNull();
    const result = ctx.syncManager.deleteSemaphore(semaphore!.uid);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should get semaphore info', () => {
    const { semaphore } = ctx.syncManager.createSemaphore('test', 0, 5, 10);
    expect(semaphore).not.toBeNull();
    const info = ctx.syncManager.getSemaphoreInfo(semaphore!.uid);
    expect(info).not.toBeNull();
    expect(info!.name).toBe('test');
    expect(info!.currentCount).toBe(5);
    expect(info!.maxCount).toBe(10);
  });

  it('should create event flag', () => {
    const { eventFlag, error } = ctx.syncManager.createEventFlag('test', 0, 0);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(eventFlag).not.toBeNull();
    expect(eventFlag!.uid).toBeGreaterThan(0);
  });

  it('should set event flag', () => {
    const { eventFlag } = ctx.syncManager.createEventFlag('test', 0, 0);
    expect(eventFlag).not.toBeNull();
    eventFlag!.set(0xFF);
    expect(eventFlag!.currentPattern).toBe(0xFF);
  });

  it('should clear event flag', () => {
    const { eventFlag } = ctx.syncManager.createEventFlag('test', 0, 0xFF);
    expect(eventFlag).not.toBeNull();
    eventFlag!.clear(0x0F);
    expect(eventFlag!.currentPattern).toBe(0xF0);
  });

  it('should poll event flag', () => {
    const { eventFlag } = ctx.syncManager.createEventFlag('test', 0, 0xFF);
    expect(eventFlag).not.toBeNull();
    const result = eventFlag!.poll(0x0F, 0); // And mode
    expect(result.success).toBe(true);
    expect(result.pattern).toBe(0xFF);
  });

  it('should create mutex', () => {
    const { mutex, error } = ctx.syncManager.createMutex('test', 0, 0);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(mutex).not.toBeNull();
    expect(mutex!.uid).toBeGreaterThan(0);
  });

  it('should try lock and unlock mutex', () => {
    const { mutex } = ctx.syncManager.createMutex('test', 0, 0);
    expect(mutex).not.toBeNull();

    // Create a mock waitable thread
    const mockThread = { uid: 1, status: 1, wakeupCount: 0 };

    // Try lock
    const lockResult = mutex!.tryLock(mockThread);
    expect(lockResult).toBe(0); // 0 = success
    expect(mutex!.isLocked).toBe(true);

    // Unlock
    const unlockResult = mutex!.unlock(mockThread);
    expect(unlockResult).toBe(0); // 0 = success
    expect(mutex!.isLocked).toBe(false);
  });

  it('should delete mutex', () => {
    const { mutex } = ctx.syncManager.createMutex('test', 0, 0);
    expect(mutex).not.toBeNull();
    const result = ctx.syncManager.deleteMutex(mutex!.uid);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });
});

describe('FileManager', () => {
  let memory: Memory;
  let ctx: EmulatorContext;
  let vfs: MemoryVfs;

  beforeEach(() => {
    memory = new Memory();
    ctx = new EmulatorContext(memory);
    // Create and mount a test VFS
    vfs = new MemoryVfs();
    ctx.fileManager.mount('ms0', vfs);
  });

  it('should have fileManager initialized', () => {
    expect(ctx.fileManager).toBeDefined();
  });

  it('should mount and get devices', () => {
    const devices = ctx.fileManager.getMountedDevices();
    expect(devices).toContain('ms0');
  });

  it('should open and close file', async () => {
    // Add file to VFS
    const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]); // "Hello"
    vfs.addFile('test.txt', testData);

    const { handle, error } = await ctx.fileManager.open('ms0:/test.txt', OpenFlags.Read, 0);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(handle).not.toBeNull();
    expect(handle!.uid).toBeGreaterThan(0);

    const closeResult = await ctx.fileManager.close(handle!.uid);
    expect(closeResult).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should read file', async () => {
    const testData = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F]);
    vfs.addFile('test.txt', testData);

    const { handle } = await ctx.fileManager.open('ms0:/test.txt', OpenFlags.Read, 0);
    expect(handle).not.toBeNull();

    const { data, error } = await ctx.fileManager.read(handle!.uid, 5);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(data.length).toBe(5);
    expect(data[0]).toBe(0x48); // 'H'
    expect(data[4]).toBe(0x6F); // 'o'

    await ctx.fileManager.close(handle!.uid);
  });

  it('should seek in file', async () => {
    const testData = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    vfs.addFile('test.bin', testData);

    const { handle } = await ctx.fileManager.open('ms0:/test.bin', OpenFlags.Read, 0);
    expect(handle).not.toBeNull();

    // Seek to position 5
    const { position, error } = await ctx.fileManager.seek(handle!.uid, 5, SeekMode.Set);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(position.toNumber()).toBe(5);

    // Read one byte
    const { data } = await ctx.fileManager.read(handle!.uid, 1);
    expect(data[0]).toBe(5);

    await ctx.fileManager.close(handle!.uid);
  });

  it('should get file stat', async () => {
    const testData = new Uint8Array(100);
    vfs.addFile('test.bin', testData);

    const { stat, error } = await ctx.fileManager.stat('ms0:/test.bin');
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(stat).not.toBeNull();
    expect(stat!.size).toBe(100);
  });

  it('should handle file not found', async () => {
    const { handle, error } = await ctx.fileManager.open('ms0:/nonexistent.txt', OpenFlags.Read, 0);
    expect(handle).toBeNull();
    expect(error).toBe(SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND);
  });

  it('should handle device not found', async () => {
    const { handle, error } = await ctx.fileManager.open('invalid0:/test.txt', OpenFlags.Read, 0);
    expect(handle).toBeNull();
    expect(error).toBe(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
  });
});

describe('GpuManager', () => {
  let memory: Memory;
  let ctx: EmulatorContext;

  beforeEach(() => {
    memory = new Memory();
    ctx = new EmulatorContext(memory);
  });

  it('should enqueue display list', () => {
    const listId = ctx.gpuManager.enqueueList(0x08800000, 0, -1, 0);
    expect(listId).toBeGreaterThan(0);
  });

  it('should enqueue display list at head', () => {
    const listId = ctx.gpuManager.enqueueListHead(0x08800000, 0, -1, 0);
    expect(listId).toBeGreaterThan(0);
  });

  it('should get list state', () => {
    const listId = ctx.gpuManager.enqueueList(0x08800000, 0, -1, 0);
    const state = ctx.gpuManager.getListState(listId);
    // List executes immediately and completes
    expect(state).toBe(GeListState.Done);
  });

  it('should dequeue list', () => {
    const listId = ctx.gpuManager.enqueueList(0x08800000, 0, -1, 0);
    // List already done, but dequeue should still work
    const result = ctx.gpuManager.dequeueList(listId);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should update stall address', () => {
    const listId = ctx.gpuManager.enqueueList(0x08800000, 0x08800100, -1, 0);
    const result = ctx.gpuManager.updateStallAddress(listId, 0x08800200);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should set and unset callback', () => {
    const cbid = ctx.gpuManager.setCallback(0x08900000, 0x08900100, 0);
    expect(cbid).toBeGreaterThan(0);

    const result = ctx.gpuManager.unsetCallback(cbid);
    expect(result).toBe(SceKernelErrors.ERROR_OK);
  });

  it('should handle EDRAM address', () => {
    const edramAddr = ctx.gpuManager.getEdramAddress();
    expect(edramAddr).toBe(0x04000000);
  });

  it('should get EDRAM size', () => {
    const size = ctx.gpuManager.getEdramSize();
    expect(size).toBe(0x200000); // 2MB
  });

  it('should reset state', () => {
    ctx.gpuManager.enqueueList(0x08800000, 0, -1, 0);
    ctx.gpuManager.reset();
    // After reset, list ID should start from 1 again
    const listId = ctx.gpuManager.enqueueList(0x08800000, 0, -1, 0);
    expect(listId).toBe(1);
  });
});
