import { describe, it, expect } from 'bun:test';
import {
  MemoryVfs,
  FileManager,
  parseUri,
  OpenFlags, SeekMode, FileMode,
  SceKernelErrors,
} from '../src/hle';

describe('parseUri', () =>
{
  it('should parse device:path format', () =>
  {
    const uri = parseUri('ms0:/PSP/GAME/test.txt');
    expect(uri.device).toBe('ms0');
    expect(uri.path).toBe('PSP/GAME/test.txt');
  });

  it('should handle paths without device', () =>
  {
    const uri = parseUri('/path/to/file.txt');
    expect(uri.device).toBe('');
    expect(uri.path).toBe('/path/to/file.txt');
  });

  it('should handle root paths', () =>
  {
    const uri = parseUri('umd0:/');
    expect(uri.device).toBe('umd0');
    expect(uri.path).toBe('');
  });
});

describe('MemoryVfs', () =>
{
  it('should add and read files', () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'Hello World');

    const data = vfs.getFile('/test.txt');
    expect(data).not.toBeNull();
    expect(new TextDecoder().decode(data!)).toBe('Hello World');
  });

  it('should create directories', async () =>
  {
    const vfs = new MemoryVfs();

    const result = await vfs.mkdir('/testdir');
    expect(result).toBe(true);

    const exists = await vfs.exists('/testdir');
    expect(exists).toBe(true);

    const stat = await vfs.stat('/testdir');
    expect(stat).not.toBeNull();
    expect(stat!.mode).toBe(FileMode.Directory);
  });

  it('should open and read files', async () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'Hello');

    const entry = await vfs.open('/test.txt', OpenFlags.Read);
    expect(entry).not.toBeNull();
    expect(entry!.isFile).toBe(true);

    const data = await entry!.read(100);
    expect(new TextDecoder().decode(data)).toBe('Hello');
  });

  it('should open and write files', async () =>
  {
    const vfs = new MemoryVfs();

    const entry = await vfs.open('/new.txt', OpenFlags.Write | OpenFlags.Create);
    expect(entry).not.toBeNull();

    await entry!.write(new TextEncoder().encode('Test'));
    await entry!.close();

    const data = vfs.getFile('/new.txt');
    expect(new TextDecoder().decode(data!)).toBe('Test');
  });

  it('should seek in files', async () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', '0123456789');

    const entry = await vfs.open('/test.txt', OpenFlags.Read);

    await entry!.seek(5, SeekMode.Set);
    expect(entry!.position).toBe(5);

    let data = await entry!.read(3);
    expect(new TextDecoder().decode(data)).toBe('567');

    await entry!.seek(-2, SeekMode.Current);
    data = await entry!.read(2);
    expect(new TextDecoder().decode(data)).toBe('67');

    await entry!.seek(-3, SeekMode.End);
    data = await entry!.read(10);
    expect(new TextDecoder().decode(data)).toBe('789');
  });

  it('should read directories', async () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/dir/file1.txt', 'a');
    vfs.addFile('/dir/file2.txt', 'b');

    const entry = await vfs.openDir('/dir');
    expect(entry).not.toBeNull();
    expect(entry!.isDirectory).toBe(true);

    const entries = await entry!.readDir();
    expect(entries.length).toBe(2);
    expect(entries.map(e => e.name).sort()).toEqual(['file1.txt', 'file2.txt']);
  });

  it('should delete files', async () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'data');

    expect(await vfs.exists('/test.txt')).toBe(true);
    expect(await vfs.remove('/test.txt')).toBe(true);
    expect(await vfs.exists('/test.txt')).toBe(false);
  });

  it('should rename files', async () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/old.txt', 'data');

    expect(await vfs.rename('/old.txt', '/new.txt')).toBe(true);
    expect(await vfs.exists('/old.txt')).toBe(false);
    expect(await vfs.exists('/new.txt')).toBe(true);
  });

  it('should return null for non-existent files', async () =>
  {
    const vfs = new MemoryVfs();

    const entry = await vfs.open('/notexists.txt', OpenFlags.Read);
    expect(entry).toBeNull();
  });

  it('should truncate files on open', async () =>
  {
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'Hello World');

    const entry = await vfs.open('/test.txt', OpenFlags.Write | OpenFlags.Truncate);
    await entry!.write(new TextEncoder().encode('Hi'));
    await entry!.close();

    expect(new TextDecoder().decode(vfs.getFile('/test.txt')!)).toBe('Hi');
  });
});

