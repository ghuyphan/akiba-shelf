type ResolveDns = (
  query: string,
  recordType: "A" | "AAAA",
) => Promise<string[]>;

export const dnsResolver = {
  resolve: ((query, recordType) =>
    Deno.resolveDns(query, recordType)) as ResolveDns,
};

const providerHosts = [
  "fcm.googleapis.com",
  "updates.push.services.mozilla.com",
  "web.push.apple.com",
  "*.notify.windows.com",
];

function allowedHost(hostname: string) {
  const configured = (Deno.env.get("PUSH_ENDPOINT_HOSTS") ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...providerHosts, ...configured].some((pattern) =>
    pattern.startsWith("*.")
      ? hostname.endsWith(pattern.slice(1))
      : hostname === pattern,
  );
}

function decodeBase64Url(value: string) {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
    return Uint8Array.from(atob(normalized + padding), (char) =>
      char.charCodeAt(0),
    );
  } catch {
    return null;
  }
}

export async function validPushKeyMaterial(p256dh: string, auth: string) {
  const publicKey = decodeBase64Url(p256dh);
  const authSecret = decodeBase64Url(auth);
  if (
    publicKey?.byteLength !== 65 ||
    publicKey[0] !== 0x04 ||
    authSecret?.byteLength !== 16
  ) {
    return false;
  }
  try {
    await crypto.subtle.importKey(
      "raw",
      publicKey,
      { name: "ECDH", namedCurve: "P-256" },
      false,
      [],
    );
    return true;
  } catch {
    return false;
  }
}

function parseIpv4(value: string) {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map(Number);
  return octets.every(
    (part) => Number.isInteger(part) && part >= 0 && part <= 255,
  )
    ? octets
    : null;
}

function isPrivateIpv4(value: string) {
  const octets = parseIpv4(value);
  if (!octets) return false;
  const [a, b] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

function isPrivateIpv6(value: string) {
  const normalized = value.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1];
  if (mapped) return isPrivateIpv4(mapped);
  const mappedHex = normalized.match(
    /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/,
  );
  if (!mappedHex) return false;
  const high = Number.parseInt(mappedHex[1], 16);
  const low = Number.parseInt(mappedHex[2], 16);
  return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
}

export function isPublicAddress(value: string) {
  return !isPrivateIpv4(value) && !isPrivateIpv6(value);
}

export function normalizePushEndpoint(value: string) {
  if (value.length < 1 || value.length > 2_048 || /\s/.test(value)) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    return null;
  }

  return url.toString();
}

export async function validatePushEndpoint(value: string) {
  const result = await inspectPushEndpoint(value);
  return result.status === "valid" ? result.endpoint : null;
}

export async function inspectPushEndpoint(
  value: string,
): Promise<
  { status: "valid"; endpoint: string } | { status: "invalid" | "unavailable" }
> {
  const normalized = normalizePushEndpoint(value);
  if (!normalized) return { status: "invalid" };
  const url = new URL(normalized);
  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    !allowedHost(hostname) ||
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal") ||
    isPrivateIpv4(hostname) ||
    isPrivateIpv6(hostname)
  ) {
    return { status: "invalid" };
  }

  if (!parseIpv4(hostname) && !hostname.includes(":")) {
    try {
      const [ipv4, ipv6] = await Promise.all([
        resolveWithTimeout(hostname, "A"),
        resolveWithTimeout(hostname, "AAAA"),
      ]);
      if (ipv4 === null || ipv6 === null) return { status: "unavailable" };
      const addresses = [...ipv4, ...ipv6];
      if (
        addresses.length === 0 ||
        addresses.some((address) => !isPublicAddress(address))
      ) {
        return { status: "invalid" };
      }
    } catch {
      return { status: "unavailable" };
    }
  }

  return { status: "valid", endpoint: normalized };
}

async function resolveWithTimeout(hostname: string, recordType: "A" | "AAAA") {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      dnsResolver.resolve(hostname, recordType).catch((error: unknown) => {
        const code =
          error && typeof error === "object" && "code" in error
            ? String(error.code)
            : "";
        return code === "ENODATA" || code === "ENOTFOUND" ? [] : null;
      }),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), 3_000);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
