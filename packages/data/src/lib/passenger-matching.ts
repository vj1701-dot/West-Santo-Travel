export type PassengerNameRecord = {
  id: string;
  firstName: string;
  lastName: string;
  legalName?: string | null;
};

export type PassengerNameMatchStrategy =
  | "exact_full"
  | "exact_swapped"
  | "fuzzy_full"
  | "fuzzy_swapped";

export type PassengerNameMatchResult =
  | {
      status: "MATCHED";
      passenger: PassengerNameRecord;
      strategy: PassengerNameMatchStrategy;
      candidates: PassengerNameRecord[];
    }
  | {
      status: "AMBIGUOUS";
      passenger: null;
      strategy: null;
      candidates: PassengerNameRecord[];
    }
  | {
      status: "UNRESOLVED";
      passenger: null;
      strategy: null;
      candidates: PassengerNameRecord[];
    };

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

export function normalizePassengerMatchName(value?: string | null) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePassengerFullName(firstName?: string | null, lastName?: string | null) {
  return normalizePassengerMatchName(`${normalizeText(firstName)} ${normalizeText(lastName)}`);
}

function levenshteinDistance(source: string, target: string) {
  if (source === target) {
    return 0;
  }

  if (!source.length) {
    return target.length;
  }

  if (!target.length) {
    return source.length;
  }

  const rows = Array.from({ length: target.length + 1 }, (_, index) => index);

  for (let sourceIndex = 1; sourceIndex <= source.length; sourceIndex += 1) {
    let previous = rows[0];
    rows[0] = sourceIndex;

    for (let targetIndex = 1; targetIndex <= target.length; targetIndex += 1) {
      const current = rows[targetIndex];
      const substitutionCost = source[sourceIndex - 1] === target[targetIndex - 1] ? 0 : 1;
      rows[targetIndex] = Math.min(rows[targetIndex] + 1, rows[targetIndex - 1] + 1, previous + substitutionCost);
      previous = current;
    }
  }

  return rows[target.length];
}

function getSimilarityScore(left: string, right: string) {
  if (!left || !right) {
    return 0;
  }

  if (left === right) {
    return 1;
  }

  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

type ScoredPassengerCandidate = {
  passenger: PassengerNameRecord;
  score: number;
};

function summarizeCandidates(entries: ScoredPassengerCandidate[]) {
  return entries
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.passenger);
}

function pickConfidentMatch(entries: ScoredPassengerCandidate[], threshold = 0.92) {
  const scored = entries
    .filter((entry) => entry.score >= threshold)
    .sort((left, right) => right.score - left.score);

  if (scored.length === 0) {
    return null;
  }

  if (scored.length === 1) {
    return { winner: scored[0], candidates: scored };
  }

  if (scored[0].score - scored[1].score >= 0.05) {
    return { winner: scored[0], candidates: scored };
  }

  return { winner: null, candidates: scored };
}

function pickAmbiguousCandidates(entries: ScoredPassengerCandidate[], threshold = 0.75) {
  const scored = entries
    .filter((entry) => entry.score >= threshold)
    .sort((left, right) => right.score - left.score);

  if (scored.length < 2) {
    return null;
  }

  if (scored[0].score - scored[1].score < 0.05) {
    return scored;
  }

  return null;
}

