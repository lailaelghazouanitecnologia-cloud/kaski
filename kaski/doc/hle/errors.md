# PSP Error Codes

This document describes the PSP error code system and common errors.

## Error Code Format

PSP error codes follow a specific format:

```
0x80XXYYZZ
│ ││││││
│ ││└┴┴┴── Error number (0-65535)
│ └┴────── System area (module identifier)
└───────── Error bit (always set for errors)
```

### Error Bit

Bit 31 indicates an error:
- `0x00000000` - Success
- `0x80000000` - Error (bit 31 set)

```typescript
function isError(value: number): boolean {
  return (value & 0x80000000) !== 0;
}
```

### System Areas

| Area       | Range              | Description           |
|------------|--------------------|-----------------------|
| General    | 0x80000000-0x8000FFFF | Generic errors      |
| Errno      | 0x80010000-0x8001FFFF | POSIX-style errors  |
| Kernel     | 0x80020000-0x8002FFFF | Kernel errors       |
| Utility    | 0x80110000-0x8011FFFF | Utility module      |
| Audio      | 0x80260000-0x8026FFFF | Audio module        |
| Net        | 0x80410000-0x8041FFFF | Network module      |

## Common Error Categories

### General Errors (0x80000XXX)

| Error           | Code       | Description                        |
|-----------------|------------|------------------------------------|
| ERROR_ALREADY   | 0x80000020 | Operation already performed        |
| ERROR_BUSY      | 0x80000021 | Resource is busy                   |
| ERROR_OUT_OF_MEMORY | 0x80000022 | Out of memory                  |

### Errno Errors (0x80010XXX)

POSIX-compatible error codes:

| Error                        | Code       | Description                    |
|------------------------------|------------|--------------------------------|
| ERROR_ERRNO_FILE_NOT_FOUND   | 0x80010002 | ENOENT - File not found        |
| ERROR_ERRNO_FILE_EXISTS      | 0x80010011 | EEXIST - File exists           |
| ERROR_ERRNO_DEVICE_NOT_FOUND | 0x80010013 | ENODEV - Device not found      |
| ERROR_ERRNO_IS_DIRECTORY     | 0x80010015 | EISDIR - Is a directory        |
| ERROR_ERRNO_INVALID_ARGUMENT | 0x80010016 | EINVAL - Invalid argument      |
| ERROR_ERRNO_TOO_MANY_OPEN_FILES | 0x80010018 | EMFILE - Too many open files |
| ERROR_ERRNO_NO_MEMORY        | 0x80010020 | ENOMEM - No memory             |
| ERROR_ERRNO_TIMEDOUT         | 0x8001006F | ETIMEDOUT - Operation timed out|
| ERROR_ERRNO_CONNECTION_REFUSED | 0x80010070 | ECONNREFUSED - Connection refused |

### Kernel Errors (0x80020XXX)

#### Memory Errors

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_ILLEGAL_PARTITION_ID  | 0x800200D6 | Invalid partition ID           |
| ERROR_KERNEL_PARTITION_IN_USE      | 0x800200D7 | Partition is in use            |
| ERROR_KERNEL_ILLEGAL_MEMBLOCK_ALLOC_TYPE | 0x800200D8 | Invalid allocation type   |
| ERROR_KERNEL_FAILED_ALLOC_MEMBLOCK | 0x800200D9 | Memory allocation failed       |
| ERROR_KERNEL_ILLEGAL_CHUNK_ID      | 0x800200DE | Invalid memory block ID        |
| ERROR_KERNEL_CANNOT_FIND_CHUNK     | 0x800200DF | Memory block not found         |

#### Thread Errors

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY | 0x800200E0 | Invalid thread priority      |
| ERROR_KERNEL_ILLEGAL_STACK_SIZE    | 0x800200E1 | Invalid stack size             |
| ERROR_KERNEL_NOT_FOUND_THREAD      | 0x800200E5 | Thread not found               |
| ERROR_KERNEL_THREAD_ALREADY_DORMANT | 0x800200EF | Thread is already dormant     |
| ERROR_KERNEL_THREAD_ALREADY_SUSPEND | 0x800200F0 | Thread is already suspended   |
| ERROR_KERNEL_THREAD_IS_NOT_DORMANT | 0x800200F1 | Thread is not dormant          |
| ERROR_KERNEL_THREAD_IS_NOT_SUSPEND | 0x800200F2 | Thread is not suspended        |
| ERROR_KERNEL_THREAD_IS_NOT_WAIT    | 0x800200F3 | Thread is not waiting          |

#### Synchronization Errors

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_NOT_FOUND_SEMAPHORE   | 0x800200E6 | Semaphore not found            |
| ERROR_KERNEL_NOT_FOUND_EVENT_FLAG  | 0x800200E7 | Event flag not found           |
| ERROR_KERNEL_NOT_FOUND_MESSAGE_BOX | 0x800200E8 | Message box not found          |
| ERROR_KERNEL_NOT_FOUND_VPOOL       | 0x800200E9 | Variable pool not found        |
| ERROR_KERNEL_NOT_FOUND_FPOOL       | 0x800200EA | Fixed pool not found           |
| ERROR_KERNEL_NOT_FOUND_MESSAGE_PIPE | 0x800200EB | Message pipe not found        |
| ERROR_KERNEL_SEMA_ZERO             | 0x800200F9 | Semaphore count is zero        |
| ERROR_KERNEL_SEMA_OVERFLOW         | 0x800200FA | Semaphore count overflow       |
| ERROR_KERNEL_EVENT_FLAG_POLL_FAILED | 0x800200FB | Event flag poll failed        |

