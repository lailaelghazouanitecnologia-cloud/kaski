/**
 * ISO VFS Tests
 */

import { describe, it, expect } from 'vitest';
import { IsoVfs, IsoVfsEntry } from '../src/hle/vfs/IsoVfs';
import { IsoFile, IsoEntry, SECTOR_SIZE } from '../src/format/iso';
import { Stream } from '../src/format/stream';
import { FileMode, OpenFlags, SeekMode } from '../src/hle/vfs/types';

// ============================================
// Test ISO Image Builder
// ============================================

/**
 * Build a minimal ISO 9660 image for testing
 */
function buildTestIso(): Uint8Array
{
  const sectors: Uint8Array[] = [];

  // Sectors 0-15: System area (empty)
  for (let i = 0; i < 16; i++)
  {
    sectors.push(new Uint8Array(SECTOR_SIZE));
  }

  // Sector 16: Primary Volume Descriptor
  const pvd = new Uint8Array(SECTOR_SIZE);
  pvd[0] = 1; // Type: PRIMARY
  pvd.set(new TextEncoder().encode('CD001'), 1); // Magic
  pvd[6] = 1; // Version

  // Volume identifier at offset 40
  const volumeId = 'TEST_ISO';
  pvd.set(new TextEncoder().encode(volumeId), 40);

  // Volume space size at offset 80 (little-endian)
  const volumeSize = 20; // 20 sectors
  pvd[80] = volumeSize & 0xFF;
  pvd[81] = (volumeSize >> 8) & 0xFF;
  pvd[82] = (volumeSize >> 16) & 0xFF;
  pvd[83] = (volumeSize >> 24) & 0xFF;

  // Logical block size at offset 128 (little-endian)
  pvd[128] = 0x00;
  pvd[129] = 0x08; // 2048

  // Root directory record at offset 156
  const rootRecordOffset = 156;
  pvd[rootRecordOffset] = 34; // Record length
  pvd[rootRecordOffset + 1] = 0; // Extended attr length

  // Root directory LBA at offset 158 (little-endian)
  const rootLba = 18;
  pvd[rootRecordOffset + 2] = rootLba & 0xFF;
  pvd[rootRecordOffset + 3] = (rootLba >> 8) & 0xFF;

  // Root directory size at offset 166
  pvd[rootRecordOffset + 10] = SECTOR_SIZE & 0xFF;
  pvd[rootRecordOffset + 11] = (SECTOR_SIZE >> 8) & 0xFF;

  // Date at offset 174
  pvd[rootRecordOffset + 18] = 124; // 2024
  pvd[rootRecordOffset + 19] = 1;
  pvd[rootRecordOffset + 20] = 1;
  pvd[rootRecordOffset + 21] = 0;
  pvd[rootRecordOffset + 22] = 0;
  pvd[rootRecordOffset + 23] = 0;
  pvd[rootRecordOffset + 24] = 0;

  // Flags (directory)
  pvd[rootRecordOffset + 25] = 2;

  // Name length and name (root = 0x00)
  pvd[rootRecordOffset + 32] = 1;
  pvd[rootRecordOffset + 33] = 0;

  sectors.push(pvd);

  // Sector 17: Volume Descriptor Set Terminator
  const terminator = new Uint8Array(SECTOR_SIZE);
  terminator[0] = 255;
  terminator.set(new TextEncoder().encode('CD001'), 1);
  terminator[6] = 1;
  sectors.push(terminator);

  // Sector 18: Root directory
  const rootDir = new Uint8Array(SECTOR_SIZE);
  let offset = 0;

  // . entry
  rootDir[offset] = 34;
  rootDir[offset + 2] = rootLba & 0xFF;
  rootDir[offset + 10] = SECTOR_SIZE & 0xFF;
  rootDir[offset + 18] = 124;
  rootDir[offset + 19] = 1;
  rootDir[offset + 20] = 1;
  rootDir[offset + 25] = 2; // Directory flag
  rootDir[offset + 32] = 1;
  rootDir[offset + 33] = 0; // .
  offset += 34;

  // .. entry
  rootDir[offset] = 34;
  rootDir[offset + 2] = rootLba & 0xFF;
  rootDir[offset + 10] = SECTOR_SIZE & 0xFF;
  rootDir[offset + 18] = 124;
  rootDir[offset + 19] = 1;
  rootDir[offset + 20] = 1;
  rootDir[offset + 25] = 2;
  rootDir[offset + 32] = 1;
  rootDir[offset + 33] = 1; // ..
  offset += 34;

  // TEST.TXT file entry
  const testFileName = 'TEST.TXT';
  const testFileLba = 19;
  const testFileSize = 13;

  rootDir[offset] = 33 + testFileName.length;
  rootDir[offset + 2] = testFileLba & 0xFF;
  rootDir[offset + 10] = testFileSize & 0xFF;
  rootDir[offset + 18] = 124;
  rootDir[offset + 19] = 1;
  rootDir[offset + 20] = 1;
  rootDir[offset + 25] = 0; // File flag
  rootDir[offset + 32] = testFileName.length;
  rootDir.set(new TextEncoder().encode(testFileName), offset + 33);

  sectors.push(rootDir);

  // Sector 19: TEST.TXT content
  const testContent = new Uint8Array(SECTOR_SIZE);
  testContent.set(new TextEncoder().encode('Hello, World!'));
  sectors.push(testContent);

  // Combine all sectors
  const isoSize = sectors.length * SECTOR_SIZE;
  const iso = new Uint8Array(isoSize);
  for (let i = 0; i < sectors.length; i++)
  {
    iso.set(sectors[i], i * SECTOR_SIZE);
  }

  return iso;
}

