export type GoogleSheetsPassengerLike = {
  firstName?: string | null;
  lastName?: string | null;
  rawDisplayName?: string | null;
  primaryDisplayName?: string | null;
  isExtraSeat?: boolean | null;
};

const EXTRA_SEAT_PREFIX_PATTERN = /^(?:exst|exts|xs)\s*/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeName(value?: string | null) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitDisplayName(displayName: string) {
  const parts = normalizeText(displayName).split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return {
      firstName: "",
      lastName: "",
    };
  }

  if (parts.length === 1) {
    return {
      firstName: parts[0],
      lastName: "",
    };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function stripExtraSeatPrefix(displayName: string) {
  const normalized = normalizeText(displayName).replace(/\s+/g, " ");
  const stripped = normalized.replace(EXTRA_SEAT_PREFIX_PATTERN, "").trim();

  return {
    isExtraSeat: stripped.length > 0 && stripped !== normalized,
    primaryDisplayName: stripped || normalized,
  };
}

export function normalizeGoogleSheetsPassenger(input: GoogleSheetsPassengerLike) {
  const rawFirstName = normalizeText(input.firstName);
  const rawLastName = normalizeText(input.lastName);
  const rawDisplayName = normalizeText(input.rawDisplayName) || `${rawFirstName} ${rawLastName}`.trim();
  const stripped = stripExtraSeatPrefix(rawDisplayName);
  const providedPrimaryDisplayName = normalizeText(input.primaryDisplayName);
  const primaryDisplayName = providedPrimaryDisplayName || stripped.primaryDisplayName || rawDisplayName;
  const splitName = splitDisplayName(primaryDisplayName);

  return {
    firstName: splitName.firstName || rawFirstName,
    lastName: splitName.lastName || rawLastName,
    rawDisplayName,
    primaryDisplayName: `${splitName.firstName} ${splitName.lastName}`.trim() || primaryDisplayName,
    isExtraSeat: input.isExtraSeat === true || stripped.isExtraSeat,
  };
}

export function dedupeGoogleSheetsPassengers<T extends GoogleSheetsPassengerLike>(passengers: T[]) {
  const passengerMap = new Map<string, ReturnType<typeof normalizeGoogleSheetsPassenger>>();

  for (const passenger of passengers) {
    const normalizedPassenger = normalizeGoogleSheetsPassenger(passenger);
    const key = normalizeName(`${normalizedPassenger.firstName} ${normalizedPassenger.lastName}`);
    if (!key || passengerMap.has(key)) {
      continue;
    }

    passengerMap.set(key, normalizedPassenger);
  }

  return Array.from(passengerMap.values());
}

export function buildGoogleSheetsTripIdentityKey(input: {
  locatorNumber?: string | null;
  airline: string;
  flightNumber: string;
  departureAirport: string;
  departureDate: string;
  departureTime: string;
  arrivalAirport: string;
  arrivalDate: string;
  arrivalTime: string;
}) {
  return [
    normalizeText(input.airline).toUpperCase(),
    normalizeText(input.flightNumber).toUpperCase(),
    normalizeText(input.departureAirport).toUpperCase(),
    normalizeText(input.departureDate),
    normalizeText(input.departureTime),
    normalizeText(input.arrivalAirport).toUpperCase(),
    normalizeText(input.arrivalDate),
    normalizeText(input.arrivalTime),
  ].join("|");
}

export function classifyTelegramLinkInput(rawInput: string) {
  const normalizedInput = rawInput.trim();
  if (EMAIL_PATTERN.test(normalizedInput)) {
    return {
      kind: "email" as const,
      email: normalizedInput.toLowerCase(),
    };
  }

  const phone = normalizedInput.replace(/\D/g, "");
  return {
    kind: "phone" as const,
    phone: phone.length > 0 ? phone : null,
    normalizedInput,
  };
}
