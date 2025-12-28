/**
 * Encrypted PRX Decryption
 *
 * Decrypts PSP encrypted PRX files using KIRK crypto engine.
 * These files have the ~PSP signature and contain encrypted ELF data.
 */

import { Stream } from './stream';
import { getTagInfo, getTagInfo2, TagInfo144 } from './prxKeys';
import { kirkCmd1, kirkCmd7 } from '../core/kirk';

// ============================================
// Constants
// ============================================

const PRX_HEADER_SIZE = 0x150;
const KIRK_AES_CBC_HEADER_SIZE = 20;

/**
 * PSP encrypted file magic: ~PSP (0x7E505350)
 */
export const PRX_MAGIC = 0x5053507E; // '~PSP' little-endian

// ============================================
// PRX Header Structure
// ============================================

/**
 * Encrypted PRX header
 */
export interface PrxHeader
{
  magic: number;
  modAttr: number;
  compModAttr: number;
  modVerLo: number;
  modVerHi: number;
  moduleName: string;
  modVersion: number;
  nsegments: number;
  elfSize: number;
  pspSize: number;
  bootEntry: number;
  modInfoOffset: number;
  bssSize: number;
  segAlign: number[];
  segAddress: number[];
  segSize: number[];
  devkitVersion: number;
  decMode: number;
  overlapSize: number;
  aesKey: Uint8Array;
  cmacKey: Uint8Array;
  cmacHeaderHash: Uint8Array;
  compressedSize: number;
  compressedOffset: number;
  cmacDataHash: Uint8Array;
  tag: number;
  sigcheck: Uint8Array;
  sha1Hash: Uint8Array;
  keyData: Uint8Array;
}

// ============================================
// Detection
// ============================================

/**
 * Check if data is an encrypted PRX file
 */
export function isEncryptedPrx(data: Uint8Array): boolean
{
  if (data.length < 4)
  {
    return false;
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const magic = view.getUint32(0, true);

  return magic === PRX_MAGIC;
}

// ============================================
// Header Parsing
// ============================================

/**
 * Parse encrypted PRX header
 */
export function parsePrxHeader(data: Uint8Array): PrxHeader
{
  if (data.length < PRX_HEADER_SIZE)
  {
    throw new Error(`PRX data too small (${data.length} < ${PRX_HEADER_SIZE})`);
  }

  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);

  // Parse module name (null-terminated, 28 bytes max)
  let moduleName = '';
  for (let i = 0; i < 28; i++)
  {
    const c = data[10 + i];
    if (c === 0) break;
    moduleName += String.fromCharCode(c);
  }

  return {
    magic: view.getUint32(0, true),
    modAttr: view.getUint16(4, true),
    compModAttr: view.getUint16(6, true),
    modVerLo: data[8],
    modVerHi: data[9],
    moduleName,
    modVersion: data[38],
    nsegments: data[39],
    elfSize: view.getUint32(40, true),
    pspSize: view.getUint32(44, true),
    bootEntry: view.getUint32(48, true),
    modInfoOffset: view.getUint32(52, true),
    bssSize: view.getUint32(56, true),
    segAlign: [
      view.getUint16(60, true),
      view.getUint16(62, true),
      view.getUint16(64, true),
      view.getUint16(66, true),
    ],
    segAddress: [
      view.getUint32(68, true),
      view.getUint32(72, true),
      view.getUint32(76, true),
      view.getUint32(80, true),
    ],
    segSize: [
      view.getUint32(84, true),
      view.getUint32(88, true),
      view.getUint32(92, true),
      view.getUint32(96, true),
    ],
    devkitVersion: view.getUint32(108, true),
    decMode: data[112],
    overlapSize: view.getUint16(114, true),
    aesKey: data.slice(116, 132),
    cmacKey: data.slice(132, 148),
    cmacHeaderHash: data.slice(148, 164),
    compressedSize: view.getUint32(176, true),
    compressedOffset: view.getUint32(180, true),
    cmacDataHash: data.slice(192, 208),
    tag: view.getUint32(208, true),
    sigcheck: data.slice(212, 300),
    sha1Hash: data.slice(300, 320),
    keyData: data.slice(320, 336),
  };
}

// ============================================
// Decryption
// ============================================

/**
 * Build KIRK AES-128-CBC header
 */
function buildKirkAesCbcHeader(keyseed: number, dataSize: number): Uint8Array
{
  const header = new Uint8Array(KIRK_AES_CBC_HEADER_SIZE);
  const view = new DataView(header.buffer);

  view.setUint32(0, 5, true);  // mode = DecryptCbc
  view.setUint32(4, 0, true);  // unk4
  view.setUint32(8, 0, true);  // unk8
  view.setUint32(12, keyseed, true);
  view.setUint32(16, dataSize, true);

  return header;
}

