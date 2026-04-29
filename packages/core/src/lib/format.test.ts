import test from "node:test";
import assert from "node:assert/strict";

import { buildGoogleFlightStatusUrl } from "./format";

test("buildGoogleFlightStatusUrl includes departure time when provided", () => {
  const value = buildGoogleFlightStatusUrl({
    airlineCode: "AA",
    flightNumber: "2282",
    departureDate: "2026-04-28",
    departureTime: "08:30",
  });

  assert.equal(
    value,
    "https://www.google.com/search?q=AA2282%20flight%20status%202026-04-28%2008%3A30",
  );
});

test("buildGoogleFlightStatusUrl omits departure time when missing", () => {
  const value = buildGoogleFlightStatusUrl({
    airlineCode: "UA",
    flightNumber: "1936",
    departureDate: "2026-04-28",
  });

  assert.equal(
    value,
    "https://www.google.com/search?q=UA1936%20flight%20status%202026-04-28",
  );
});
