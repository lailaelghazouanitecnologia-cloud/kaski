/**
 * Encrypted PRX Tests
 */

import { describe, it, expect } from 'vitest';
import {
  isEncryptedPrx,
  PRX_MAGIC,
  parsePrxHeader,
  decryptPrxIfNeeded,
} from '../src/format/prxDecrypt';
import {
  getTagInfo,
  getTagInfo2,
  g_tagInfo,
  g_tagInfo2,
} from '../src/format/prxKeys';

// ============================================
// PRX Detection Tests
// ============================================

describe('PRX Detection', () =>
{
  it('should detect encrypted PRX by magic', () =>
  {
    // ~PSP magic = 0x5053507E
    const data = new Uint8Array([0x7E, 0x50, 0x53, 0x50, 0x00, 0x00, 0x00, 0x00]);
    expect(isEncryptedPrx(data)).toBe(true);
  });

  it('should reject non-PRX data', () =>
  {
    // ELF magic
    const elf = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x00, 0x00, 0x00, 0x00]);
    expect(isEncryptedPrx(elf)).toBe(false);

    // Random data
    const random = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
    expect(isEncryptedPrx(random)).toBe(false);
  });

  it('should reject data too small', () =>
  {
    const small = new Uint8Array([0x7E, 0x50, 0x53]);
    expect(isEncryptedPrx(small)).toBe(false);

    const empty = new Uint8Array(0);
    expect(isEncryptedPrx(empty)).toBe(false);
  });

  it('should have correct PRX_MAGIC constant', () =>
  {
    // ~PSP in little-endian
    expect(PRX_MAGIC).toBe(0x5053507E);
  });
});

// ============================================
// Key Database Tests
// ============================================

describe('PRX Keys', () =>
{
  describe('g_tagInfo (144-byte keys)', () =>
  {
    it('should have entries', () =>
    {
      expect(g_tagInfo.length).toBeGreaterThan(0);
    });

    it('should have keys with correct size', () =>
    {
      for (const entry of g_tagInfo)
      {
        expect(entry.key.length).toBe(144);
      }
    });

    it('should find known tags', () =>
    {
      // 1.x PRX tag
      const tag0 = getTagInfo(0x00000000);
      expect(tag0).toBeDefined();
      expect(tag0!.code).toBe(0x42);

      // 2.x PRX tag
      const tag44 = getTagInfo(0x4467415d);
      expect(tag44).toBeDefined();
      expect(tag44!.code).toBe(0x59);
    });

    it('should return undefined for unknown tags', () =>
    {
      const unknown = getTagInfo(0xFFFFFFFF);
      expect(unknown).toBeUndefined();
    });
  });

  describe('g_tagInfo2 (16-byte keys)', () =>
  {
    it('should have entries', () =>
    {
      expect(g_tagInfo2.length).toBeGreaterThan(0);
    });

    it('should have keys with correct size', () =>
    {
      for (const entry of g_tagInfo2)
      {
        expect(entry.key.length).toBe(16);
      }
    });

    it('should find known tags', () =>
    {
      // 6.20 kernel tag
      const tag620 = getTagInfo2(0x4C941CF0);
      expect(tag620).toBeDefined();
      expect(tag620!.code).toBe(0x43);

      // 5.00 kernel tag
      const tag500 = getTagInfo2(0x4C9418F0);
      expect(tag500).toBeDefined();
      expect(tag500!.code).toBe(0x43);
    });

    it('should return undefined for unknown tags', () =>
    {
      const unknown = getTagInfo2(0xFFFFFFFF);
      expect(unknown).toBeUndefined();
    });
  });
});

// ============================================
// Header Parsing Tests
// ============================================

describe('PRX Header Parsing', () =>
{
  it('should reject data too small', () =>
  {
    const small = new Uint8Array(0x100);
    expect(() => parsePrxHeader(small)).toThrow('PRX data too small');
  });

  it('should parse header fields', () =>
  {
    // Build minimal PRX header
    const data = new Uint8Array(0x200);
    const view = new DataView(data.buffer);

    // Magic
    view.setUint32(0, PRX_MAGIC, true);

    // Module name at offset 10
    const name = 'TestModule';
    for (let i = 0; i < name.length; i++)
    {
      data[10 + i] = name.charCodeAt(i);
    }

    // ELF size at offset 40
    view.setUint32(40, 0x1000, true);

    // Tag at offset 208
    view.setUint32(208, 0x12345678, true);

    const header = parsePrxHeader(data);

    expect(header.magic).toBe(PRX_MAGIC);
    expect(header.moduleName).toBe('TestModule');
    expect(header.elfSize).toBe(0x1000);
    expect(header.tag).toBe(0x12345678);
  });
});

// ============================================
// Decryption Tests
// ============================================

describe('PRX Decryption', () =>
{
  it('should pass through non-encrypted data', () =>
  {
    // ELF file (not encrypted)
    const elf = new Uint8Array([0x7F, 0x45, 0x4C, 0x46, 0x01, 0x01, 0x01, 0x00]);

    const result = decryptPrxIfNeeded(elf);

    expect(result).toBe(elf);
  });

  it('should detect but not decrypt without valid keys', () =>
  {
    // Minimal encrypted PRX with unknown tag
    const data = new Uint8Array(0x200);
    const view = new DataView(data.buffer);

    view.setUint32(0, PRX_MAGIC, true);
    view.setUint32(208, 0xDEADBEEF, true); // Unknown tag

    expect(isEncryptedPrx(data)).toBe(true);
  });
});

// ============================================
// Tag Coverage Tests
// ============================================

describe('Tag Coverage', () =>
{
  it('should cover 1.x PRX tags', () =>
  {
    expect(getTagInfo(0x00000000)).toBeDefined();
    expect(getTagInfo(0x02000000)).toBeDefined();
    expect(getTagInfo(0x03000000)).toBeDefined();
  });

  it('should cover 2.x PRX tags', () =>
  {
    expect(getTagInfo(0x4467415d)).toBeDefined();
    expect(getTagInfo(0x207bbf2f)).toBeDefined();
    expect(getTagInfo(0x3ace4dce)).toBeDefined();
  });

  it('should cover game EBOOT tags', () =>
  {
    expect(getTagInfo(0x08000000)).toBeDefined(); // 1.xx eboot
    expect(getTagInfo(0xC0CB167C)).toBeDefined(); // 2.xx+ eboot
  });

  it('should cover firmware version tags', () =>
  {
    // 2.60-2.71
    expect(getTagInfo2(0x16D59E03)).toBeDefined();

    // 2.80
    expect(getTagInfo2(0xCFEF05F0)).toBeDefined();

    // 3.00
    expect(getTagInfo2(0xCFEF06F0)).toBeDefined();

    // 3.10
    expect(getTagInfo2(0xcfef09f0)).toBeDefined();

    // 5.00
    expect(getTagInfo2(0x4C9418F0)).toBeDefined();

    // 6.20
    expect(getTagInfo2(0x4C941CF0)).toBeDefined();
  });
});
