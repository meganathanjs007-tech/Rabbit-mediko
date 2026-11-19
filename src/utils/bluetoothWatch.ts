export interface WatchReadingsSnapshot {
  heartRate?: number;
  spo2?: number;
  systolic?: number;
  diastolic?: number;
  battery?: number;
  updatedAt: string;
}

export interface WatchConnectionSession {
  deviceName: string;
  disconnect: () => void;
}

interface BluetoothRemoteGATTCharacteristicLike {
  value?: DataView;
  readValue: () => Promise<DataView>;
  startNotifications: () => Promise<BluetoothRemoteGATTCharacteristicLike>;
  addEventListener: (type: string, listener: (ev: Event) => void) => void;
}

interface BluetoothRemoteGATTServiceLike {
  getCharacteristic: (uuid: string | number) => Promise<BluetoothRemoteGATTCharacteristicLike>;
}

interface BluetoothRemoteGATTServerLike {
  connected: boolean;
  connect: () => Promise<BluetoothRemoteGATTServerLike>;
  disconnect: () => void;
  getPrimaryService: (uuid: string | number) => Promise<BluetoothRemoteGATTServiceLike>;
}

interface BluetoothDeviceLike {
  name?: string;
  gatt?: BluetoothRemoteGATTServerLike;
  addEventListener: (type: string, listener: () => void) => void;
}

interface NavigatorWithBluetooth extends Navigator {
  bluetooth?: {
    requestDevice: (options: Record<string, unknown>) => Promise<BluetoothDeviceLike>;
  };
}

interface PermissionsPolicyLike {
  allowsFeature?: (feature: string) => boolean;
}

interface DocumentWithPolicy extends Document {
  featurePolicy?: PermissionsPolicyLike;
  permissionsPolicy?: PermissionsPolicyLike;
}

export class BluetoothBlockedError extends Error {
  constructor(message = 'Bluetooth is blocked inside this embedded preview frame.') {
    super(message);
    this.name = 'BluetoothBlockedError';
  }
}

export function isWebBluetoothSupported(): boolean {
  if (typeof navigator === 'undefined') return false;
  return Boolean((navigator as NavigatorWithBluetooth).bluetooth);
}

export function isBluetoothBlockedByPolicy(): boolean {
  if (typeof document === 'undefined') return false;
  const doc = document as DocumentWithPolicy;
  try {
    if (typeof doc.permissionsPolicy?.allowsFeature === 'function') {
      return !doc.permissionsPolicy.allowsFeature('bluetooth');
    }
    if (typeof doc.featurePolicy?.allowsFeature === 'function') {
      return !doc.featurePolicy.allowsFeature('bluetooth');
    }
  } catch {
    // Ignore feature-policy probe error
  }
  return false;
}

// IEEE-11073 16-bit SFLOAT decoder for GATT Blood Pressure & Pulse Oximeter characteristics
function parseSfloat(view: DataView, offset: number): number | undefined {
  if (offset + 2 > view.byteLength) return undefined;
  const raw = view.getUint16(offset, true);
  // Reserved NaN / NRes / +-Infinity sentinels in IEEE-11073
  if (raw === 0x07ff || raw === 0x0800 || raw === 0x07fe || raw === 0x0802) return undefined;

  let mantissa = raw & 0x0fff;
  if (mantissa >= 0x0800) mantissa -= 0x1000;

  let exponent = (raw >> 12) & 0x0f;
  if (exponent >= 0x08) exponent -= 0x10;

  const value = mantissa * Math.pow(10, exponent);
  return Number.isFinite(value) ? Math.round(value) : undefined;
}

function parseHeartRateMeasurement(view: DataView): number | undefined {
  if (view.byteLength < 2) return undefined;
  const flags = view.getUint8(0);
  const isUint16 = (flags & 0x01) !== 0;
  const bpm = isUint16 && view.byteLength >= 3 ? view.getUint16(1, true) : view.getUint8(1);
  return bpm >= 25 && bpm <= 260 ? bpm : undefined;
}

function parseBloodPressureMeasurement(
  view: DataView
): { systolic?: number; diastolic?: number; pulse?: number } {
  if (view.byteLength < 7) return {};
  const flags = view.getUint8(0);
  const isKpa = (flags & 0x01) !== 0;
  const hasTimestamp = (flags & 0x02) !== 0;
  const hasPulseRate = (flags & 0x04) !== 0;

  let sys = parseSfloat(view, 1);
  let dia = parseSfloat(view, 3);
  if (isKpa) {
    if (sys !== undefined) sys = Math.round(sys * 7.50062);
    if (dia !== undefined) dia = Math.round(dia * 7.50062);
  }

  let pulseOffset = 7;
  if (hasTimestamp) pulseOffset += 7;
  const pulse = hasPulseRate ? parseSfloat(view, pulseOffset) : undefined;

  return {
    systolic: sys && sys >= 40 && sys <= 320 ? sys : undefined,
    diastolic: dia && dia >= 25 && dia <= 220 ? dia : undefined,
    pulse: pulse && pulse >= 25 && pulse <= 260 ? pulse : undefined,
  };
}

