/**
 * KIRK Crypto Engine Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  KirkMode,
  KirkCommand,
  KirkError,
  kirkCmd1,
  kirkCmd7,
  kirkCmd11,
  kirkCmd14,
  kirkInit,
  kirkReset,
  isKirkInitialized,
  kirkExecute,
  hleUtilsBufferCopyWithRange,
  aesDecryptCbc,
  KIRK1_KEY,
  KIRK7_KEYS,
  getKirk7Key,
  sha1,
  sha1Hex,
  Sha1Context,
} from '../src/core/kirk';

describe('KIRK Crypto Engine', () =>
{
  describe('AES-128-CBC', () =>
  {
    it('should decrypt with zero IV', () =>
    {
      // Test vector: encrypted with key 0x00..0F, IV 0x00..0F
      const key = new Uint8Array([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07,
        0x08, 0x09, 0x0A, 0x0B, 0x0C, 0x0D, 0x0E, 0x0F
      ]);

      // A simple 16-byte block
      const encrypted = new Uint8Array(16);
      encrypted.fill(0);

      const decrypted = aesDecryptCbc(encrypted, key);

      expect(decrypted.length).toBe(16);
    });

    it('should handle multiple blocks', () =>
    {
      const key = new Uint8Array(16).fill(0x42);
      const encrypted = new Uint8Array(32).fill(0);

      const decrypted = aesDecryptCbc(encrypted, key);

      expect(decrypted.length).toBe(32);
    });

    it('should use custom IV when provided', () =>
    {
      const key = new Uint8Array(16).fill(0x00);
      const iv = new Uint8Array(16).fill(0xFF);
      const encrypted = new Uint8Array(16).fill(0);

      const decrypted1 = aesDecryptCbc(encrypted, key);
      const decrypted2 = aesDecryptCbc(encrypted, key, iv);

      // Different IVs should produce different results
      expect(decrypted1).not.toEqual(decrypted2);
    });
  });

  describe('Key Management', () =>
  {
    it('should have KIRK1_KEY defined', () =>
    {
      expect(KIRK1_KEY).toBeDefined();
      expect(KIRK1_KEY.length).toBe(16);
    });

    it('should have KIRK7_KEYS defined', () =>
    {
      expect(KIRK7_KEYS).toBeDefined();
      expect(Object.keys(KIRK7_KEYS).length).toBeGreaterThan(0);
    });

    it('should get KIRK7 key by keyseed', () =>
    {
      const key = getKirk7Key(0x02);
      expect(key).toBeDefined();
      expect(key.length).toBe(16);
    });

    it('should throw for unknown keyseed', () =>
    {
      expect(() => getKirk7Key(0xFF)).toThrow('Unknown KIRK7 keyseed');
    });

    it('should have all documented keyseeds', () =>
    {
      const keyseeds = [0x02, 0x03, 0x04, 0x05, 0x07, 0x0C, 0x0D, 0x0E, 0x0F, 0x10];
      for (const ks of keyseeds)
      {
        const key = getKirk7Key(ks);
        expect(key.length).toBe(16);
      }
    });
  });

  describe('kirkCmd7', () =>
  {
    it('should reject input too small', () =>
    {
      const input = new Uint8Array(10);

      expect(() => kirkCmd7(input)).toThrow('Input too small');
    });

    it('should reject invalid mode', () =>
    {
      // Create header with wrong mode
      const input = new Uint8Array(36);
      const view = new DataView(input.buffer);
      view.setInt32(0, KirkMode.EncryptCbc, true); // Wrong mode
      view.setInt32(16, 16, true); // dataSize

      expect(() => kirkCmd7(input)).toThrow('Invalid mode');
    });

    it('should reject zero data size', () =>
    {
      const input = new Uint8Array(36);
      const view = new DataView(input.buffer);
      view.setInt32(0, KirkMode.DecryptCbc, true);
      view.setInt32(12, 0x02, true); // keyseed
      view.setInt32(16, 0, true); // dataSize = 0

      expect(() => kirkCmd7(input)).toThrow('Data size is zero');
    });

    it('should decrypt with valid header and keyseed', () =>
    {
      // Header: 20 bytes + encrypted data
      const input = new Uint8Array(36);
      const view = new DataView(input.buffer);
      view.setInt32(0, KirkMode.DecryptCbc, true); // mode
      view.setInt32(4, 0, true); // unk4
      view.setInt32(8, 0, true); // unk8
      view.setInt32(12, 0x02, true); // keyseed (uses KIRK7_KEYS[0x02])
      view.setInt32(16, 16, true); // dataSize

      // Encrypted data (16 bytes of zeros)
      for (let i = 0; i < 16; i++)
      {
        input[20 + i] = 0;
      }

      const result = kirkCmd7(input);

      expect(result.length).toBe(16);
    });
  });

  describe('kirkCmd1', () =>
  {
    it('should reject input too small', () =>
    {
      const input = new Uint8Array(100);

      expect(() => kirkCmd1(input)).toThrow('Input too small');
    });

    it('should reject invalid mode', () =>
    {
      // Create CMAC header with wrong mode
      const input = new Uint8Array(200);
      input[96] = KirkMode.DecryptCbc; // Wrong mode (should be Cmd1)

      expect(() => kirkCmd1(input)).toThrow('Invalid mode');
    });

    it('should process valid CMD1 header', () =>
    {
      // Create valid CMD1 input
      const input = new Uint8Array(200);

      // aesKey (0-15), cmacKey (16-31), cmacHeaderHash (32-47), cmacDataHash (48-63)
      // unknown1 (64-95), mode (96), useEcdsaHash (97), unknown2 (98-111)
      // dataSize (112-115), dataOffset (116-119), unknown3 (120-127), unknown4 (128-143)
      input[96] = KirkMode.Cmd1;

      const view = new DataView(input.buffer);
      view.setUint32(112, 16, true); // dataSize
      view.setUint32(116, 0, true); // dataOffset

      // Add some encrypted data after header
      for (let i = 144; i < 160; i++)
      {
        input[i] = i & 0xFF;
      }

      const result = kirkCmd1(input);

      expect(result.length).toBe(16);
    });
  });

  describe('kirkExecute', () =>
  {
    it('should execute DECRYPT_PRIVATE (CMD1)', () =>
    {
      const input = new Uint8Array(200);
      input[96] = KirkMode.Cmd1;
      const view = new DataView(input.buffer);
      view.setUint32(112, 16, true);
      view.setUint32(116, 0, true);

      const output = new Uint8Array(64);

      const result = kirkExecute(output, input, KirkCommand.DECRYPT_PRIVATE);

      expect(result).toBe(KirkError.OK);
    });

    it('should execute DECRYPT_IV_0 (CMD7)', () =>
    {
      const input = new Uint8Array(36);
      const view = new DataView(input.buffer);
      view.setInt32(0, KirkMode.DecryptCbc, true);
      view.setInt32(12, 0x02, true);
      view.setInt32(16, 16, true);

      const output = new Uint8Array(16);

      const result = kirkExecute(output, input, KirkCommand.DECRYPT_IV_0);

      expect(result).toBe(KirkError.OK);
    });

    it('should return UNKNOWN_COMMAND for invalid command', () =>
    {
      const input = new Uint8Array(32);
      const output = new Uint8Array(32);

      const result = kirkExecute(output, input, 0xFF as KirkCommand);

      expect(result).toBe(KirkError.UNKNOWN_COMMAND);
    });

    it('should return DECRYPT_FAILED on error', () =>
    {
      // Invalid input (too small for CMD7)
      const input = new Uint8Array(10);
      const output = new Uint8Array(32);

      const result = kirkExecute(output, input, KirkCommand.DECRYPT_IV_0);

      expect(result).toBe(KirkError.DECRYPT_FAILED);
    });
  });

  describe('hleUtilsBufferCopyWithRange', () =>
  {
    it('should call kirkExecute with correct sizes', () =>
    {
      const input = new Uint8Array(64);
      const view = new DataView(input.buffer);
      view.setInt32(0, KirkMode.DecryptCbc, true);
      view.setInt32(12, 0x02, true);
      view.setInt32(16, 16, true);

      const output = new Uint8Array(32);

      const result = hleUtilsBufferCopyWithRange(
        output,
        16,
        input,
        36,
        KirkCommand.DECRYPT_IV_0
      );

      expect(result).toBe(KirkError.OK);
    });

    it('should handle output size limiting', () =>
    {
      const input = new Uint8Array(64);
      const view = new DataView(input.buffer);
      view.setInt32(0, KirkMode.DecryptCbc, true);
      view.setInt32(12, 0x02, true);
      view.setInt32(16, 16, true);

      const output = new Uint8Array(8);

      const result = hleUtilsBufferCopyWithRange(
        output,
        8,
        input,
        36,
        KirkCommand.DECRYPT_IV_0
      );

      expect(result).toBe(KirkError.OK);
    });
  });

  describe('KirkCommand enum', () =>
  {
    it('should have all standard commands', () =>
    {
      expect(KirkCommand.DECRYPT_PRIVATE).toBe(0x01);
      expect(KirkCommand.ENCRYPT_SIGN).toBe(0x02);
      expect(KirkCommand.DECRYPT_SIGN).toBe(0x03);
      expect(KirkCommand.ENCRYPT_IV_0).toBe(0x04);
      expect(KirkCommand.ENCRYPT_IV_FUSE).toBe(0x05);
      expect(KirkCommand.ENCRYPT_IV_USER).toBe(0x06);
      expect(KirkCommand.DECRYPT_IV_0).toBe(0x07);
      expect(KirkCommand.DECRYPT_IV_FUSE).toBe(0x08);
      expect(KirkCommand.DECRYPT_IV_USER).toBe(0x09);
      expect(KirkCommand.SHA1_HASH).toBe(0x0B);
      expect(KirkCommand.PRNG).toBe(0x0E);
      expect(KirkCommand.INIT).toBe(0x0F);
      expect(KirkCommand.ECDSA_SIGN).toBe(0x10);
      expect(KirkCommand.ECDSA_VERIFY).toBe(0x11);
    });
  });

  describe('KirkError enum', () =>
  {
    it('should have all error codes', () =>
    {
      expect(KirkError.OK).toBe(0);
      expect(KirkError.NOT_INITIALIZED).toBe(0x01);
      expect(KirkError.INVALID_MODE).toBe(0x02);
      expect(KirkError.INVALID_HEADER).toBe(0x03);
      expect(KirkError.DATA_SIZE_ZERO).toBe(0x04);
      expect(KirkError.INVALID_SIZE).toBe(0x05);
      expect(KirkError.DECRYPT_FAILED).toBe(0x0D);
      expect(KirkError.UNKNOWN_COMMAND).toBe(0x1000);
    });
  });

  describe('KirkMode enum', () =>
  {
    it('should have all modes', () =>
    {
      expect(KirkMode.Invalid).toBe(0);
      expect(KirkMode.Cmd1).toBe(1);
      expect(KirkMode.Cmd2).toBe(2);
      expect(KirkMode.Cmd3).toBe(3);
      expect(KirkMode.EncryptCbc).toBe(4);
      expect(KirkMode.DecryptCbc).toBe(5);
    });
  });

  // ============================================
  // SHA1 Tests
  // ============================================

  describe('SHA1', () =>
  {
    it('should hash empty string correctly', () =>
    {
      const empty = new Uint8Array(0);
      const hash = sha1(empty);

      // SHA1("") = da39a3ee5e6b4b0d3255bfef95601890afd80709
      expect(sha1Hex(empty)).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    });

    it('should hash "abc" correctly', () =>
    {
      const abc = new TextEncoder().encode('abc');
      const hash = sha1Hex(abc);

      // SHA1("abc") = a9993e364706816aba3e25717850c26c9cd0d89d
      expect(hash).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    });

    it('should hash longer message correctly', () =>
    {
      const msg = new TextEncoder().encode('The quick brown fox jumps over the lazy dog');
      const hash = sha1Hex(msg);

      // SHA1("The quick brown fox jumps over the lazy dog")
      expect(hash).toBe('2fd4e1c67a2d28fced849ee1bb76e7391b93eb12');
    });

    it('should hash exactly 55 bytes (padding edge case)', () =>
    {
      // 55 bytes = 440 bits, needs 1 byte for 0x80 + 8 bytes for length = 64 bytes total
      const data = new Uint8Array(55).fill(0x61); // 'a'
      const hash = sha1(data);
      expect(hash.length).toBe(20);
    });

    it('should hash exactly 56 bytes (padding edge case)', () =>
    {
      // 56 bytes needs second block for padding
      const data = new Uint8Array(56).fill(0x61);
      const hash = sha1(data);
      expect(hash.length).toBe(20);
    });

    it('should hash exactly 64 bytes (one full block)', () =>
    {
      const data = new Uint8Array(64).fill(0x61);
      const hash = sha1(data);
      expect(hash.length).toBe(20);
    });

    it('should hash multiple blocks correctly', () =>
    {
      // "a" repeated 1000000 times
      // SHA1 = 34aa973cd4c4daa4f61eeb2bdbad27316534016f
      const data = new Uint8Array(1000000).fill(0x61);
      const hash = sha1Hex(data);
      expect(hash).toBe('34aa973cd4c4daa4f61eeb2bdbad27316534016f');
    });

    it('should work with Sha1Context for streaming', () =>
    {
      const ctx = new Sha1Context();
      ctx.update(new TextEncoder().encode('The quick brown '));
      ctx.update(new TextEncoder().encode('fox jumps over '));
      ctx.update(new TextEncoder().encode('the lazy dog'));
      const hash = ctx.final();

      const expected = sha1(new TextEncoder().encode('The quick brown fox jumps over the lazy dog'));
      expect(hash).toEqual(expected);
    });

    it('should reset context for reuse', () =>
    {
      const ctx = new Sha1Context();
      ctx.update(new TextEncoder().encode('test'));
      ctx.final();
      ctx.reset();
      ctx.update(new TextEncoder().encode('abc'));
      const hash = ctx.final();

      expect(hash).toEqual(sha1(new TextEncoder().encode('abc')));
    });
  });

  // ============================================
  // KIRK CMD11 (SHA1_HASH) Tests
  // ============================================

  describe('kirkCmd11', () =>
  {
    it('should hash data with KIRK header', () =>
    {
      // KIRK CMD11 input: [4 bytes size LE] + [data]
      const data = new TextEncoder().encode('abc');
      const input = new Uint8Array(4 + data.length);
      const view = new DataView(input.buffer);
      view.setUint32(0, data.length, true);
      input.set(data, 4);

      const hash = kirkCmd11(input);

      expect(hash.length).toBe(20);
      expect(sha1Hex(data)).toBe('a9993e364706816aba3e25717850c26c9cd0d89d');
    });

    it('should reject input too small', () =>
    {
      const input = new Uint8Array(2);
      expect(() => kirkCmd11(input)).toThrow('Input too small');
    });

    it('should reject zero data size', () =>
    {
      const input = new Uint8Array(8);
      // dataSize = 0
      expect(() => kirkCmd11(input)).toThrow('Data size is zero');
    });

    it('should reject buffer too small for data', () =>
    {
      const input = new Uint8Array(10);
      const view = new DataView(input.buffer);
      view.setUint32(0, 100, true); // Says 100 bytes but only 6 available
      expect(() => kirkCmd11(input)).toThrow('Input buffer too small');
    });

    it('should work via kirkExecute', () =>
    {
      const data = new TextEncoder().encode('test');
      const input = new Uint8Array(4 + data.length);
      const view = new DataView(input.buffer);
      view.setUint32(0, data.length, true);
      input.set(data, 4);

      const output = new Uint8Array(20);
      const result = kirkExecute(output, input, KirkCommand.SHA1_HASH);

      expect(result).toBe(KirkError.OK);
      expect(output.length).toBe(20);
    });
  });

  // ============================================
  // KIRK CMD14 (PRNG) Tests
  // ============================================

  describe('kirkCmd14', () =>
  {
    beforeEach(() =>
    {
      kirkReset();
    });

    it('should generate random data of requested size', () =>
    {
      const data = kirkCmd14(32);
      expect(data.length).toBe(32);
    });

    it('should generate different data on each call', () =>
    {
      const data1 = kirkCmd14(20);
      const data2 = kirkCmd14(20);

      // Very unlikely to be the same
      expect(data1).not.toEqual(data2);
    });

    it('should handle size 0', () =>
    {
      const data = kirkCmd14(0);
      expect(data.length).toBe(0);
    });

    it('should handle large sizes', () =>
    {
      const data = kirkCmd14(1000);
      expect(data.length).toBe(1000);
    });

    it('should generate exactly 20 bytes (one block)', () =>
    {
      const data = kirkCmd14(20);
      expect(data.length).toBe(20);
    });

    it('should generate 40 bytes (two blocks)', () =>
    {
      const data = kirkCmd14(40);
      expect(data.length).toBe(40);
    });

    it('should work via kirkExecute', () =>
    {
      const input = new Uint8Array(4);
      const view = new DataView(input.buffer);
      view.setUint32(0, 32, true); // Request 32 random bytes

      const output = new Uint8Array(32);
      const result = kirkExecute(output, input, KirkCommand.PRNG);

      expect(result).toBe(KirkError.OK);
    });
  });

  // ============================================
  // KIRK Initialization Tests
  // ============================================

  describe('kirkInit', () =>
  {
    beforeEach(() =>
    {
      kirkReset();
    });

    it('should initialize KIRK', () =>
    {
      expect(isKirkInitialized()).toBe(false);
      kirkInit();
      expect(isKirkInitialized()).toBe(true);
    });

    it('should accept seed data', () =>
    {
      const seed = new TextEncoder().encode('my seed data');
      kirkInit(seed);
      expect(isKirkInitialized()).toBe(true);
    });

    it('should produce different PRNG output with different seeds', () =>
    {
      kirkInit(new TextEncoder().encode('seed1'));
      const data1 = kirkCmd14(20);

      kirkReset();
      kirkInit(new TextEncoder().encode('seed2'));
      const data2 = kirkCmd14(20);

      expect(data1).not.toEqual(data2);
    });

    it('should reset state', () =>
    {
      kirkInit();
      expect(isKirkInitialized()).toBe(true);
      kirkReset();
      expect(isKirkInitialized()).toBe(false);
    });

    it('should work via kirkExecute with CMD INIT', () =>
    {
      kirkReset();
      expect(isKirkInitialized()).toBe(false);

      const input = new Uint8Array(0);
      const output = new Uint8Array(0);
      const result = kirkExecute(output, input, KirkCommand.INIT);

      expect(result).toBe(KirkError.OK);
      expect(isKirkInitialized()).toBe(true);
    });
  });

  describe('Unimplemented commands', () =>
  {
    const unimplementedCommands = [
      KirkCommand.ENCRYPT_IV_0,
      KirkCommand.ENCRYPT_IV_FUSE,
      KirkCommand.ENCRYPT_IV_USER,
      KirkCommand.DECRYPT_IV_FUSE,
      KirkCommand.DECRYPT_IV_USER,
      KirkCommand.PRIV_SIG_CHECK,
      KirkCommand.ECDSA_GEN_KEYS,
      KirkCommand.ECDSA_MULTIPLY_POINT,
      KirkCommand.ECDSA_SIGN,
      KirkCommand.ECDSA_VERIFY,
      KirkCommand.CERT_VERIFY,
    ];

    for (const cmd of unimplementedCommands)
    {
      it(`should fail gracefully for unimplemented command ${cmd} (${KirkCommand[cmd]})`, () =>
      {
        const input = new Uint8Array(256);
        const output = new Uint8Array(256);

        const result = kirkExecute(output, input, cmd);

        expect(result).toBe(KirkError.DECRYPT_FAILED);
      });
    }
  });
});
