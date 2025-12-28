/**
 * Formatting utilities
 */

/**
 * Format a number as hexadecimal string
 *
 * @param value - Number to format
 * @param digits - Number of hex digits (default: 8)
 * @returns Hex string without '0x' prefix
 */
export function hex(value: number, digits: number = 8): string
{
  return (value >>> 0).toString(16).padStart(digits, '0');
}

/**
 * Format a number as hexadecimal with '0x' prefix
 *
 * @param value - Number to format
 * @param digits - Number of hex digits (default: 8)
 * @returns Hex string with '0x' prefix
 */
export function hex0x(value: number, digits: number = 8): string
{
  return '0x' + hex(value, digits);
}

/**
 * Format a signed number
 *
 * @param value - Signed 32-bit value
 * @returns Formatted string
 */
export function formatSigned(value: number): string
{
  if (value < 0)
  {
    return `-${Math.abs(value)}`;
  }
  return value.toString();
}

/**
 * Format a memory address
 *
 * @param addr - Memory address
 * @returns Formatted address string
 */
export function formatAddress(addr: number): string
{
  return hex0x(addr);
}

/**
 * Format bytes as hex string
 *
 * @param bytes - Array of bytes
 * @returns Hex string
 */
export function formatBytes(bytes: Uint8Array): string
{
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join(' ');
}

/**
 * Format a size in bytes with units
 *
 * @param bytes - Size in bytes
 * @returns Formatted string with appropriate unit
 */
export function formatSize(bytes: number): string
{
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Format a percentage
 *
 * @param value - Value between 0 and 1
 * @param decimals - Decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercent(value: number, decimals: number = 1): string
{
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Pad a string to a fixed width
 *
 * @param str - String to pad
 * @param width - Target width
 * @param char - Padding character (default: ' ')
 * @returns Padded string
 */
export function padLeft(str: string, width: number, char: string = ' '): string
{
  return str.padStart(width, char);
}

/**
 * Pad a string to a fixed width (right)
 *
 * @param str - String to pad
 * @param width - Target width
 * @param char - Padding character (default: ' ')
 * @returns Padded string
 */
export function padRight(str: string, width: number, char: string = ' '): string
{
  return str.padEnd(width, char);
}