#### Wait Errors

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_WAIT_CAN_NOT_WAIT     | 0x800200F4 | Cannot wait in this context    |
| ERROR_KERNEL_WAIT_TIMEOUT          | 0x800200F5 | Wait operation timed out       |
| ERROR_KERNEL_WAIT_CANCELLED        | 0x800200F6 | Wait was cancelled             |
| ERROR_KERNEL_WAIT_STATUS_RELEASED  | 0x800200F7 | Wait status released           |
| ERROR_KERNEL_WAIT_DELETE           | 0x800200F8 | Wait object was deleted        |
| ERROR_KERNEL_WAIT_RELEASED         | 0x80020101 | Wait was released              |

#### Callback Errors

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_NOT_FOUND_CALLBACK    | 0x800200EE | Callback not found             |
| ERROR_KERNEL_NOT_FOUND_ALARM       | 0x800200EC | Alarm not found                |
| ERROR_KERNEL_NOT_FOUND_VTIMER      | 0x800200ED | VTimer not found               |

#### Other Kernel Errors

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_KERNEL_CANNOT_BE_CALLED_FROM_INTERRUPT | 0x80020064 | Called from interrupt |
| ERROR_KERNEL_UNKNOWN_UID           | 0x800200CB | Unknown UID                    |
| ERROR_KERNEL_ILLEGAL_PERMISSION    | 0x800200D1 | Permission denied              |
| ERROR_KERNEL_ILLEGAL_ADDR          | 0x800200D3 | Invalid address                |
| ERROR_KERNEL_ASYNC_BUSY            | 0x80020103 | Async operation busy           |

### Module Errors (0x80020XXX / 0x80280XXX)

| Error                     | Code       | Description                    |
|---------------------------|------------|--------------------------------|
| ERROR_MODULE_BAD_ID       | 0x802041FE | Invalid module ID              |
| ERROR_MODULE_ALREADY_LOADED | 0x80280033 | Module already loaded        |
| ERROR_MODULE_NOT_FOUND    | 0x8002013C | Module not found               |

### Audio Errors (0x80260XXX)

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_AUDIO_CHANNEL_NOT_INIT       | 0x80260001 | Channel not initialized        |
| ERROR_AUDIO_CHANNEL_BUSY           | 0x80260002 | Channel is busy                |
| ERROR_AUDIO_INVALID_CHANNEL        | 0x80260003 | Invalid channel number         |
| ERROR_AUDIO_NO_CHANNELS_AVAILABLE  | 0x80260005 | No channels available          |
| ERROR_AUDIO_INVALID_FORMAT         | 0x80260007 | Invalid audio format           |

### Utility Errors (0x80110XXX)

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_UTILITY_WRONG_TYPE           | 0x80110601 | Wrong utility type             |
| ERROR_UTILITY_INVALID_STATUS       | 0x80110602 | Invalid utility status         |
| ERROR_UTILITY_INVALID_PARAM_ADDR   | 0x80110603 | Invalid parameter address      |
| ERROR_UTILITY_INVALID_PARAM_SIZE   | 0x80110604 | Invalid parameter size         |
| ERROR_SAVEDATA_LOAD_NO_DATA        | 0x80110305 | No save data found             |
| ERROR_SAVEDATA_LOAD_DATA_BROKEN    | 0x80110307 | Save data is corrupted         |
| ERROR_SAVEDATA_SAVE_NO_SPACE       | 0x80110313 | No space for save              |

### Network Errors (0x80410XXX)

| Error                              | Code       | Description                    |
|------------------------------------|------------|--------------------------------|
| ERROR_NET_RESOLVER_BAD_ID          | 0x80410408 | Invalid resolver ID            |
| ERROR_NET_RESOLVER_ALREADY_STOPPED | 0x8041040A | Resolver already stopped       |
| ERROR_NET_RESOLVER_INVALID_HOST    | 0x80410414 | Invalid host name              |

### UMD Errors (0x80210XXX)

| Error              | Code       | Description                    |
|--------------------|------------|--------------------------------|
| ERROR_UMD_NOT_READY | 0x80210001 | UMD not ready                  |

## Error Handling Utilities

```typescript
import { SceKernelErrors, isError, getErrorName } from '../errors';

// Check if return value is error
const result = sceIoOpen(...);
if (isError(result)) {
  const name = getErrorName(result);
  console.error(`Failed: ${name} (0x${result.toString(16)})`);
  return result;
}

// Common pattern in HLE functions
if (!thread) {
  return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
}

if (priority < 1 || priority > 127) {
  return SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY;
}
```

## Returning Errors

HLE functions should return error codes directly:

```typescript
@nativeFunction(0x446D8DE6, 150)
sceKernelCreateThread(): number {
  const priority = this.ctx.arg(2);
  const stackSize = this.ctx.arg(3);

  // Validate priority
  if (priority < 1 || priority > 127) {
    return SceKernelErrors.ERROR_KERNEL_ILLEGAL_THREAD_PRIORITY;
  }

  // Validate stack size
  if (stackSize < 0x200) {
    return SceKernelErrors.ERROR_KERNEL_ILLEGAL_STACK_SIZE;
  }

  // Success - return UID
  return thread.uid;
}
```

## Debugging Errors

```typescript
// Add to error constants for lookup
const errorNames = new Map<number, string>();
for (const [name, code] of Object.entries(SceKernelErrors)) {
  errorNames.set(code, name);
}

function logError(code: number): void {
  const name = errorNames.get(code) ?? `UNKNOWN_0x${code.toString(16)}`;
  console.error(`PSP Error: ${name} (0x${code.toString(16).toUpperCase()})`);
}
```

## Related Documentation

- [Architecture Overview](./architecture.md)
- [Memory Management](./memory.md)
- [Threading](./threading.md)
- [VFS](./vfs.md)