describe('FileManager', () =>
{
  it('should mount devices', () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();

    fm.mount('ms0', vfs);
    expect(fm.getDevice('ms0')).toBe(vfs);
  });

  it('should list mounted devices', () =>
  {
    const fm = new FileManager();
    fm.mount('ms0', new MemoryVfs());
    fm.mount('umd0', new MemoryVfs());

    const devices = fm.getMountedDevices();
    expect(devices).toContain('ms0');
    expect(devices).toContain('umd0');
    expect(devices).toContain('emu0'); // Default
  });

  it('should resolve paths with CWD', () =>
  {
    const fm = new FileManager();
    fm.cwd = 'ms0:/PSP/GAME';

    const parsed = fm.resolvePath('test.txt');
    expect(parsed.device).toBe('ms0');
    expect(parsed.path).toBe('PSP/GAME/test.txt');
  });

  it('should open files', async () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'Hello');
    fm.mount('ms0', vfs);

    const { handle, error } = await fm.open('ms0:/test.txt', OpenFlags.Read);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(handle).not.toBeNull();
    expect(handle!.uid).toBeGreaterThan(0);
  });

  it('should read from files', async () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'Hello World');
    fm.mount('ms0', vfs);

    const { handle } = await fm.open('ms0:/test.txt', OpenFlags.Read);
    const { data, error } = await fm.read(handle!.uid, 5);

    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(new TextDecoder().decode(data)).toBe('Hello');
  });

  it('should write to files', async () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();
    fm.mount('ms0', vfs);

    const { handle } = await fm.open('ms0:/new.txt', OpenFlags.Write | OpenFlags.Create);
    const { written, error } = await fm.write(handle!.uid, new TextEncoder().encode('Test'));

    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(written).toBe(4);

    expect(new TextDecoder().decode(vfs.getFile('/new.txt')!)).toBe('Test');
  });

  it('should close files', async () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'data');
    fm.mount('ms0', vfs);

    const { handle } = await fm.open('ms0:/test.txt', OpenFlags.Read);
    const uid = handle!.uid;

    const error = await fm.close(uid);
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(fm.getHandle(uid)).toBeUndefined();
  });

  it('should fail for non-existent device', async () =>
  {
    const fm = new FileManager();

    const { handle, error } = await fm.open('fake0:/test.txt', OpenFlags.Read);
    expect(handle).toBeNull();
    expect(error).toBe(SceKernelErrors.ERROR_ERRNO_DEVICE_NOT_FOUND);
  });

  it('should fail for non-existent file', async () =>
  {
    const fm = new FileManager();
    fm.mount('ms0', new MemoryVfs());

    const { handle, error } = await fm.open('ms0:/notexists.txt', OpenFlags.Read);
    expect(handle).toBeNull();
    expect(error).toBe(SceKernelErrors.ERROR_ERRNO_FILE_NOT_FOUND);
  });

  it('should stat files', async () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();
    vfs.addFile('/test.txt', 'Hello');
    fm.mount('ms0', vfs);

    const { stat, error } = await fm.stat('ms0:/test.txt');
    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(stat).not.toBeNull();
    expect(stat!.size).toBe(5);
    expect(stat!.mode).toBe(FileMode.File);
  });

  it('should create directories', async () =>
  {
    const fm = new FileManager();
    fm.mount('ms0', new MemoryVfs());

    const error = await fm.mkdir('ms0:/newdir');
    expect(error).toBe(SceKernelErrors.ERROR_OK);

    const { stat } = await fm.stat('ms0:/newdir');
    expect(stat).not.toBeNull();
    expect(stat!.mode).toBe(FileMode.Directory);
  });

  it('should read directories', async () =>
  {
    const fm = new FileManager();
    const vfs = new MemoryVfs();
    vfs.addFile('/dir/a.txt', 'a');
    vfs.addFile('/dir/b.txt', 'b');
    fm.mount('ms0', vfs);

    const { handle } = await fm.openDir('ms0:/dir');
    const { entries, error } = await fm.readDir(handle!.uid);

    expect(error).toBe(SceKernelErrors.ERROR_OK);
    expect(entries.length).toBe(2);
  });
});