// ============================================
// Tests
// ============================================

describe('IsoVfs', () =>
{
  describe('Construction', () =>
  {
    it('should create IsoVfs from buffer', () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      expect(vfs).toBeDefined();
      expect(vfs.name).toBe('iso');
    });

    it('should expose underlying IsoFile', () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const iso = vfs.getIsoFile();
      expect(iso).toBeDefined();
      expect(iso.pvd).toBeDefined();
    });
  });

  describe('File Operations', () =>
  {
    it('should check if file exists', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const exists = await vfs.exists('/TEST.TXT');
      expect(exists).toBe(true);

      const notExists = await vfs.exists('/NOTEXIST.TXT');
      expect(notExists).toBe(false);
    });

    it('should open file for reading', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);
      expect(entry).not.toBeNull();
      expect(entry!.isFile).toBe(true);
      expect(entry!.isDirectory).toBe(false);
    });

    it('should fail to open non-existent file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/NOTEXIST.TXT', OpenFlags.Read);
      expect(entry).toBeNull();
    });

    it('should fail to open file for writing', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Write);
      expect(entry).toBeNull();
    });

    it('should get file stats', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const stat = await vfs.stat('/TEST.TXT');
      expect(stat).not.toBeNull();
      expect(stat!.mode).toBe(FileMode.File);
      expect(stat!.size).toBe(13);
    });

    it('should get directory stats', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const stat = await vfs.stat('/');
      expect(stat).not.toBeNull();
      expect(stat!.mode).toBe(FileMode.Directory);
    });
  });

  describe('Reading Files', () =>
  {
    it('should read file content', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);
      expect(entry).not.toBeNull();

      const data = await entry!.read(13);
      const text = new TextDecoder().decode(data);
      expect(text).toBe('Hello, World!');
    });

    it('should track read position', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);
      expect(entry!.position).toBe(0);

      await entry!.read(5);
      expect(entry!.position).toBe(5);

      const remaining = await entry!.read(100);
      expect(remaining.length).toBe(8); // 13 - 5 = 8
      expect(entry!.position).toBe(13);
    });

    it('should seek in file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);

      // Seek from start
      await entry!.seek(7, SeekMode.Set);
      expect(entry!.position).toBe(7);

      const data = await entry!.read(6);
      const text = new TextDecoder().decode(data);
      expect(text).toBe('World!');

      // Seek from current
      await entry!.seek(-6, SeekMode.Current);
      expect(entry!.position).toBe(7);

      // Seek from end
      await entry!.seek(-1, SeekMode.End);
      expect(entry!.position).toBe(12);
    });

    it('should get file size', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);
      const size = await entry!.getSize();
      expect(size).toBe(13);
    });
  });

  describe('Directory Operations', () =>
  {
    it('should open directory', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.openDir('/');
      expect(entry).not.toBeNull();
      expect(entry!.isDirectory).toBe(true);
    });

    it('should list directory contents', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.openDir('/');
      const entries = await entry!.readDir();

      expect(entries.length).toBe(1);
      expect(entries[0].name).toBe('TEST.TXT');
      expect(entries[0].stat.mode).toBe(FileMode.File);
    });

    it('should fail to read from directory', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.openDir('/');

      let threw = false;
      try
      {
        await entry!.read(10).toPromise();
      }
      catch (e: any)
      {
        threw = true;
        expect(e.message).toContain('Cannot read from directory');
      }
      expect(threw).toBe(true);
    });

    it('should fail to read dir from file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);

      let threw = false;
      try
      {
        await entry!.readDir().toPromise();
      }
      catch (e: any)
      {
        threw = true;
        expect(e.message).toContain('Not a directory');
      }
      expect(threw).toBe(true);
    });
  });

  describe('Read-Only Enforcement', () =>
  {
    it('should fail to write to file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);

      let threw = false;
      try
      {
        await entry!.write(new Uint8Array([1, 2, 3])).toPromise();
      }
      catch (e: any)
      {
        threw = true;
        expect(e.message).toContain('read-only');
      }
      expect(threw).toBe(true);
    });

    it('should fail to create directory', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const result = await vfs.mkdir('/NEW_DIR');
      expect(result).toBe(false);
    });

    it('should fail to remove file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const result = await vfs.remove('/TEST.TXT');
      expect(result).toBe(false);
    });

    it('should fail to remove directory', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const result = await vfs.rmdir('/');
      expect(result).toBe(false);
    });

    it('should fail to rename file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const result = await vfs.rename('/TEST.TXT', '/RENAMED.TXT');
      expect(result).toBe(false);
    });

    it('should fail to create file', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/NEW.TXT', OpenFlags.Create);
      expect(entry).toBeNull();
    });
  });

  describe('Path Handling', () =>
  {
    it('should handle case-insensitive paths', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const exists1 = await vfs.exists('/TEST.TXT');
      const exists2 = await vfs.exists('/test.txt');
      const exists3 = await vfs.exists('/Test.Txt');

      expect(exists1).toBe(true);
      expect(exists2).toBe(true);
      expect(exists3).toBe(true);
    });

    it('should handle paths without leading slash', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const exists = await vfs.exists('TEST.TXT');
      expect(exists).toBe(true);
    });

    it('should handle backslash paths', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const exists = await vfs.exists('\\TEST.TXT');
      expect(exists).toBe(true);
    });
  });

  describe('Entry Lifecycle', () =>
  {
    it('should close entry properly', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);

      // Read to cache data
      await entry!.read(5);

      // Close should succeed
      await entry!.close();
    });

    it('should get entry stats', async () =>
    {
      const isoData = buildTestIso();
      const vfs = IsoVfs.fromUint8Array(isoData);

      const entry = await vfs.open('/TEST.TXT', OpenFlags.Read);
      const stat = await entry!.stat();

      expect(stat.mode).toBe(FileMode.File);
      expect(stat.size).toBe(13);
      expect(stat.mtime).toBeInstanceOf(Date);
    });
  });
});
