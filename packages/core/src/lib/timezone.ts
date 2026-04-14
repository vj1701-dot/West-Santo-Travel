type LocalDateTimeParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

function parseLocalDateTime(input: string): LocalDateTimeParts {
  const normalized = input.trim();
  const match = normalized.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?$/,
  );

  if (!match) {
    throw new Error(`Invalid local datetime: ${input}`);
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: Number(match[6] ?? "0"),
  };
}

function partsToEpoch(parts: LocalDateTimeParts) {
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
}

function getFormatter(timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getZonedParts(value: Date, timeZone: string): LocalDateTimeParts {
  const formatter = getFormatter(timeZone);
  const rawParts = formatter.formatToParts(value);
  const partMap = Object.fromEntries(rawParts.map((part) => [part.type, part.value]));

  return {
    year: Number(partMap.year),
    month: Number(partMap.month),
    day: Number(partMap.day),
    hour: Number(partMap.hour),
    minute: Number(partMap.minute),
    second: Number(partMap.second),
  };
}

export function localDateTimeStringToDate(input: string) {
  const parts = parseLocalDateTime(input);
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second));
}

export function zonedLocalDateTimeToUtc(input: string, timeZone: string) {
  const targetParts = parseLocalDateTime(input);
  const targetEpoch = partsToEpoch(targetParts);
  let guess = new Date(targetEpoch);

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const actualParts = getZonedParts(guess, timeZone);
    const actualEpoch = partsToEpoch(actualParts);
    const delta = targetEpoch - actualEpoch;

    if (delta === 0) {
      return guess;
    }

    guess = new Date(guess.getTime() + delta);
  }

  return guess;
}
