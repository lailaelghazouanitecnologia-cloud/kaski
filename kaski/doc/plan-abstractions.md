# Plan: Abstractions y Metaprogramación

## Resumen Ejecutivo

Este plan propone abstracciones y utilidades que reducirán significativamente el código repetitivo.

| Abstracción | Código Afectado | Reducción Estimada |
|-------------|-----------------|-------------------|
| @args decorator | 47 llamadas `ctx.arg()` | ~200 líneas |
| Struct I/O | 8+ llamadas `write32/read32` | ~100 líneas |
| Result<T> | Error handling manual | ~80 líneas |
| BitFlags | Máscaras manuales | ~50 líneas |
| WaitQueue | Patrones de espera | ~150 líneas |
| **Total** | | **~580 líneas** |

---

## 1. @args - Auto-extracción de Argumentos

### Problema Actual
```typescript
// 47 ocurrencias de este patrón:
@nativeFunction(0x446D8DE6, 150)
sceKernelCreateThread(): number {
  const namePtr = this.ctx.argPtr(0);  // Manual
  const entry = this.ctx.arg(1);        // Manual
  const priority = this.ctx.arg(2);     // Manual
  const stackSize = this.ctx.arg(3);    // Manual
  const attr = this.ctx.arg(4);         // Manual
  // ...
}
```

### Solución Propuesta
```typescript
@nativeFunction(0x446D8DE6, 150)
@args('ptr', 'u32', 'i32', 'u32', 'u32')
sceKernelCreateThread(
  namePtr: number,
  entry: number,
  priority: number,
  stackSize: number,
  attr: number
): number {
  const name = this.ctx.readString(namePtr);
  // Directo al código útil
}
```

### Implementación
```typescript
// src/util/Args.ts
type ArgType = 'i32' | 'u32' | 'i64' | 'u64' | 'ptr' | 'str' | 'float';

function args(...types: ArgType[]): MethodDecorator {
  return (target, key, descriptor) => {
    const original = descriptor.value;
    descriptor.value = function(this: HleModule) {
      const extractedArgs = types.map((type, i) => {
        switch (type) {
          case 'ptr':
          case 'u32': return this.ctx.arg(i) >>> 0;
          case 'i32': return this.ctx.arg(i) | 0;
          case 'str': return this.ctx.readString(this.ctx.argPtr(i));
          case 'i64': return this.ctx.arg64(i);
          case 'float': return this.ctx.argFloat(i);
        }
      });
      return original.apply(this, extractedArgs);
    };
  };
}
```

### Beneficio
- **Reducción**: ~4 líneas por función × 50 funciones = **~200 líneas**
- **Tipo-seguro**: Los argumentos tienen tipos correctos
- **Documentación**: La firma del método documenta los argumentos

---

## 2. Struct I/O Mejorado

### Problema Actual
```typescript
// Escribir SceIoDirent manualmente:
this.ctx.write32(dirPtr + 0x00, stat.mode);
this.ctx.write32(dirPtr + 0x04, 0);
this.ctx.write32(dirPtr + 0x08, stat.size);
this.ctx.write32(dirPtr + 0x0C, 0);
for (let i = 0; i < name.length; i++) {
  this.ctx.write8(dirPtr + 0x58 + i, name.charCodeAt(i));
}
```

### Solución Propuesta
```typescript
// Definir struct una vez:
class SceIoDirent {
  @u32 mode = 0;
  @u32 attr = 0;
  @u64 size = 0n;
  @struct(SceDateTime) ctime!: SceDateTime;
  @struct(SceDateTime) atime!: SceDateTime;
  @struct(SceDateTime) mtime!: SceDateTime;
  @bytes(24) private1 = new Uint8Array(24);
  @str(256) name = '';
}

// Usar:
const dirent = new SceIoDirent();
dirent.mode = stat.mode;
dirent.size = BigInt(stat.size);
dirent.name = entry.name;
this.ctx.writeStruct(SceIoDirent, dirent, dirPtr);
```

### Mejoras a Struct.ts
```typescript
// Añadir a EmulatorContext:
writeStruct<T>(ctor: StructConstructor<T>, instance: T, address: number): void {
  writeStruct(ctor, instance, this.memory, address);
}

readStruct<T>(ctor: StructConstructor<T>, address: number): T {
  return readStruct(ctor, this.memory, address);
}
```

### Beneficio
- **Reducción**: ~10 líneas por struct × 10 structs = **~100 líneas**
- **Mantenibilidad**: Offsets calculados automáticamente
- **Reutilizable**: Misma definición para leer y escribir

---

## 3. Result<T, E> - Manejo de Errores Tipo-Seguro