/**
 * Decrypt PRX using 144-byte key (g_tagInfo)
 */
function decryptWithTagInfo144(data: Uint8Array, tagInfo: TagInfo144): Uint8Array
{
  const totalSize = data.length;
  const output = new Uint8Array(totalSize);
  output.set(data);

  // Get output size from offset 0xB0
  const outputSizeView = new DataView(data.buffer, data.byteOffset + 0xB0, 4);
  const outputSize = outputSizeView.getUint32(0, true);

  // Clear first 0x150 bytes in output, then set 0x55 pattern for first 0x40
  output.fill(0, 0, 0x150);
  output.fill(0x55, 0, 0x40);

  // Build KIRK header at offset 0x2C
  const kirkHeader = buildKirkAesCbcHeader(tagInfo.code, 0x70);
  output.set(kirkHeader, 0x2C);

  // Build SIG check buffer
  const buffer1 = new Uint8Array(0x150);
  buffer1.set(data.slice(0xD0, 0xD0 + 0x80), 0x00);
  buffer1.set(data.slice(0x80, 0x80 + 0x50), 0x80);
  buffer1.set(data.slice(0x00, 0x00 + 0x80), 0xD0);

  // If codeExtra != 0, perform additional decryption
  if (tagInfo.codeExtra !== 0)
  {
    const buffer2 = new Uint8Array(KIRK_AES_CBC_HEADER_SIZE + 0xA0);
    const buffer2View = new DataView(buffer2.buffer);

    buffer2View.setUint32(0, 5, true);  // mode
    buffer2View.setUint32(4, 0, true);
    buffer2View.setUint32(8, 0, true);
    buffer2View.setUint32(12, tagInfo.codeExtra, true);
    buffer2View.setUint32(16, 0xA0, true);
    buffer2.set(buffer1.slice(0x10, 0x10 + 0xA0), KIRK_AES_CBC_HEADER_SIZE);

    const decrypted = kirkCmd7(buffer2);
    buffer1.set(decrypted.slice(0, 0xA0), 0);
  }

  // Copy decrypted data to output
  output.set(buffer1.slice(0x40, 0x40 + 0x40), 0x40);

  // XOR with key material at offset 0x14
  for (let i = 0; i < 0x70; i++)
  {
    output[0x40 + i] ^= tagInfo.key[0x14 + i];
  }

  // Decrypt using CMD7
  const decryptInput = new Uint8Array(KIRK_AES_CBC_HEADER_SIZE + 0x70);
  decryptInput.set(output.slice(0x2C, 0x2C + KIRK_AES_CBC_HEADER_SIZE + 0x70));
  const decrypted = kirkCmd7(decryptInput);
  output.set(decrypted, 0x2C);

  // XOR with key material at offset 0x20
  for (let i = 0x6F; i >= 0; i--)
  {
    output[0x40 + i] = output[0x2C + i] ^ tagInfo.key[0x20 + i];
  }

  // Clear and set up for CMD1
  output.fill(0, 0x80, 0x80 + 0x30);
  output[0xA0] = 1;

  // Copy unscrambled parts from header
  output.set(data.slice(0xB0, 0xB0 + 0x20), 0xB0);
  output.set(data.slice(0x00, 0x00 + 0x80), 0xD0);

  // Final decryption using CMD1
  const cmd1Input = output.slice(0x40, totalSize);
  const finalDecrypted = kirkCmd1(cmd1Input);

  // Return decrypted content
  return finalDecrypted.slice(0, outputSize);
}

/**
 * Decrypt encrypted PRX data
 *
 * @param data - Encrypted PRX data
 * @returns Decrypted ELF data
 */
export function decryptPrx(data: Uint8Array): Uint8Array
{
  if (!isEncryptedPrx(data))
  {
    throw new Error('Not an encrypted PRX file');
  }

  const header = parsePrxHeader(data);

  // Try 144-byte key database first
  const tagInfo = getTagInfo(header.tag);
  if (tagInfo)
  {
    return decryptWithTagInfo144(data, tagInfo);
  }

  // Try 16-byte key database
  const tagInfo2 = getTagInfo2(header.tag);
  if (tagInfo2)
  {
    // 16-byte keys use simpler decryption (not implemented yet)
    throw new Error(`Tag 0x${header.tag.toString(16)} uses 16-byte key - not yet implemented`);
  }

  throw new Error(`Unknown PRX tag: 0x${header.tag.toString(16)}`);
}

/**
 * Decrypt PRX if encrypted, otherwise return as-is
 *
 * @param data - PRX data (possibly encrypted)
 * @returns Decrypted ELF data
 */
export function decryptPrxIfNeeded(data: Uint8Array): Uint8Array
{
  if (isEncryptedPrx(data))
  {
    return decryptPrx(data);
  }
  return data;
}
