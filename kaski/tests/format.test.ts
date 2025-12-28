import { describe, it, expect } from 'bun:test';
import {
  Stream,
  detectFormat, FileFormat,
  ElfFile, ELF_MAGIC,
  PsfFile, PSF_KEYS,
  PbpFile, PbpEntry,
} from '../src/format';

describe('Stream', () =>
{
  it('should read integers', () =>
  {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const stream = Stream.fromUint8Array(data);

    expect(stream.readUint8()).toBe(0x01);
    expect(stream.readUint16()).toBe(0x0302); // Little-endian
    expect(stream.position).toBe(3);

    stream.seek(0);
    expect(stream.readUint32()).toBe(0x04030201);
  });

  it('should read strings', () =>
  {
    const data = new TextEncoder().encode('Hello\0World');
    const stream = Stream.fromUint8Array(data);

    expect(stream.readStringZ()).toBe('Hello');
    expect(stream.readString(5)).toBe('World');
  });

  it('should slice streams', () =>
  {
    const data = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    const stream = Stream.fromUint8Array(data);

    stream.seek(2);
    const slice = stream.slice(4);

    expect(slice.length).toBe(4);
    expect(slice.readUint8()).toBe(2);
    expect(slice.readUint8()).toBe(3);
  });

  it('should check magic bytes', () =>
  {
    const elfData = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0, 0, 0, 0]);
    const stream = Stream.fromUint8Array(elfData);

    expect(stream.checkMagic([0x7F, 0x45, 0x4C, 0x46])).toBe(true);
    expect(stream.checkMagic('ELF')).toBe(false); // Missing 0x7F
  });

  it('should peek without advancing position', () =>
  {
    const data = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const stream = Stream.fromUint8Array(data);

    expect(stream.peekUint8(0)).toBe(0x01);
    expect(stream.peekUint8(1)).toBe(0x02);
    expect(stream.peekUint16(0)).toBe(0x0201);
    expect(stream.position).toBe(0); // Position unchanged
  });
});

describe('Format Detection', () =>
{
  it('should detect ELF files', () =>
  {
    const elfData = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 1, 1, 1, 0]);
    const stream = Stream.fromUint8Array(elfData);

    expect(detectFormat(stream)).toBe(FileFormat.ELF);
  });

  it('should detect PBP files', () =>
  {
    const pbpData = new Uint8Array([0x00, 0x50, 0x42, 0x50, 0, 0, 1, 0]);
    const stream = Stream.fromUint8Array(pbpData);

    expect(detectFormat(stream)).toBe(FileFormat.PBP);
  });

  it('should detect PSF files', () =>
  {
    const psfData = new Uint8Array([0x00, 0x50, 0x53, 0x46, 1, 1, 0, 0]);
    const stream = Stream.fromUint8Array(psfData);

    expect(detectFormat(stream)).toBe(FileFormat.PSF);
  });

  it('should detect CSO files', () =>
  {
    const csoData = new TextEncoder().encode('CISO\0\0\0\0');
    const stream = Stream.fromUint8Array(csoData);

    expect(detectFormat(stream)).toBe(FileFormat.CSO);
  });

  it('should return UNKNOWN for unrecognized formats', () =>
  {
    const unknownData = new Uint8Array([0x12, 0x34, 0x56, 0x78]);
    const stream = Stream.fromUint8Array(unknownData);

    expect(detectFormat(stream)).toBe(FileFormat.UNKNOWN);
  });
});

