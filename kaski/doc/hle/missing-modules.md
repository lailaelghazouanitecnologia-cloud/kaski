# Missing HLE Modules

This document lists all PSP modules that need to be implemented for full compatibility.

## Implementation Priority

### Priority 1: Essential for Basic Games
These modules are required for most games to run:

#### sceDisplay (12 functions) - **CRITICAL**
Display mode and VBlank synchronization.

```typescript
// Required functions
sceDisplaySetMode(mode, width, height)     // 0x0E20F177
sceDisplaySetFrameBuf(topAddr, bufferWidth, pixelFormat, sync) // 0x289D82FE
sceDisplayWaitVblank()                     // 0x36CDFADE
sceDisplayWaitVblankStart()                // 0x984C27E7
sceDisplayWaitVblankCB()                   // 0x8EB9EC49
sceDisplayWaitVblankStartCB()              // 0x46F186C3
sceDisplayGetVcount()                      // 0x9C6EAAD7
sceDisplayGetFrameBuf(...)                 // 0xEEDA2E54
sceDisplayIsForeground()                   // 0xB4F378FA
sceDisplayIsVblank()                       // 0x4D4E10EC
sceDisplayGetCurrentHcount()               // 0x773DD3A3
sceDisplayGetAccumulatedHcount()           // 0x210EAB3A
```

#### sceCtrl (6 functions) - **CRITICAL**
Controller input.

```typescript
sceCtrlSetSamplingCycle(cycle)             // 0x6A2774F3
sceCtrlGetSamplingCycle(cyclePtr)          // 0x02BAAD91
sceCtrlSetSamplingMode(mode)               // 0x1F4011E6
sceCtrlGetSamplingMode(modePtr)            // 0xDA6B76A1
sceCtrlPeekBufferPositive(padData, count)  // 0x3A622550
sceCtrlReadBufferPositive(padData, count)  // 0x1F803938
```

**Button flags:**
```typescript
const PSP_CTRL_SELECT   = 0x000001;
const PSP_CTRL_START    = 0x000008;
const PSP_CTRL_UP       = 0x000010;
const PSP_CTRL_RIGHT    = 0x000020;
const PSP_CTRL_DOWN     = 0x000040;
const PSP_CTRL_LEFT     = 0x000080;
const PSP_CTRL_LTRIGGER = 0x000100;
const PSP_CTRL_RTRIGGER = 0x000200;
const PSP_CTRL_TRIANGLE = 0x001000;
const PSP_CTRL_CIRCLE   = 0x002000;
const PSP_CTRL_CROSS    = 0x004000;
const PSP_CTRL_SQUARE   = 0x008000;
```

#### Thread Synchronization - **CRITICAL**

**Semaphores (8 functions):**
```typescript
sceKernelCreateSema(name, attr, initVal, maxVal, option) // 0xD6DA4BA1
sceKernelDeleteSema(semaid)                // 0x28B6489C
sceKernelSignalSema(semaid, signal)        // 0x3F53E640
sceKernelWaitSema(semaid, signal, timeout) // 0x4E3A1105
sceKernelWaitSemaCB(semaid, signal, timeout) // 0x6D212BAC
sceKernelPollSema(semaid, signal)          // 0x58B1F937
sceKernelReferSemaStatus(semaid, info)     // 0xBC6FEBC5
sceKernelCancelSema(semaid, newCount, numWait) // 0x8FFDF9A2
```

**Event Flags (9 functions):**
```typescript
sceKernelCreateEventFlag(name, attr, bits, option) // 0x55C20A00
sceKernelDeleteEventFlag(evid)             // 0xEF9E4C70
sceKernelSetEventFlag(evid, bits)          // 0x1FB15A32
sceKernelClearEventFlag(evid, bits)        // 0x812346E4
sceKernelWaitEventFlag(evid, bits, wait, outBits, timeout) // 0x402FCF22
sceKernelWaitEventFlagCB(...)              // 0x328C546F
sceKernelPollEventFlag(evid, bits, wait, outBits) // 0x30FD48F0
sceKernelReferEventFlagStatus(evid, info)  // 0xA66B0120
sceKernelCancelEventFlag(evid, newPattern, numWait) // 0xCD203292
```

