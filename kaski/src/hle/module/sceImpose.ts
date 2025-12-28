/**
 * sceImpose
 *
 * System impose (overlay) module.
 * Handles battery status, language, and button settings.
 */

import { hleModule, nativeFunction } from '../manager/ModuleManager';
import type { EmulatorContext } from '../EmulatorContext';
import { SceKernelErrors } from '../errors';

/**
 * PSP languages
 */
export const enum PspLanguage
{
  Japanese = 0,
  English = 1,
  French = 2,
  Spanish = 3,
  German = 4,
  Italian = 5,
  Dutch = 6,
  Portuguese = 7,
  Russian = 8,
  Korean = 9,
  ChineseTraditional = 10,
  ChineseSimplified = 11,
}

/**
 * Button preference (confirm button)
 */
export const enum ButtonPreference
{
  Circle = 0,  // Japan/Asia
  Cross = 1,   // US/EU
}

/**
 * Charging type
 */
export const enum ChargingType
{
  NotCharging = 0,
  Charging = 1,
}

/**
 * Battery icon status
 */
export const enum BatteryIconStatus
{
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  Full = 4,
}

@hleModule('sceImpose')
export class sceImpose
{
  readonly name = 'sceImpose';

  private ctx!: EmulatorContext;

  // Configuration
  private language: PspLanguage = PspLanguage.English;
  private buttonPreference: ButtonPreference = ButtonPreference.Cross;

  // Battery status (always full in emulator)
  private chargingType: ChargingType = ChargingType.Charging;
  private iconStatus: BatteryIconStatus = BatteryIconStatus.Full;

  init(ctx: EmulatorContext): void
  {
    this.ctx = ctx;
  }

  /**
   * sceImposeGetBatteryIconStatus
   * Get battery charging and icon status
   *
   * @param isChargingPtr - Output charging type
   * @param iconStatusPtr - Output icon status
   * @returns 0 on success
   */
  @nativeFunction(0x8C943191, 150)
  sceImposeGetBatteryIconStatus(): number
  {
    const isChargingPtr = this.ctx.argPtr(0);
    const iconStatusPtr = this.ctx.argPtr(1);

    if (isChargingPtr)
    {
      this.ctx.write32(isChargingPtr, this.chargingType);
    }
    if (iconStatusPtr)
    {
      this.ctx.write32(iconStatusPtr, this.iconStatus);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceImposeSetLanguageMode
   * Set language and button preference
   *
   * @param language - Language ID
   * @param buttonPreference - Button preference
   * @returns 0 on success
   */
  @nativeFunction(0x36AA6E91, 150)
  sceImposeSetLanguageMode(): number
  {
    const language = this.ctx.arg(0) as PspLanguage;
    const buttonPref = this.ctx.arg(1) as ButtonPreference;

    this.language = language;
    this.buttonPreference = buttonPref;

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceImposeGetLanguageMode
   * Get language and button preference
   *
   * @param languagePtr - Output language
   * @param buttonPreferencePtr - Output button preference
   * @returns 0 on success
   */
  @nativeFunction(0x24FD7BCF, 150)
  sceImposeGetLanguageMode(): number
  {
    const languagePtr = this.ctx.argPtr(0);
    const buttonPrefPtr = this.ctx.argPtr(1);

    if (languagePtr)
    {
      this.ctx.write32(languagePtr, this.language);
    }
    if (buttonPrefPtr)
    {
      this.ctx.write32(buttonPrefPtr, this.buttonPreference);
    }

    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceImposeGetUMDPopup
   * Get UMD popup status
   *
   * @returns 0 (disabled)
   */
  @nativeFunction(0xE0887BC8, 150)
  sceImposeGetUMDPopup(): number
  {
    return 0; // Disabled
  }

  /**
   * sceImposeSetUMDPopup
   * Set UMD popup status
   *
   * @param value - Enable/disable
   * @returns 0 on success
   */
  @nativeFunction(0x5595A71A, 150)
  sceImposeSetUMDPopup(): number
  {
    // Ignore - no UMD popup in emulator
    return SceKernelErrors.ERROR_OK;
  }

  /**
   * sceImposeGetHomePopup
   * Get home popup status
   *
   * @returns 1 (enabled)
   */
  @nativeFunction(0x0F341BE4, 150)
  sceImposeGetHomePopup(): number
  {
    return 1; // Enabled
  }

  /**
   * sceImposeSetHomePopup
   * Set home popup status
   *
   * @param value - Enable/disable
   * @returns 0 on success
   */
  @nativeFunction(0x116CFF64, 150)
  sceImposeSetHomePopup(): number
  {
    // Ignore
    return SceKernelErrors.ERROR_OK;
  }
}
