# 04 - Core Hardware Components

## Contexto

Se añadieron los componentes de hardware del PSP al layer `core/`:
- Display: controlador de pantalla
- Battery: estado de batería
- Controller: entrada de controles
- Audio: salida de audio

También se creó el layer `psp/html5/` para integración con navegadores.

## Componentes Implementados

### 1. Display (`core/display/`)

Controlador de pantalla PSP:
- **Constantes**: SCREEN_WIDTH=480, SCREEN_HEIGHT=272
- **VSync**: 59.94 Hz timing
- **Framebuffer**: dirección, stride, formato de pixel
- **VBlank**: callbacks y promesas para sincronización

```typescript
export class Display {
  setFrameBuf(address, bufferWidth, pixelFormat, sync): number;
  waitVblank(): Promise<void>;
  update(currentTime: number): void;
  triggerVblank(): void;
}
```

### 2. Battery (`core/battery/`)

Simulación de batería PSP:
- **Estado**: porcentaje, voltaje, temperatura
- **Carga**: simulación de carga/descarga
- **Energía externa**: detección AC adapter

```typescript
export class Battery {
  setPercentage(percentage: number): void;
  setCharging(charging: boolean): void;
  update(deltaMs: number): void;
}
```

### 3. Controller (`core/controller/`)

Entrada de controles PSP:
- **Botones**: D-pad, face buttons, triggers
- **Analog stick**: 0-255 rango
- **Buffer**: historial de muestras
- **Latch**: detección de flancos

```typescript
export class Controller {
  pressButton(button: PspButton): void;
  releaseButton(button: PspButton): void;
  setAnalog(x: number, y: number): void;
  readBuffers(count: number): ControllerData[];
}
```

### 4. Audio (`core/audio/`)

Sistema de audio PSP:
- **8 canales** de hardware
- **Formato**: stereo/mono, 44.1kHz
- **Volumen**: por canal y master

```typescript
export class Audio {
  reserveChannel(sampleCount, format): number;
  releaseChannel(id: number): boolean;
  output(id: number, data: Int16Array): void;
}
```

## HTML5 Integration (`psp/html5/`)

Layer de integración para navegadores:

### Html5Display
- Renderiza framebuffer a Canvas 2D
- Soporta múltiples formatos de pixel (RGBA8888, RGB565, etc.)
- Escalado y FPS tracking

### Html5Audio
- Web Audio API para salida de sonido
- Mezcla de 8 canales PSP
- ScriptProcessorNode para buffering

### Html5Input
- Mapeo de teclado a botones PSP
- Soporte de Gamepad API
- Detección de flancos

### Html5Platform
- Integración completa de display, audio e input
- Frame loop con requestAnimationFrame
- Lifecycle management (init, start, stop, pause, resume)

## Estructura de Archivos

```
src/core/
├── display/
│   ├── Display.ts
│   └── index.ts
├── battery/
│   ├── Battery.ts
│   └── index.ts
├── controller/
│   ├── Controller.ts
│   └── index.ts
├── audio/
│   ├── Audio.ts
│   └── index.ts
└── index.ts (updated exports)

src/psp/
├── html5/
│   ├── Html5Display.ts
│   ├── Html5Audio.ts
│   ├── Html5Input.ts
│   ├── Html5Platform.ts
│   └── index.ts
└── index.ts (updated exports)
```

## Uso

```typescript
import { Memory } from './core';
import { Html5Platform } from './psp/html5';

const memory = new Memory();
const canvas = document.getElementById('screen') as HTMLCanvasElement;

const platform = new Html5Platform(memory, { canvas });
await platform.init();

platform.start((deltaTime) => {
  // Emulator step
});
```

## Tests

- Build: ✅ compila correctamente
- Tests: ✅ 525 tests passing