### Priority 2: Required for Many Games

#### sceGe_user (11 functions) - GPU Commands
```typescript
sceGeEdramGetSize()                        // 0x1F6752AD
sceGeEdramGetAddr()                        // 0xE47E40E4
sceGeListEnQueue(list, stall, cbid, arg)   // 0xAB49E76A
sceGeListEnQueueHead(...)                  // 0x1C0D95A6
sceGeListDeQueue(qid)                      // 0x5FB86AB0
sceGeListUpdateStallAddr(qid, stall)       // 0xE0D68148
sceGeListSync(qid, syncType)               // 0x03444EB4
sceGeDrawSync(syncType)                    // 0xB287BD61
sceGeContinue()                            // 0x4C06E472
sceGeBreak(mode, pParam)                   // 0xB448EC0D
sceGeSetCallback(cb)                       // 0xA4FC06A4
sceGeUnsetCallback(cbid)                   // 0x05DB22CE
```

#### sceAudio (13 functions)
```typescript
sceAudioChReserve(channel, sampleCount, format) // 0x5EC81C55
sceAudioChRelease(channel)                 // 0x6FC46853
sceAudioOutput(channel, vol, buf)          // 0x8C1009B2
sceAudioOutputBlocking(channel, vol, buf)  // 0x136CAF51
sceAudioOutputPanned(channel, volL, volR, buf) // 0xE2D56B2D
sceAudioOutputPannedBlocking(...)          // 0x13F592BC
sceAudioGetChannelRestLen(channel)         // 0xB7E1D8E7
sceAudioSetChannelDataLen(channel, len)    // 0xCB2E439E
sceAudioChangeChannelConfig(channel, format) // 0x95FD0C2D
sceAudioChangeChannelVolume(channel, volL, volR) // 0xB7E1D8E7
sceAudioOutput2Reserve(sampleCount)        // 0x01562BA3
sceAudioOutput2Release()                   // 0x43196845
sceAudioOutput2OutputBlocking(vol, buf)    // 0x2D53F36E
```

#### sceRtc (9 functions)
```typescript
sceRtcGetCurrentTick(tick)                 // 0x3F7AD767
sceRtcGetCurrentClock(time, tz)            // 0x4CFA57B0
sceRtcGetCurrentClockLocalTime(time)       // 0xE7C27D1B
sceRtcGetDayOfWeek(year, month, day)       // 0x57726BC1
sceRtcGetDaysInMonth(year, month)          // 0x05EF322C
sceRtcSetTick(time, tick)                  // 0x7ED29E40
sceRtcGetTick(time, tick)                  // 0x6FF40ACC
sceRtcTickAddTicks(destTick, srcTick, add) // 0x44F45E05
sceRtcCompareTick(tick1, tick2)            // 0x9ED0AE87
```

### Priority 3: Extended Functionality

#### scePower (28 functions)
```typescript
scePowerRegisterCallback(slot, cbid)       // 0x04B7766E
scePowerUnregisterCallback(slot)           // 0xDFA8BAF8
scePowerIsPowerOnline()                    // 0x87440F5E
scePowerIsBatteryExist()                   // 0x0AFD0D8B
scePowerIsBatteryCharging()                // 0x1E490401
scePowerGetBatteryChargingStatus()         // 0xB4432BC8
scePowerIsLowBattery()                     // 0xD3075926
scePowerGetBatteryLifePercent()            // 0x2085D15D
scePowerGetBatteryLifeTime()               // 0x8EFB3FA2
scePowerGetBatteryTemp()                   // 0x28E12023
scePowerSetClockFrequency(pll, cpu, bus)   // 0x737486F2
scePowerGetCpuClockFrequency()             // 0xFEE03A2F
scePowerGetBusClockFrequency()             // 0x478FE6F5
// ... and more
```