### Problema Actual
```typescript
// Patrón repetido en todas partes:
const { block, error } = this.ctx.memoryManager.allocate(...);
if (!block) {
  return error;
}
// usar block...

// Y a veces olvidamos chequear:
const thread = this.ctx.threadManager.getThread(thid);
if (!thread) {  // ¡Fácil de olvidar!
  return ERROR_NOT_FOUND;
}
```

### Solución Propuesta
```typescript
// src/util/Result.ts
type Result<T, E = number> =
  | { ok: true; value: T }
  | { ok: false; error: E };

const Ok = <T>(value: T): Result<T> => ({ ok: true, value });
const Err = <E>(error: E): Result<never, E> => ({ ok: false, error });

// Uso con métodos encadenados:
class Result<T, E> {
  map<U>(fn: (value: T) => U): Result<U, E>;
  mapErr<F>(fn: (error: E) => F): Result<T, F>;
  unwrapOr(defaultValue: T): T;
  match<U>(ok: (v: T) => U, err: (e: E) => U): U;
}

// En HLE:
@nativeFunction(0x446D8DE6, 150)
sceKernelCreateThread(): number {
  return this.ctx.threadManager
    .createThread(name, entry, priority, stackSize, attr)
    .match(
      thread => thread.uid,
      error => error
    );
}
```

### Beneficio
- **Reducción**: ~3 líneas por función × 30 funciones = **~90 líneas**
- **Seguridad**: Imposible olvidar chequear errores
- **Composable**: Encadenar operaciones que pueden fallar

---

## 4. BitFlags - Manejo de Banderas

### Problema Actual
```typescript
// Repetido en muchos lugares:
let openFlags: OpenFlags = 0;
if (flags & 0x0001) openFlags |= OpenFlags.Read;
if (flags & 0x0002) openFlags |= OpenFlags.Write;
if (flags & 0x0100) openFlags |= OpenFlags.Append;
if (flags & 0x0200) openFlags |= OpenFlags.Create;
if (flags & 0x0400) openFlags |= OpenFlags.Truncate;
```

### Solución Propuesta
```typescript
// src/util/BitFlags.ts
class BitFlags<T extends number> {
  constructor(private value: number = 0) {}

  has(flag: T): boolean { return (this.value & flag) !== 0; }
  set(flag: T): this { this.value |= flag; return this; }
  clear(flag: T): this { this.value &= ~flag; return this; }
  toggle(flag: T): this { this.value ^= flag; return this; }

  // Mapeo automático
  static map<T extends number>(
    value: number,
    mapping: Array<[number, T]>
  ): BitFlags<T> {
    const flags = new BitFlags<T>();
    for (const [src, dst] of mapping) {
      if (value & src) flags.set(dst);
    }
    return flags;
  }
}

// Uso:
const openFlags = BitFlags.map(pspFlags, [
  [0x0001, OpenFlags.Read],
  [0x0002, OpenFlags.Write],
  [0x0100, OpenFlags.Append],
  [0x0200, OpenFlags.Create],
  [0x0400, OpenFlags.Truncate],
]);
```

### Beneficio
- **Reducción**: ~5 líneas por uso × 10 usos = **~50 líneas**
- **Legibilidad**: Mapeo declarativo
- **Type-safe**: Previene mezclar flags de diferentes enums

---

## 5. WaitQueue - Abstraer Esperas de Threads

### Problema Actual
```typescript
// Repetido para semáforos, event flags, message boxes, etc:
if (sema.count >= signal) {
  sema.count -= signal;
  return 0;
}

const thread = this.ctx.threadManager.getCurrentThread();
if (!thread) return ERROR;

return thread.startWait(WaitType.SEMA, semaid)
  .then(() => {
    sema.count -= signal;
    return 0;
  })
  .toPromise();
```

### Solución Propuesta
```typescript
// src/util/WaitQueue.ts
class WaitQueue<T> {
  private waiters: Array<{
    thread: Thread;
    condition: (resource: T) => boolean;
    resolve: (value: number) => void;
  }> = [];

  // Intentar adquirir o esperar
  async acquire(
    resource: T,
    condition: (r: T) => boolean,
    onAcquire: (r: T) => void,
    thread: Thread
  ): Promise<number> {
    if (condition(resource)) {
      onAcquire(resource);
      return 0;
    }

    return new Promise(resolve => {
      this.waiters.push({ thread, condition, resolve });
      thread.status = ThreadStatus.WAIT;
    });
  }

  // Despertar threads cuando el recurso cambia
  signal(resource: T): void {
    for (let i = this.waiters.length - 1; i >= 0; i--) {
      const waiter = this.waiters[i];
      if (waiter.condition(resource)) {
        this.waiters.splice(i, 1);
        waiter.thread.status = ThreadStatus.READY;
        waiter.resolve(0);
      }
    }
  }
}

// Uso en semáforo:
class Semaphore {
  count: number;
  waitQueue = new WaitQueue<Semaphore>();

  async wait(signal: number, thread: Thread): Promise<number> {
    return this.waitQueue.acquire(
      this,
      s => s.count >= signal,
      s => s.count -= signal,
      thread
    );
  }

  post(signal: number): void {
    this.count += signal;
    this.waitQueue.signal(this);
  }
}
```