describe('ELF', () =>
{
  it('should validate ELF magic constant', () =>
  {
    expect(ELF_MAGIC).toEqual([0x7F, 0x45, 0x4C, 0x46]);
  });

  it('should throw on invalid ELF', () =>
  {
    const invalidData = new Uint8Array([0x00, 0x00, 0x00, 0x00]);

    expect(() => ElfFile.fromUint8Array(invalidData)).toThrow('Invalid ELF magic');
  });

  it('should parse minimal ELF header', () =>
  {
    // Create minimal valid ELF32 header for MIPS
    const elf = new Uint8Array(52);
    const view = new DataView(elf.buffer);

    // ELF magic
    elf[0] = 0x7F; elf[1] = 0x45; elf[2] = 0x4C; elf[3] = 0x46;
    elf[4] = 1;    // 32-bit
    elf[5] = 1;    // Little-endian
    elf[6] = 1;    // Version

    // Type, machine
    view.setUint16(16, 2, true);    // ET_EXEC
    view.setUint16(18, 8, true);    // MIPS
    view.setUint32(20, 1, true);    // Version
    view.setUint32(24, 0x08800000, true); // Entry point
    view.setUint32(28, 52, true);   // PH offset
    view.setUint32(32, 0, true);    // SH offset
    view.setUint32(36, 0, true);    // Flags
    view.setUint16(40, 52, true);   // EH size
    view.setUint16(42, 32, true);   // PH entry size
    view.setUint16(44, 0, true);    // PH count
    view.setUint16(46, 40, true);   // SH entry size
    view.setUint16(48, 0, true);    // SH count
    view.setUint16(50, 0, true);    // SH string index

    const elfFile = ElfFile.fromUint8Array(elf);

    expect(elfFile.header.entry).toBe(0x08800000);
    expect(elfFile.header.machine).toBe(8); // MIPS
    expect(elfFile.isPrx).toBe(false);
  });
});

describe('PSF', () =>
{
  it('should parse PSF file', () =>
  {
    // Create minimal PSF with one string entry
    const buffer = new ArrayBuffer(100);
    const view = new DataView(buffer);
    const u8 = new Uint8Array(buffer);

    // Header
    view.setUint32(0, 0x46535000, true);  // Magic "\0PSF"
    view.setUint32(4, 0x0101, true);      // Version
    view.setUint32(8, 20 + 16, true);     // Key table offset (after header + 1 index)
    view.setUint32(12, 20 + 16 + 8, true);// Data table offset
    view.setUint32(16, 1, true);          // 1 entry

    // Index entry
    view.setUint16(20, 0, true);          // Key offset
    view.setUint8(22, 2);                 // Data format (STRING)
    view.setUint8(23, 0);                 // Padding
    view.setUint32(24, 5, true);          // Data size
    view.setUint32(28, 8, true);          // Data size max
    view.setUint32(32, 0, true);          // Data offset

    // Key table (at offset 36)
    const key = new TextEncoder().encode('TITLE\0');
    u8.set(key, 36);

    // Data table (at offset 44)
    const value = new TextEncoder().encode('Test\0');
    u8.set(value, 44);

    const psf = PsfFile.fromBuffer(buffer);

    expect(psf.entries.size).toBe(1);
    expect(psf.getString('TITLE')).toBe('Test');
  });

  it('should have correct PSF key constants', () =>
  {
    expect(PSF_KEYS.TITLE).toBe('TITLE');
    expect(PSF_KEYS.DISC_ID).toBe('DISC_ID');
    expect(PSF_KEYS.CATEGORY).toBe('CATEGORY');
  });
});

describe('PBP', () =>
{
  it('should parse PBP header', () =>
  {
    // Create minimal PBP with just header
    const buffer = new ArrayBuffer(40);
    const view = new DataView(buffer);

    // Header
    view.setUint32(0, 0x50425000, true);  // Magic "\0PBP"
    view.setUint32(4, 0x00010000, true);  // Version

    // All offsets point to end of header (no data)
    for (let i = 0; i < 8; i++)
    {
      view.setUint32(8 + i * 4, 40, true);
    }

    const pbp = PbpFile.fromBuffer(buffer);

    expect(pbp.header.magic).toBe(0x50425000);
    expect(pbp.entries.length).toBe(8);

    // All entries should have 0 size
    for (const entry of pbp.entries)
    {
      expect(entry.size).toBe(0);
      expect(entry.present).toBe(false);
    }
  });

  it('should have correct entry names', () =>
  {
    expect(PbpEntry.PARAM_SFO).toBe(0);
    expect(PbpEntry.ICON0_PNG).toBe(1);
    expect(PbpEntry.DATA_PSP).toBe(6);
  });
});