export function matchPassengerByName(
  passengers: PassengerNameRecord[],
  input: { firstName: string; lastName: string },
): PassengerNameMatchResult {
  const normalizedTarget = normalizePassengerFullName(input.firstName, input.lastName);
  const normalizedSwappedTarget = normalizePassengerFullName(input.lastName, input.firstName);

  if (!normalizedTarget) {
    return {
      status: "UNRESOLVED",
      passenger: null,
      strategy: null,
      candidates: [],
    };
  }

  const exactFullMatches = passengers.filter((passenger) => {
    const normalizedPassengerName = normalizePassengerFullName(passenger.firstName, passenger.lastName);
    const normalizedLegalName = normalizePassengerMatchName(passenger.legalName);
    return normalizedPassengerName === normalizedTarget || normalizedLegalName === normalizedTarget;
  });
  if (exactFullMatches.length === 1) {
    return {
      status: "MATCHED",
      passenger: exactFullMatches[0],
      strategy: "exact_full",
      candidates: exactFullMatches,
    };
  }
  if (exactFullMatches.length > 1) {
    return {
      status: "AMBIGUOUS",
      passenger: null,
      strategy: null,
      candidates: exactFullMatches,
    };
  }

  const exactSwappedMatches = passengers.filter((passenger) => {
    const normalizedPassengerName = normalizePassengerFullName(passenger.firstName, passenger.lastName);
    const normalizedLegalName = normalizePassengerMatchName(passenger.legalName);
    return normalizedPassengerName === normalizedSwappedTarget || normalizedLegalName === normalizedSwappedTarget;
  });
  if (exactSwappedMatches.length === 1) {
    return {
      status: "MATCHED",
      passenger: exactSwappedMatches[0],
      strategy: "exact_swapped",
      candidates: exactSwappedMatches,
    };
  }
  if (exactSwappedMatches.length > 1) {
    return {
      status: "AMBIGUOUS",
      passenger: null,
      strategy: null,
      candidates: exactSwappedMatches,
    };
  }

  const fuzzyFullScores = passengers.map((passenger) => ({
    passenger,
    score: Math.max(
      getSimilarityScore(normalizePassengerFullName(passenger.firstName, passenger.lastName), normalizedTarget),
      getSimilarityScore(normalizePassengerMatchName(passenger.legalName), normalizedTarget),
    ),
  }));
  const fuzzyFullMatch = pickConfidentMatch(fuzzyFullScores);
  if (fuzzyFullMatch?.winner) {
    return {
      status: "MATCHED",
      passenger: fuzzyFullMatch.winner.passenger,
      strategy: "fuzzy_full",
      candidates: summarizeCandidates(fuzzyFullMatch.candidates),
    };
  }
  if (fuzzyFullMatch && fuzzyFullMatch.candidates.length > 1) {
    return {
      status: "AMBIGUOUS",
      passenger: null,
      strategy: null,
      candidates: summarizeCandidates(fuzzyFullMatch.candidates),
    };
  }
  const fuzzyFullAmbiguous = pickAmbiguousCandidates(fuzzyFullScores);
  if (fuzzyFullAmbiguous) {
    return {
      status: "AMBIGUOUS",
      passenger: null,
      strategy: null,
      candidates: summarizeCandidates(fuzzyFullAmbiguous),
    };
  }

  const fuzzySwappedScores = passengers.map((passenger) => ({
    passenger,
    score: Math.max(
      getSimilarityScore(normalizePassengerFullName(passenger.firstName, passenger.lastName), normalizedSwappedTarget),
      getSimilarityScore(normalizePassengerMatchName(passenger.legalName), normalizedSwappedTarget),
    ),
  }));
  const fuzzySwappedMatch = pickConfidentMatch(fuzzySwappedScores);
  if (fuzzySwappedMatch?.winner) {
    return {
      status: "MATCHED",
      passenger: fuzzySwappedMatch.winner.passenger,
      strategy: "fuzzy_swapped",
      candidates: summarizeCandidates(fuzzySwappedMatch.candidates),
    };
  }
  if (fuzzySwappedMatch && fuzzySwappedMatch.candidates.length > 1) {
    return {
      status: "AMBIGUOUS",
      passenger: null,
      strategy: null,
      candidates: summarizeCandidates(fuzzySwappedMatch.candidates),
    };
  }
  const fuzzySwappedAmbiguous = pickAmbiguousCandidates(fuzzySwappedScores);
  if (fuzzySwappedAmbiguous) {
    return {
      status: "AMBIGUOUS",
      passenger: null,
      strategy: null,
      candidates: summarizeCandidates(fuzzySwappedAmbiguous),
    };
  }

  return {
    status: "UNRESOLVED",
    passenger: null,
    strategy: null,
    candidates: [],
  };
}
