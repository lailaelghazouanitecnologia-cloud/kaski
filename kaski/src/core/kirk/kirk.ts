/**
 * KIRK Crypto Engine
 *
 * Implementation of the PSP's KIRK (Keyed Reencryption Implement for
 * Cryptographic Kits) hardware crypto engine.
 *
 * KIRK handles encryption, decryption, signing, and verification
 * of PSP firmware and game content.
 */

import { aesDecryptCbc } from './aes';
import { KIRK1_KEY, getKirk7Key } from './keys';

/**
 * KIRK operation modes
 */
export const enum KirkMode
{
  Invalid = 0,
  Cmd1 = 1,      // Master decryption with CMAC
  Cmd2 = 2,      // Key type 3 encryption
  Cmd3 = 3,      // Key type 3 decryption
  EncryptCbc = 4,
  DecryptCbc = 5,
}

/**
 * KIRK commands
 */
export const enum KirkCommand
{
  /** Master decryption with CMAC checking and ECDSA signature */
  DECRYPT_PRIVATE = 0x01,

  /** Encrypt + ECDSA sign for key type 3 */
  ENCRYPT_SIGN = 0x02,

  /** Decrypt + ECDSA sign for key type 3 */
  DECRYPT_SIGN = 0x03,

  /** Key table-based encryption (IV=0) */
  ENCRYPT_IV_0 = 0x04,

  /** Fuse ID-based encryption */
  ENCRYPT_IV_FUSE = 0x05,

  /** User-defined ID encryption */
  ENCRYPT_IV_USER = 0x06,

  /** Key table-based decryption (IV=0) */
  DECRYPT_IV_0 = 0x07,

  /** Fuse ID-based decryption */
  DECRYPT_IV_FUSE = 0x08,

  /** User-defined ID decryption */
  DECRYPT_IV_USER = 0x09,

  /** Private SCE signature checking */
  PRIV_SIG_CHECK = 0x0A,

  /** SHA1 hash generation */
  SHA1_HASH = 0x0B,

  /** ECDSA key pair generation */
  ECDSA_GEN_KEYS = 0x0C,

  /** ECC point multiplication */
  ECDSA_MULTIPLY_POINT = 0x0D,

  /** Random number generation */
  PRNG = 0x0E,

  /** KIRK initialization */
  INIT = 0x0F,

  /** ECDSA signing */
  ECDSA_SIGN = 0x10,

  /** ECDSA signature verification */
  ECDSA_VERIFY = 0x11,

  /** Certificate verification */
  CERT_VERIFY = 0x12,
}

/**
 * KIRK error codes
 */
export const enum KirkError
{
  OK = 0,
  NOT_INITIALIZED = 0x01,
  INVALID_MODE = 0x02,
  INVALID_HEADER = 0x03,
  DATA_SIZE_ZERO = 0x04,
  INVALID_SIZE = 0x05,
  DATA_SIZE_MISMATCH = 0x0C,
  DECRYPT_FAILED = 0x0D,
  INVALID_SIG_CHECK = 0x0E,
  HEADER_HASH_INVALID = 0x0F,
  DATA_HASH_INVALID = 0x10,
  SIG_CHECK_INVALID = 0x11,
  NOT_ENABLED = 0x12,
  UNKNOWN_COMMAND = 0x1000,
}

/**
 * KIRK AES128 CBC header structure
 * Used for CMD4-CMD9
 */
export interface KirkAes128CbcHeader
{
  mode: KirkMode;
  unk4: number;
  unk8: number;
  keyseed: number;
  dataSize: number;
}

/**
 * KIRK AES128 CMAC header structure
 * Used for CMD1
 */
export interface KirkAes128CmacHeader
{
  aesKey: Uint8Array;      // 16 bytes
  cmacKey: Uint8Array;     // 16 bytes
  cmacHeaderHash: Uint8Array; // 16 bytes
  cmacDataHash: Uint8Array;   // 16 bytes
  unknown1: Uint8Array;    // 32 bytes
  mode: KirkMode;
  useEcdsaHash: number;
  unknown2: Uint8Array;    // 14 bytes
  dataSize: number;
  dataOffset: number;
  unknown3: Uint8Array;    // 8 bytes
  unknown4: Uint8Array;    // 16 bytes
}

const AES128_CBC_HEADER_SIZE = 20;  // 5 * 4 bytes
const AES128_CMAC_HEADER_SIZE = 144; // 0x90 bytes

/**
 * Parse KIRK AES128 CBC header from data
 */
function parseAes128CbcHeader(data: Uint8Array): KirkAes128CbcHeader
{
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  return {
    mode: view.getInt32(0, true) as KirkMode,
    unk4: view.getInt32(4, true),
    unk8: view.getInt32(8, true),
    keyseed: view.getInt32(12, true),
    dataSize: view.getInt32(16, true),
  };
}

/**
 * Parse KIRK AES128 CMAC header from data
 */
function parseAes128CmacHeader(data: Uint8Array): KirkAes128CmacHeader
{
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  return {
    aesKey: data.slice(0, 16),
    cmacKey: data.slice(16, 32),
    cmacHeaderHash: data.slice(32, 48),
    cmacDataHash: data.slice(48, 64),
    unknown1: data.slice(64, 96),
    mode: view.getUint8(96) as KirkMode,
    useEcdsaHash: view.getUint8(97),
    unknown2: data.slice(98, 112),
    dataSize: view.getUint32(112, true),
    dataOffset: view.getUint32(116, true),
    unknown3: data.slice(120, 128),
    unknown4: data.slice(128, 144),
  };
}

