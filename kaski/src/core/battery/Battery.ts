/**
 * Battery - PSP Battery Controller
 *
 * Simulates PSP battery state for HLE functions.
 * Real PSP has 1800mAh battery, ~4.2V fully charged.
 */

// ============================================
// Constants
// ============================================

/** Maximum battery capacity (mAh) */
export const MAX_CAPACITY = 1800;

/** Full battery voltage (mV) */
export const FULL_VOLTAGE = 4200;

/** Low battery voltage (mV) */
export const LOW_VOLTAGE = 3600;

/** Critical battery voltage (mV) */
export const CRITICAL_VOLTAGE = 3400;

/** Battery temperature (Celsius * 100) */
export const DEFAULT_TEMP = 2500; // 25.00°C

// ============================================
// Types
// ============================================

/** Battery charging status */
export enum ChargingStatus
{
  NotCharging = 0,
  Charging = 1,
}

/** Battery presence status */
export enum BatteryPresence
{
  NotPresent = 0,
  Present = 1,
}

/** Power source */
export enum PowerSource
{
  Battery = 0,
  External = 1,
}

// ============================================
// Battery State
// ============================================

export interface BatteryState
{
  /** Battery present */
  present: boolean;

  /** Currently charging */
  charging: boolean;

  /** Using external power */
  externalPower: boolean;

  /** Low battery warning */
  lowBattery: boolean;

  /** Battery percentage (0-100) */
  percentage: number;

  /** Battery lifetime in minutes */
  lifetimeMinutes: number;

  /** Battery voltage in mV */
  voltage: number;

  /** Battery temperature (Celsius * 100) */
  temperature: number;

  /** Current capacity in mAh */
  capacity: number;
}

// ============================================
// Battery
// ============================================

export class Battery
{
  /** Battery state */
  private state: BatteryState = {
    present: true,
    charging: false,
    externalPower: true, // Emulator typically runs on "external power"
    lowBattery: false,
    percentage: 100,
    lifetimeMinutes: 300, // 5 hours
    voltage: FULL_VOLTAGE,
    temperature: DEFAULT_TEMP,
    capacity: MAX_CAPACITY,
  };

  // ---- Getters ----

  get present(): boolean { return this.state.present; }
  get charging(): boolean { return this.state.charging; }
  get externalPower(): boolean { return this.state.externalPower; }
  get lowBattery(): boolean { return this.state.lowBattery; }
  get percentage(): number { return this.state.percentage; }
  get lifetimeMinutes(): number { return this.state.lifetimeMinutes; }
  get voltage(): number { return this.state.voltage; }
  get temperature(): number { return this.state.temperature; }
  get capacity(): number { return this.state.capacity; }

  /** Get power source */
  get powerSource(): PowerSource
  {
    return this.state.externalPower ? PowerSource.External : PowerSource.Battery;
  }

  /** Get charging status */
  get chargingStatus(): ChargingStatus
  {
    return this.state.charging ? ChargingStatus.Charging : ChargingStatus.NotCharging;
  }

  /** Get battery presence */
  get batteryPresence(): BatteryPresence
  {
    return this.state.present ? BatteryPresence.Present : BatteryPresence.NotPresent;
  }

  // ---- Control Methods ----

  /**
   * Set battery percentage
   */
  setPercentage(percentage: number): void
  {
    this.state.percentage = Math.max(0, Math.min(100, percentage));
    this.state.capacity = Math.floor((this.state.percentage / 100) * MAX_CAPACITY);
    this.state.voltage = this.calculateVoltage(this.state.percentage);
    this.state.lowBattery = this.state.percentage <= 20;
    this.state.lifetimeMinutes = Math.floor(this.state.percentage * 3); // ~5 hours at 100%
  }

  /**
   * Set charging state
   */
  setCharging(charging: boolean): void
  {
    this.state.charging = charging;
    if (charging)
    {
      this.state.externalPower = true;
    }
  }

  /**
   * Set external power state
   */
  setExternalPower(external: boolean): void
  {
    this.state.externalPower = external;
    if (!external)
    {
      this.state.charging = false;
    }
  }

  /**
   * Set battery presence
   */
  setPresent(present: boolean): void
  {
    this.state.present = present;
    if (!present)
    {
      this.state.charging = false;
    }
  }

  /**
   * Set temperature (Celsius * 100)
   */
  setTemperature(temp: number): void
  {
    this.state.temperature = temp;
  }

  // ---- Simulation ----

  /**
   * Simulate battery drain over time
   */
  update(deltaMs: number): void
  {
    if (this.state.charging && this.state.percentage < 100)
    {
      // Charge at ~2% per minute
      const chargeRate = 2 / 60000; // per ms
      this.setPercentage(this.state.percentage + deltaMs * chargeRate);
    }
    else if (!this.state.externalPower && this.state.percentage > 0)
    {
      // Drain at ~0.33% per minute (5 hours total)
      const drainRate = 0.33 / 60000; // per ms
      this.setPercentage(this.state.percentage - deltaMs * drainRate);
    }
  }

  /**
   * Calculate voltage from percentage
   */
  private calculateVoltage(percentage: number): number
  {
    // Linear interpolation between critical and full voltage
    const voltageRange = FULL_VOLTAGE - CRITICAL_VOLTAGE;
    return CRITICAL_VOLTAGE + Math.floor((percentage / 100) * voltageRange);
  }

  /**
   * Reset to default state
   */
  reset(): void
  {
    this.state = {
      present: true,
      charging: false,
      externalPower: true,
      lowBattery: false,
      percentage: 100,
      lifetimeMinutes: 300,
      voltage: FULL_VOLTAGE,
      temperature: DEFAULT_TEMP,
      capacity: MAX_CAPACITY,
    };
  }
}