function parsePulseOximeter(view: DataView): { spo2?: number; pulse?: number } {
  if (view.byteLength < 5) return {};
  const spo2 = parseSfloat(view, 1);
  const pulse = parseSfloat(view, 3);
  return {
    spo2: spo2 && spo2 >= 50 && spo2 <= 100 ? spo2 : undefined,
    pulse: pulse && pulse >= 25 && pulse <= 260 ? pulse : undefined,
  };
}

export async function connectBluetoothWatch(params: {
  scanAllDevices?: boolean;
  onReading: (snapshot: WatchReadingsSnapshot) => void;
  onDisconnect?: () => void;
}): Promise<WatchConnectionSession> {
  const bt = (navigator as NavigatorWithBluetooth).bluetooth;
  if (!bt) {
    throw new Error('Web Bluetooth is not supported in this browser. You can enter your watch readings manually below.');
  }

  const optionalServices = [
    'heart_rate',
    'blood_pressure',
    'pulse_oximeter',
    'battery_service',
    'device_information',
  ];

  const requestOptions: Record<string, unknown> = params.scanAllDevices
    ? { acceptAllDevices: true, optionalServices }
    : {
        filters: [
          { services: ['heart_rate'] },
          { services: ['blood_pressure'] },
          { services: ['pulse_oximeter'] },
        ],
        optionalServices,
      };

  const device = await bt.requestDevice(requestOptions);
  if (!device.gatt) {
    throw new Error('Selected device does not expose Bluetooth GATT health services.');
  }

  const state: WatchReadingsSnapshot = {
    updatedAt: new Date().toLocaleTimeString(),
  };

  const emit = () => {
    state.updatedAt = new Date().toLocaleTimeString();
    params.onReading({ ...state });
  };

  const server = await device.gatt.connect();

  device.addEventListener('gattserverdisconnected', () => {
    params.onDisconnect?.();
  });

  // 1. Heart Rate Service (0x180D / 0x2A37)
  try {
    const hrService = await server.getPrimaryService('heart_rate');
    const hrChar = await hrService.getCharacteristic('heart_rate_measurement');
    hrChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
      const target = ev.target as unknown as BluetoothRemoteGATTCharacteristicLike;
      if (target?.value) {
        const bpm = parseHeartRateMeasurement(target.value);
        if (bpm !== undefined) {
          state.heartRate = bpm;
          emit();
        }
      }
    });
    await hrChar.startNotifications();
  } catch {
    // Device may not expose Heart Rate GATT
  }

  // 2. Pulse Oximeter Service (0x1822 / 0x2A5F or 0x2A5E)
  try {
    const oxService = await server.getPrimaryService('pulse_oximeter');
    for (const charUuid of ['plx_continuous_measurement', 'plx_spot_check_measurement']) {
      try {
        const oxChar = await oxService.getCharacteristic(charUuid);
        oxChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
          const target = ev.target as unknown as BluetoothRemoteGATTCharacteristicLike;
          if (target?.value) {
            const { spo2, pulse } = parsePulseOximeter(target.value);
            if (spo2 !== undefined) state.spo2 = spo2;
            if (pulse !== undefined && state.heartRate === undefined) state.heartRate = pulse;
            if (spo2 !== undefined || pulse !== undefined) emit();
          }
        });
        await oxChar.startNotifications();
      } catch {
        // Optional characteristic
      }
    }
  } catch {
    // Device may not expose Pulse Oximeter GATT
  }

  // 3. Blood Pressure Service (0x1810 / 0x2A35)
  try {
    const bpService = await server.getPrimaryService('blood_pressure');
    const bpChar = await bpService.getCharacteristic('blood_pressure_measurement');
    bpChar.addEventListener('characteristicvaluechanged', (ev: Event) => {
      const target = ev.target as unknown as BluetoothRemoteGATTCharacteristicLike;
      if (target?.value) {
        const parsed = parseBloodPressureMeasurement(target.value);
        if (parsed.systolic !== undefined) state.systolic = parsed.systolic;
        if (parsed.diastolic !== undefined) state.diastolic = parsed.diastolic;
        if (parsed.pulse !== undefined) state.heartRate = parsed.pulse;
        if (parsed.systolic !== undefined || parsed.diastolic !== undefined) emit();
      }
    });
    await bpChar.startNotifications();
  } catch {
    // Device may not expose Blood Pressure GATT
  }

  // 4. Battery Service (0x180F / 0x2A19)
  try {
    const batService = await server.getPrimaryService('battery_service');
    const batChar = await batService.getCharacteristic('battery_level');
    const batView = await batChar.readValue();
    if (batView.byteLength >= 1) {
      state.battery = batView.getUint8(0);
      emit();
    }
  } catch {
    // Battery read is optional
  }

  emit();

  return {
    deviceName: device.name || 'Bluetooth Health Watch',
    disconnect: () => {
      try {
        if (server.connected) server.disconnect();
      } catch {
        // Ignore disconnect cleanup error
      }
    },
  };
}