/**
 * KIRK CMD7: Decrypt using key table (IV=0)
 *
 * Decrypts data using AES-128-CBC with a key from the key table.
 */
export function kirkCmd7(input: Uint8Array): Uint8Array
{
  if (input.length < AES128_CBC_HEADER_SIZE)
  {
    throw new Error(`KIRK CMD7: Input too small (${input.length} < ${AES128_CBC_HEADER_SIZE})`);
  }

  const header = parseAes128CbcHeader(input);

  if (header.mode !== KirkMode.DecryptCbc)
  {
    throw new Error(`KIRK CMD7: Invalid mode ${header.mode} (expected ${KirkMode.DecryptCbc})`);
  }

  if (header.dataSize === 0)
  {
    throw new Error('KIRK CMD7: Data size is zero');
  }

  const key = getKirk7Key(header.keyseed);
  const encryptedData = input.slice(AES128_CBC_HEADER_SIZE, AES128_CBC_HEADER_SIZE + header.dataSize);

  // Pad to 16-byte boundary if needed
  const paddedSize = (encryptedData.length + 15) & ~15;
  let dataToDecrypt = encryptedData;
  if (paddedSize > encryptedData.length)
  {
    dataToDecrypt = new Uint8Array(paddedSize);
    dataToDecrypt.set(encryptedData);
  }

  return aesDecryptCbc(dataToDecrypt, key);
}

/**
 * KIRK CMD1: Master decryption with CMAC checking
 *
 * Decrypts firmware and game content with CMAC verification.
 */
export function kirkCmd1(input: Uint8Array): Uint8Array
{
  if (input.length < AES128_CMAC_HEADER_SIZE)
  {
    throw new Error(`KIRK CMD1: Input too small (${input.length} < ${AES128_CMAC_HEADER_SIZE})`);
  }

  const header = parseAes128CmacHeader(input);

  if (header.mode !== KirkMode.Cmd1)
  {
    throw new Error(`KIRK CMD1: Invalid mode ${header.mode} (expected ${KirkMode.Cmd1})`);
  }

  // Decrypt the AES and CMAC keys using master key
  const encryptedKeys = input.slice(0, 32);
  const keys = aesDecryptCbc(encryptedKeys, KIRK1_KEY);

  const aesKey = keys.slice(0, 16);
  // const cmacKey = keys.slice(16, 32); // Used for CMAC verification

  // TODO: Verify CMAC hashes (skipped for now)
  // if (header.useEcdsaHash !== 1) {
  //   // Verify CMAC
  // }

  // Calculate padded data size (16-byte aligned)
  const paddedDataSize = (header.dataSize + 15) & ~15;

  // Get encrypted data
  const dataStart = AES128_CMAC_HEADER_SIZE + header.dataOffset;
  const encryptedData = input.slice(dataStart, dataStart + paddedDataSize);

  // Decrypt data
  const decrypted = aesDecryptCbc(encryptedData, aesKey);

  // Return only the actual data size
  return decrypted.slice(0, header.dataSize);
}

/**
 * Execute KIRK command
 *
 * @param output - Output buffer
 * @param input - Input buffer
 * @param command - KIRK command to execute
 * @returns Error code
 */
export function kirkExecute(
  output: Uint8Array,
  input: Uint8Array,
  command: KirkCommand
): KirkError
{
  try
  {
    let result: Uint8Array;

    switch (command)
    {
      case KirkCommand.DECRYPT_PRIVATE:
        result = kirkCmd1(input);
        break;

      case KirkCommand.DECRYPT_IV_0:
        result = kirkCmd7(input);
        break;

      // TODO: Implement other commands
      case KirkCommand.ENCRYPT_IV_0:
      case KirkCommand.ENCRYPT_IV_FUSE:
      case KirkCommand.ENCRYPT_IV_USER:
      case KirkCommand.DECRYPT_IV_FUSE:
      case KirkCommand.DECRYPT_IV_USER:
      case KirkCommand.PRIV_SIG_CHECK:
      case KirkCommand.SHA1_HASH:
      case KirkCommand.ECDSA_GEN_KEYS:
      case KirkCommand.ECDSA_MULTIPLY_POINT:
      case KirkCommand.PRNG:
      case KirkCommand.ECDSA_SIGN:
      case KirkCommand.ECDSA_VERIFY:
      case KirkCommand.CERT_VERIFY:
        throw new Error(`KIRK command ${command} (${KirkCommand[command]}) not implemented`);

      default:
        return KirkError.UNKNOWN_COMMAND;
    }

    // Copy result to output
    output.set(result.slice(0, output.length));

    return KirkError.OK;
  }
  catch (e)
  {
    console.error('KIRK error:', e);
    return KirkError.DECRYPT_FAILED;
  }
}

/**
 * HLE implementation of sceUtilsBufferCopyWithRange
 *
 * This is the main syscall interface for KIRK operations.
 */
export function hleUtilsBufferCopyWithRange(
  output: Uint8Array,
  outputSize: number,
  input: Uint8Array,
  inputSize: number,
  command: KirkCommand
): number
{
  const outBuffer = output.slice(0, outputSize);
  const inBuffer = input.slice(0, inputSize);

  return kirkExecute(outBuffer, inBuffer, command);
}
