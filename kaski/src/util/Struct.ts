/**
 * Struct - Binary structure serialization
 *
 * Decorator-based system for defining PSP binary structures.
 * Used for syscall parameters, file info, thread info, etc.
 */

import type { Memory } from '../core/Memory';

// ============================================
// Field Metadata
// ============================================

export type FieldType =
  | 'i8' | 'u8'
  | 'i16' | 'u16'
  | 'i32' | 'u32'
  | 'i64' | 'u64'
  | 'f32' | 'f64'
  | 'string' | 'bytes'
  | 'struct';

export interface FieldInfo
{
  name: string;
  type: FieldType;
  offset: number;
  size: number;
  arrayLength?: number;
  stringLength?: number;
  structType?: StructConstructor<unknown>;
}

export interface StructMetadata
{
  fields: FieldInfo[];
  size: number;
}

// Symbol for storing metadata
const STRUCT_METADATA = Symbol('struct_metadata');

// ============================================
// Type Decorators
// ============================================

function defineField(type: FieldType, size: number, options?: {
  arrayLength?: number;
  stringLength?: number;
  structType?: StructConstructor<unknown>;
})
{
  return function(target: object, propertyKey: string): void
  {
    const metadata = getOrCreateMetadata(target.constructor);
    const offset = metadata.size;

    const fieldSize = options?.arrayLength
      ? size * options.arrayLength
      : options?.stringLength
        ? options.stringLength
        : size;

    metadata.fields.push({
      name: propertyKey,
      type,
      offset,
      size: fieldSize,
      ...options,
    });

    metadata.size += fieldSize;
  };
}

/** 8-bit signed integer */
export function i8(target: object, propertyKey: string): void
{
  defineField('i8', 1)(target, propertyKey);
}

/** 8-bit unsigned integer */
export function u8(target: object, propertyKey: string): void
{
  defineField('u8', 1)(target, propertyKey);
}

/** 16-bit signed integer */
export function i16(target: object, propertyKey: string): void
{
  defineField('i16', 2)(target, propertyKey);
}

/** 16-bit unsigned integer */
export function u16(target: object, propertyKey: string): void
{
  defineField('u16', 2)(target, propertyKey);
}

/** 32-bit signed integer */
export function i32(target: object, propertyKey: string): void
{
  defineField('i32', 4)(target, propertyKey);
}

/** 32-bit unsigned integer */
export function u32(target: object, propertyKey: string): void
{
  defineField('u32', 4)(target, propertyKey);
}

/** 64-bit signed integer */
export function i64(target: object, propertyKey: string): void
{
  defineField('i64', 8)(target, propertyKey);
}

/** 64-bit unsigned integer */
export function u64(target: object, propertyKey: string): void
{
  defineField('u64', 8)(target, propertyKey);
}

/** 32-bit float */
export function f32(target: object, propertyKey: string): void
{
  defineField('f32', 4)(target, propertyKey);
}

/** 64-bit float */
export function f64(target: object, propertyKey: string): void
{
  defineField('f64', 8)(target, propertyKey);
}

/** Fixed-length string */
export function str(length: number): PropertyDecorator
{
  return (target: object, propertyKey: string | symbol) =>
  {
    defineField('string', 1, { stringLength: length })(target, propertyKey as string);
  };
}

/** Fixed-length byte array */
export function bytes(length: number): PropertyDecorator
{
  return (target: object, propertyKey: string | symbol) =>
  {
    defineField('bytes', 1, { arrayLength: length })(target, propertyKey as string);
  };
}

/** Array of primitive type */
export function array(type: 'i8' | 'u8' | 'i16' | 'u16' | 'i32' | 'u32' | 'f32', length: number): PropertyDecorator
{
  const sizes: Record<string, number> = {
    i8: 1, u8: 1, i16: 2, u16: 2, i32: 4, u32: 4, f32: 4,
  };
  return (target: object, propertyKey: string | symbol) =>
  {
    defineField(type, sizes[type], { arrayLength: length })(target, propertyKey as string);
  };
}

/** Nested struct */
export function struct<T>(structType: StructConstructor<T>): PropertyDecorator
{
  return (target: object, propertyKey: string | symbol) =>
  {
    const nestedMeta = getMetadata(structType);
    if (!nestedMeta)
    {
      throw new Error(`No struct metadata for ${structType.name}`);
    }
    defineField('struct', nestedMeta.size, { structType: structType as StructConstructor<unknown> })(
      target,
      propertyKey as string
    );
  };
}

// ============================================
// Metadata Helpers
// ============================================

function getOrCreateMetadata(target: object): StructMetadata
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let metadata = (target as any)[STRUCT_METADATA];
  if (!metadata)
  {
    metadata = { fields: [], size: 0 };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (target as any)[STRUCT_METADATA] = metadata;
  }
  return metadata;
}

export function getMetadata(target: StructConstructor<unknown>): StructMetadata | undefined
{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (target as any)[STRUCT_METADATA];
}

export function getStructSize(target: StructConstructor<unknown>): number
{
  const metadata = getMetadata(target);
  return metadata?.size ?? 0;
}

// ============================================
// Struct Base Class
// ============================================

export interface StructConstructor<T>
{
  new(): T;
}

/**
 * Read a struct from memory
 */
