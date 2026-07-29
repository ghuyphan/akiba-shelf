import {
  safeLocalStorageGet,
  safeLocalStorageRemove,
  safeLocalStorageSet,
  safeSessionStorageGet,
  safeSessionStorageRemove,
  safeSessionStorageSet,
} from "./safeStorage";

const PBKDF2_ITERATIONS = 120_000;
const UNLOCK_TTL_MS = 5 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 30 * 1000;
const PIN_KEY_PREFIX = "matsuri-offline-event-pin-v1:";
const UNLOCK_KEY_PREFIX = "matsuri-offline-event-unlocked-v1:";
const memoryUnlocks = new Map<string, number>();
export const OFFLINE_EVENT_ACCESS_UPDATED =
  "matsuri:offline-event-access-updated";

type PinRecord = {
  version: 1;
  salt: string;
  hash: string;
  iterations: number;
  failedAttempts: number;
  blockedUntil?: number;
  updatedAt: string;
};

type PinVerification = { ok: true } | { ok: false; blockedUntil?: number };

function pinKey(shopId: string) {
  return `${PIN_KEY_PREFIX}${shopId}`;
}

function unlockKey(shopId: string) {
  return `${UNLOCK_KEY_PREFIX}${shopId}`;
}

function dispatchAccessUpdated(shopId: string) {
  window.dispatchEvent(
    new CustomEvent(OFFLINE_EVENT_ACCESS_UPDATED, { detail: { shopId } }),
  );
}

function assertPin(pin: string) {
  if (!/^\d{6}$/.test(pin))
    throw new Error("Tablet PIN must contain exactly 6 digits.");
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function derivePinHash(
  pin: string,
  salt: Uint8Array,
  iterations: number,
) {
  const saltBuffer = new ArrayBuffer(salt.byteLength);
  new Uint8Array(saltBuffer).set(salt);
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBuffer, iterations, hash: "SHA-256" },
    key,
    256,
  );
  return new Uint8Array(bits);
}

function constantTimeEqual(first: Uint8Array, second: Uint8Array) {
  if (first.length !== second.length) return false;
  let difference = 0;
  for (let index = 0; index < first.length; index += 1)
    difference |= first[index] ^ second[index];
  return difference === 0;
}

function readRecord(shopId: string): PinRecord | null {
  const value = safeLocalStorageGet(pinKey(shopId));
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<PinRecord>;
    if (
      parsed.version !== 1 ||
      typeof parsed.salt !== "string" ||
      typeof parsed.hash !== "string" ||
      parsed.iterations !== PBKDF2_ITERATIONS ||
      typeof parsed.failedAttempts !== "number" ||
      !Number.isInteger(parsed.failedAttempts) ||
      parsed.failedAttempts < 0 ||
      parsed.failedAttempts >= MAX_FAILED_ATTEMPTS ||
      (parsed.blockedUntil !== undefined &&
        (!Number.isFinite(parsed.blockedUntil) || parsed.blockedUntil <= 0))
    )
      return null;
    if (
      base64ToBytes(parsed.salt).byteLength !== 16 ||
      base64ToBytes(parsed.hash).byteLength !== 32
    )
      return null;
    return parsed as PinRecord;
  } catch {
    return null;
  }
}

function writeRecord(shopId: string, record: PinRecord) {
  if (!safeLocalStorageSet(pinKey(shopId), JSON.stringify(record)))
    throw new Error("Tablet PIN storage is unavailable on this device.");
}

export function hasEventDevicePin(shopId: string) {
  return Boolean(readRecord(shopId));
}

export async function setEventDevicePin(shopId: string, pin: string) {
  assertPin(pin);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derivePinHash(pin, salt, PBKDF2_ITERATIONS);
  writeRecord(shopId, {
    version: 1,
    salt: bytesToBase64(salt),
    hash: bytesToBase64(hash),
    iterations: PBKDF2_ITERATIONS,
    failedAttempts: 0,
    updatedAt: new Date().toISOString(),
  });
  unlockEventAdmin(shopId);
}

export async function verifyEventDevicePin(
  shopId: string,
  pin: string,
): Promise<PinVerification> {
  assertPin(pin);
  const record = readRecord(shopId);
  if (!record) return { ok: false };
  const now = Date.now();
  if (record.blockedUntil && record.blockedUntil > now)
    return { ok: false, blockedUntil: record.blockedUntil };

  const hash = await derivePinHash(
    pin,
    base64ToBytes(record.salt),
    record.iterations,
  );
  if (constantTimeEqual(hash, base64ToBytes(record.hash))) {
    writeRecord(shopId, {
      ...record,
      failedAttempts: 0,
      blockedUntil: undefined,
      updatedAt: new Date().toISOString(),
    });
    unlockEventAdmin(shopId);
    return { ok: true };
  }

  const failedAttempts = record.failedAttempts + 1;
  writeRecord(shopId, {
    ...record,
    failedAttempts: failedAttempts >= MAX_FAILED_ATTEMPTS ? 0 : failedAttempts,
    blockedUntil:
      failedAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : undefined,
    updatedAt: new Date().toISOString(),
  });
  return {
    ok: false,
    blockedUntil:
      failedAttempts >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_MS : undefined,
  };
}

export function unlockEventAdmin(shopId: string) {
  const expiresAt = Date.now() + UNLOCK_TTL_MS;
  memoryUnlocks.set(shopId, expiresAt);
  safeSessionStorageSet(unlockKey(shopId), String(expiresAt));
  dispatchAccessUpdated(shopId);
}

export function getEventAdminUnlockExpiresAt(shopId: string) {
  const value = safeSessionStorageGet(unlockKey(shopId));
  const storedExpiresAt = value ? Number(value) : 0;
  const expiresAt = Math.max(
    Number.isFinite(storedExpiresAt) ? storedExpiresAt : 0,
    memoryUnlocks.get(shopId) ?? 0,
  );
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    memoryUnlocks.delete(shopId);
    safeSessionStorageRemove(unlockKey(shopId));
    return null;
  }
  return expiresAt;
}

export function isEventAdminUnlocked(shopId: string) {
  return getEventAdminUnlockExpiresAt(shopId) !== null;
}

export function lockEventAdmin(shopId: string) {
  memoryUnlocks.delete(shopId);
  safeSessionStorageRemove(unlockKey(shopId));
  dispatchAccessUpdated(shopId);
}

export function clearEventDevicePin(shopId: string) {
  safeLocalStorageRemove(pinKey(shopId));
  lockEventAdmin(shopId);
}
