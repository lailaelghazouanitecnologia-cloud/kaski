/**
 * Format Detection - Identify file formats by magic bytes
 */

import { Stream, AsyncStream } from './stream';

/**
 * Known file formats
 */
export enum FileFormat
{
  UNKNOWN = 'unknown',
  ELF = 'elf',
  PBP = 'pbp',
  PSF = 'psf',
  ISO = 'iso',
  CSO = 'cso',
  ZIP = 'zip',
  DAX = 'dax',
  PSP = 'psp',   // Encrypted
  RIFF = 'riff',
  AT3 = 'at3',
  VAG = 'vag',
  PMF = 'pmf',
}

/**
 * Magic byte patterns for format detection
 */
const MAGIC_PATTERNS: Array<{
  format: FileFormat;
  magic: number[] | string;
  offset?: number;
}> = [
  // Executables
  { format: FileFormat.ELF,  magic: [0x7F, 0x45, 0x4C, 0x46] }, // \x7FELF
  { format: FileFormat.PBP,  magic: [0x00, 0x50, 0x42, 0x50] }, // \0PBP
  { format: FileFormat.PSP,  magic: [0x7E, 0x50, 0x53, 0x50] }, // ~PSP (encrypted)

  // Archives/Containers
  { format: FileFormat.ZIP,  magic: [0x50, 0x4B, 0x03, 0x04] }, // PK\x03\x04
  { format: FileFormat.ZIP,  magic: [0x50, 0x4B, 0x05, 0x06] }, // PK\x05\x06 (empty)

  // Disc images
  { format: FileFormat.CSO,  magic: 'CISO' },
  { format: FileFormat.DAX,  magic: 'DAX\x00' },
  { format: FileFormat.ISO,  magic: 'CD001', offset: 0x8001 }, // At sector 16

  // Data formats
  { format: FileFormat.PSF,  magic: [0x00, 0x50, 0x53, 0x46] }, // \0PSF

  // Audio/Video
  { format: FileFormat.RIFF, magic: 'RIFF' },
  { format: FileFormat.VAG,  magic: 'VAGp' },
  { format: FileFormat.AT3,  magic: 'RIFF' }, // AT3 is RIFF-based, needs deeper check
  { format: FileFormat.PMF,  magic: 'PSMF' },
];

/**
 * Detect format from Stream
 */
export function detectFormat(stream: Stream): FileFormat
{
  const savedPos = stream.position;

  for (const pattern of MAGIC_PATTERNS)
  {
    const offset = pattern.offset ?? 0;

    // Check if we have enough data
    if (stream.length < offset + getMagicLength(pattern.magic))
    {
      continue;
    }

    stream.seek(offset);
    if (stream.checkMagic(pattern.magic))
    {
      stream.seek(savedPos);

      // Special case: distinguish AT3 from other RIFF
      if (pattern.format === FileFormat.RIFF)
      {
        stream.seek(8);
        if (stream.checkMagic('WAVE'))
        {
          stream.seek(savedPos);
          // Could be AT3 or WAV, need deeper check
          return FileFormat.RIFF;
        }
      }

      return pattern.format;
    }
  }

  stream.seek(savedPos);
  return FileFormat.UNKNOWN;
}

/**
 * Detect format from async stream (reads header)
 */
export async function detectFormatAsync(stream: AsyncStream): Promise<FileFormat>
{
  // Read enough bytes for all magic patterns
  const headerSize = 0x8010; // Enough for ISO magic at 0x8001
  const minSize = Math.min(headerSize, stream.length);
  const data = await stream.readChunk(0, minSize);
  return detectFormat(Stream.fromUint8Array(data));
}

/**
 * Detect format from File
 */
export async function detectFormatFromFile(file: File): Promise<FileFormat>
{
  // Read just the header
  const headerSize = Math.min(0x8010, file.size);
  const slice = file.slice(0, headerSize);
  const buffer = await slice.arrayBuffer();
  return detectFormat(new Stream(buffer));
}

/**
 * Get magic pattern length
 */
function getMagicLength(magic: number[] | string): number
{
  return typeof magic === 'string' ? magic.length : magic.length;
}

/**
 * Get file extension for format
 */
export function getFormatExtension(format: FileFormat): string
{
  switch (format)
  {
    case FileFormat.ELF: return '.elf';
    case FileFormat.PBP: return '.pbp';
    case FileFormat.PSF: return '.sfo';
    case FileFormat.ISO: return '.iso';
    case FileFormat.CSO: return '.cso';
    case FileFormat.ZIP: return '.zip';
    case FileFormat.DAX: return '.dax';
    case FileFormat.PSP: return '.prx';
    case FileFormat.RIFF: return '.wav';
    case FileFormat.AT3: return '.at3';
    case FileFormat.VAG: return '.vag';
    case FileFormat.PMF: return '.pmf';
    default: return '';
  }
}

/**
 * Get format description
 */
export function getFormatDescription(format: FileFormat): string
{
  switch (format)
  {
    case FileFormat.ELF: return 'ELF Executable';
    case FileFormat.PBP: return 'PSP Package';
    case FileFormat.PSF: return 'PSP Settings File';
    case FileFormat.ISO: return 'ISO 9660 Disc Image';
    case FileFormat.CSO: return 'Compressed ISO';
    case FileFormat.ZIP: return 'ZIP Archive';
    case FileFormat.DAX: return 'DAX Compressed Image';
    case FileFormat.PSP: return 'Encrypted PSP Module';
    case FileFormat.RIFF: return 'RIFF Container';
    case FileFormat.AT3: return 'ATRAC3 Audio';
    case FileFormat.VAG: return 'VAG ADPCM Audio';
    case FileFormat.PMF: return 'PSP Movie Format';
    default: return 'Unknown Format';
  }
}
