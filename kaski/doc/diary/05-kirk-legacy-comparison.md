# 05 - KIRK Crypto Engine & Legacy Comparison

## Date: 2025-12-28

## Contexto

Esta sesión se enfocó en:
1. Implementar el motor criptográfico KIRK
2. Crear comparación detallada legacy vs kaski
3. Establecer pipeline de pruebas para cube demo
4. Documentar diferencias arquitectónicas

## KIRK Crypto Engine

### Archivos Creados

```
src/core/kirk/
├── aes.ts      # AES-128-CBC implementation
├── keys.ts     # Key vault (KIRK1, KIRK7 keys)
├── kirk.ts     # Main KIRK commands
└── index.ts    # Module exports
```

### Comandos Implementados

| Comando | Nombre | Estado |
|---------|--------|--------|
| CMD1 | DECRYPT_PRIVATE | ✅ Implementado |
| CMD7 | DECRYPT_IV_0 | ✅ Implementado |
| CMD4 | ENCRYPT_IV_0 | Stub |
| CMD5 | ENCRYPT_IV_FUSE | Stub |
| CMD6 | ENCRYPT_IV_USER | Stub |
| CMD8 | DECRYPT_IV_FUSE | Stub |
| CMD9 | DECRYPT_IV_USER | Stub |
| CMD10 | PRIV_SIG_CHECK | Stub |
| CMD11 | SHA1_HASH | Stub |
| CMD12 | ECDSA_GEN_KEYS | Stub |
| CMD13 | ECDSA_MULTIPLY_POINT | Stub |
| CMD14 | PRNG | Stub |
| CMD16 | ECDSA_SIGN | Stub |
| CMD17 | ECDSA_VERIFY | Stub |
| CMD18 | CERT_VERIFY | Stub |

### AES Implementation

- S-box / Inverse S-box tables
- Sub-mix tables for encryption/decryption
- Key schedule computation
- CBC mode with optional IV

### Key Vault

- KIRK1_KEY: Master decryption key (16 bytes)
- KIRK7_KEYS: 27 indexed keys for key table decryption
- ECC curve parameters (EC_CURVE_1, EC_CURVE_2)

### Tests

37 tests passing:
- AES-128-CBC basic operations
- Key management
- kirkCmd1, kirkCmd7 functionality
- kirkExecute command dispatch
- hleUtilsBufferCopyWithRange interface
- Command/error/mode enums

## Legacy vs Kaski Comparison

### Major Architectural Differences

| Aspecto | Legacy | Kaski |
|---------|--------|-------|
| GPU Backend | WebGL | WebGPU |
| CPU JIT | Basic | Advanced (Relooper, Cache) |
| Memory | Abstract class | Concrete implementation |
| HLE Context | Distributed | EmulatorContext hub |
| VFS | 8 implementations | 5 consolidated |

### New in Kaski

1. **EmulatorContext** - Central coordination hub
2. **DisplayManager, InputManager, AudioManager** - Dedicated managers
3. **SyncManager** - Synchronization primitives
4. **SyscallManager** - Syscall bridging
5. **TextureCache** - Explicit GPU caching
6. **Analysis module** - Static code analysis
7. **WebGPU backend** - Modern rendering

### Missing from Kaski

1. CSO (Compressed ISO) support
2. ZIP/ZLIB compression
3. ISO VFS mounting
4. Encrypted PRX loading
5. VAG/RIFF audio formats
6. DWARF debug info parsing

## Cube Integration Tests

### Creado: `tests/cube-integration.test.ts`

Pipeline comprehensivo que incluye:
- ELF/PBP loading tests
- Module loading verification
- Import table parsing
- Instruction execution (10K, 100K, 1M)
- Multi-frame execution
- Syscall handling
- Register state tracking
- Stress testing

### Issues Encontrados

1. `cube.elf` isPrx=false (test asumía true)
2. Import tables no se parsean (libraries.length=0)
3. `thread.cpu` es null en setupMainThread

Estos issues requieren debug adicional en ProgramLoader y ThreadManager.

## Documentation

### Nuevo: `docs/LEGACY_COMPARISON.md`

Documento de seguimiento que incluye:
- Tabla de paridad por componente
- Status detallado por feature
- Lista de features faltantes
- Action items priorizados
- Changelog

## Tests Status

```
Total tests: 699
- CPU: 200+
- GPU: 50+
- Memory: 50+
- HLE: 53+
- KIRK: 37
- Format: 20+
- Integration: WIP
```

## Next Steps

1. **Inmediato**:
   - Fix cube-integration test issues
   - Debug ProgramLoader/ThreadManager
   - Verify import table parsing

2. **Corto plazo**:
   - Add ISO VFS back
   - Implement CSO support
   - Complete remaining KIRK commands

3. **Largo plazo**:
   - Full game compatibility testing
   - WebGPU performance benchmarks
   - JIT optimization

## Commits

- `dc344f5` - Rebuild browser bundle with syscall fixes
- `bb99a05` - Fix syscall number assignment
- `fc446bc` - Add PSP import stub patching
- `39344c2` - Add detailed crash reporting
- `926ee41` - Simplify render and gradient