#### sceUtility (11 functions)
```typescript
sceUtilityLoadModule(module)               // 0x2A2B3DE0
sceUtilityUnloadModule(module)             // 0xE49BFE92
sceUtilitySavedataInitStart(params)        // 0x50C4CD57
sceUtilitySavedataGetStatus()              // 0x8874DBE0
sceUtilitySavedataShutdownStart()          // 0x9790B33C
sceUtilitySavedataUpdate(unknown)          // 0xD4B95FFB
sceUtilityMsgDialogInitStart(params)       // 0x2AD8E239
sceUtilityMsgDialogGetStatus()             // 0x9A1C91D7
sceUtilityMsgDialogShutdownStart()         // 0x67AF3428
sceUtilityMsgDialogUpdate(n)               // 0x95FC253B
sceUtilityMsgDialogAbort()                 // 0x4928BD96
```

### Priority 4: Media/Codec Support

#### sceSasCore (25 functions)
PSP Software Audio Synthesis - Required for many games' sound effects.

#### sceAtrac3plus (21 functions)
ATRAC3+ audio codec - Required for music playback.

#### sceMpeg (17 functions)
MPEG video decoding - Required for video cutscenes.

### Priority 5: Network (Optional)

Most games work without network support. Implement only if needed:

- sceNet, sceNetAdhoc, sceNetAdhocctl
- sceNetAdhocMatching (for multiplayer)
- sceNetInet, sceNetResolver (for internet)
- sceHttp (for DLC/updates)

## Implementation Roadmap

### Phase 1: Minimal Playable
```
Week 1-2:
├── sceDisplay (VBlank sync, frame buffer)
├── sceCtrl (input handling)
└── Semaphores + Event Flags

Week 3-4:
├── sceGe_user (GPU command queue)
└── sceAudio (basic audio output)
```

### Phase 2: Good Compatibility
```
Week 5-6:
├── sceRtc (time functions)
├── scePower (clock frequency, battery)
└── Mutexes, VPL, FPL

Week 7-8:
├── sceUtility (save data dialogs)
├── LoadExecForUser (module loading)
└── ModuleMgrForUser
```

### Phase 3: Full Compatibility
```
Week 9-12:
├── sceSasCore (software audio)
├── sceAtrac3plus (audio codec)
├── sceMpeg (video codec)
└── sceLibFont (text rendering)
```

### Phase 4: Network/Extras
```
Week 13+:
├── Network stack (if needed)
├── PlayStation Network stubs
└── Remaining modules
```

## Stub Implementation

For modules not yet implemented, create stubs that return appropriate errors:

```typescript
@hleModule('sceDisplay')
export class sceDisplay {
  readonly name = 'sceDisplay';

  @nativeFunction(0x0E20F177, 150)
  sceDisplaySetMode(): number {
    console.warn('STUB: sceDisplaySetMode');
    return 0;  // Success - pretend it worked
  }

  @nativeFunction(0x36CDFADE, 150)
  sceDisplayWaitVblank(): number | Promise<number> {
    // Wait ~16.67ms (60fps)
    return new Promise(resolve => {
      setTimeout(() => resolve(0), 16);
    });
  }
}
```

## Testing Module Implementation

For each module, create tests:

```typescript
describe('sceDisplay', () => {
  it('should set display mode', async () => {
    const ctx = createTestContext();
    ctx.moduleManager.registerModule(sceDisplay);

    // Simulate syscall
    ctx.setGpr(4, 0);    // mode
    ctx.setGpr(5, 480);  // width
    ctx.setGpr(6, 272);  // height

    const result = await ctx.moduleManager.call(0x0E20F177);
    expect(result).toBe(0);
  });
});
```