### Beneficio
- **Reducción**: ~20 líneas por objeto sincronización × 8 tipos = **~160 líneas**
- **Corrección**: Lógica de espera centralizada y probada
- **Extensible**: Fácil añadir timeouts, prioridades, etc.

---

## 6. Otras Utilidades Menores

### 6.1 Memoize
```typescript
// Para cálculos costosos que se repiten
const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();
  return ((...args) => {
    const key = JSON.stringify(args);
    if (!cache.has(key)) cache.set(key, fn(...args));
    return cache.get(key);
  }) as T;
};
```

### 6.2 LazyInit
```typescript
// Inicialización diferida
class Lazy<T> {
  private value?: T;
  private initialized = false;

  constructor(private init: () => T) {}

  get(): T {
    if (!this.initialized) {
      this.value = this.init();
      this.initialized = true;
    }
    return this.value!;
  }
}
```

### 6.3 Pool<T>
```typescript
// Reutilización de objetos (reduce GC)
class Pool<T> {
  private free: T[] = [];

  constructor(private create: () => T, private reset: (obj: T) => void) {}

  acquire(): T {
    return this.free.pop() ?? this.create();
  }

  release(obj: T): void {
    this.reset(obj);
    this.free.push(obj);
  }
}
```

---

## 7. Plan de Implementación

### Fase 1: Fundamentos (ya existen parcialmente)
- [x] UidCollection
- [x] Signal
- [x] PromiseFast
- [x] Int64
- [x] Struct decorators
- [ ] Result<T, E>
- [ ] BitFlags

### Fase 2: HLE Helpers
- [ ] @args decorator
- [ ] WaitQueue
- [ ] ctx.readStruct/writeStruct shortcuts

### Fase 3: Optimizaciones
- [ ] Pool para objetos frecuentes
- [ ] Lazy para inicialización costosa
- [ ] Memoize para cálculos repetidos

---

## 8. Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Líneas en módulos HLE | ~500 | ~300 |
| Líneas por función promedio | 15 | 8 |
| Código duplicado | Alto | Mínimo |
| Cobertura de tipos | Parcial | Completa |

---

## 9. Prioridad Recomendada

1. **@args** - Mayor impacto inmediato, 47 usos actuales
2. **Result<T>** - Mejora seguridad y reduce boilerplate
3. **WaitQueue** - Necesario para semáforos/mutex/eventos
4. **BitFlags** - Útil pero menos crítico
5. **Pool/Lazy/Memoize** - Optimizaciones para después

---

## 10. Ejemplo Completo: Antes vs Después

### Antes (actual)
```typescript
@nativeFunction(0x4E3A1105, 150)
sceKernelWaitSema(): number | Promise<number> {
  const semaid = this.ctx.arg(0);
  const signal = this.ctx.arg(1);
  const timeoutPtr = this.ctx.argPtr(2);

  const sema = this.semaphores.get(semaid);
  if (!sema) {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_SEMAPHORE;
  }

  if (sema.count >= signal) {
    sema.count -= signal;
    return 0;
  }

  const thread = this.ctx.threadManager.getCurrentThread();
  if (!thread) {
    return SceKernelErrors.ERROR_KERNEL_NOT_FOUND_THREAD;
  }

  return thread.startWait(WaitType.SEMA, semaid).then(() => {
    sema.count -= signal;
    return 0;
  }).toPromise();
}
```

### Después (con abstracciones)
```typescript
@nativeFunction(0x4E3A1105, 150)
@args('u32', 'i32', 'ptr')
async sceKernelWaitSema(semaid: number, signal: number, timeoutPtr: number): Promise<number> {
  return this.semaphores.get(semaid)
    .mapErr(() => ERROR_NOT_FOUND_SEMAPHORE)
    .asyncMap(sema => sema.wait(signal, this.thread, timeoutPtr))
    .unwrapOr(ERROR_NOT_FOUND_SEMAPHORE);
}
```

**Reducción: 20 líneas → 6 líneas (70%)**