export function readStruct<T>(
  ctor: StructConstructor<T>,
  memory: Memory,
  address: number
): T
{
  const metadata = getMetadata(ctor);
  if (!metadata)
  {
    throw new Error(`No struct metadata for ${ctor.name}`);
  }

  const instance = new ctor();

  for (const field of metadata.fields)
  {
    const addr = address + field.offset;
    let value: unknown;

    switch (field.type)
    {
      case 'i8':
        value = memory.lb(addr);
        break;
      case 'u8':
        value = memory.lbu(addr);
        break;
      case 'i16':
        value = memory.lh(addr);
        break;
      case 'u16':
        value = memory.lhu(addr);
        break;
      case 'i32':
        value = memory.lw(addr);
        break;
      case 'u32':
        value = memory.lw(addr) >>> 0;
        break;
      case 'i64':
      case 'u64':
        value = {
          low: memory.lw(addr),
          high: memory.lw(addr + 4),
        };
        break;
      case 'f32':
        value = memory.lwFloat(addr);
        break;
      case 'f64':
        value = memory.ldFloat(addr);
        break;
      case 'string':
        {
          const bytes = new Uint8Array(field.stringLength!);
          for (let i = 0; i < field.stringLength!; i++)
          {
            bytes[i] = memory.lbu(addr + i);
          }
          // Find null terminator
          let end = bytes.indexOf(0);
          if (end === -1) end = bytes.length;
          value = new TextDecoder().decode(bytes.slice(0, end));
        }
        break;
      case 'bytes':
        {
          const arr = new Uint8Array(field.arrayLength!);
          for (let i = 0; i < field.arrayLength!; i++)
          {
            arr[i] = memory.lbu(addr + i);
          }
          value = arr;
        }
        break;
      case 'struct':
        value = readStruct(field.structType!, memory, addr);
        break;
    }

    (instance as Record<string, unknown>)[field.name] = value;
  }

  return instance;
}

/**
 * Write a struct to memory
 */
export function writeStruct<T>(
  ctor: StructConstructor<T>,
  instance: T,
  memory: Memory,
  address: number
): void
{
  const metadata = getMetadata(ctor);
  if (!metadata)
  {
    throw new Error(`No struct metadata for ${ctor.name}`);
  }

  for (const field of metadata.fields)
  {
    const addr = address + field.offset;
    const value = (instance as Record<string, unknown>)[field.name];

    switch (field.type)
    {
      case 'i8':
      case 'u8':
        memory.sb(addr, value as number);
        break;
      case 'i16':
      case 'u16':
        memory.sh(addr, value as number);
        break;
      case 'i32':
      case 'u32':
        memory.sw(addr, value as number);
        break;
      case 'i64':
      case 'u64':
        {
          const v = value as { low: number; high: number };
          memory.sw(addr, v.low);
          memory.sw(addr + 4, v.high);
        }
        break;
      case 'f32':
        memory.swFloat(addr, value as number);
        break;
      case 'f64':
        memory.sdFloat(addr, value as number);
        break;
      case 'string':
        {
          const str = value as string;
          const bytes = new TextEncoder().encode(str);
          for (let i = 0; i < field.stringLength!; i++)
          {
            memory.sb(addr + i, i < bytes.length ? bytes[i] : 0);
          }
        }
        break;
      case 'bytes':
        {
          const arr = value as Uint8Array;
          for (let i = 0; i < field.arrayLength!; i++)
          {
            memory.sb(addr + i, i < arr.length ? arr[i] : 0);
          }
        }
        break;
      case 'struct':
        writeStruct(field.structType!, value as object, memory, addr);
        break;
    }
  }
}

/**
 * Read struct from buffer
 */
export function readStructFromBuffer<T>(
  ctor: StructConstructor<T>,
  buffer: ArrayBuffer,
  offset: number = 0
): T
{
  const metadata = getMetadata(ctor);
  if (!metadata)
  {
    throw new Error(`No struct metadata for ${ctor.name}`);
  }

  const view = new DataView(buffer);
  const instance = new ctor();

  for (const field of metadata.fields)
  {
    const addr = offset + field.offset;
    let value: unknown;

    switch (field.type)
    {
      case 'i8':
        value = view.getInt8(addr);
        break;
      case 'u8':
        value = view.getUint8(addr);
        break;
      case 'i16':
        value = view.getInt16(addr, true);
        break;
      case 'u16':
        value = view.getUint16(addr, true);
        break;
      case 'i32':
        value = view.getInt32(addr, true);
        break;
      case 'u32':
        value = view.getUint32(addr, true);
        break;
      case 'i64':
      case 'u64':
        value = {
          low: view.getUint32(addr, true),
          high: view.getUint32(addr + 4, true),
        };
        break;
      case 'f32':
        value = view.getFloat32(addr, true);
        break;
      case 'f64':
        value = view.getFloat64(addr, true);
        break;
      case 'string':
        {
          const bytes = new Uint8Array(buffer, addr, field.stringLength!);
          let end = bytes.indexOf(0);
          if (end === -1) end = bytes.length;
          value = new TextDecoder().decode(bytes.slice(0, end));
        }
        break;
      case 'bytes':
        value = new Uint8Array(buffer, addr, field.arrayLength!).slice();
        break;
      case 'struct':
        value = readStructFromBuffer(field.structType!, buffer, addr);
        break;
    }

    (instance as Record<string, unknown>)[field.name] = value;
  }

  return instance;
}
