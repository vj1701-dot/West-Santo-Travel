import test from "node:test";
import assert from "node:assert/strict";

import { localDateTimeStringToDate, zonedLocalDateTimeToUtc } from "./timezone";

test("localDateTimeStringToDate preserves the literal local timestamp fields", () => {
  const value = localDateTimeStringToDate("2026-05-12T14:30");

  assert.equal(value.toISOString(), "2026-05-12T14:30:00.000Z");
});

test("zonedLocalDateTimeToUtc converts winter Pacific time correctly", () => {
  const value = zonedLocalDateTimeToUtc("2026-01-15T12:00", "America/Los_Angeles");

  assert.equal(value.toISOString(), "2026-01-15T20:00:00.000Z");
});

test("zonedLocalDateTimeToUtc converts summer Pacific time correctly", () => {
  const value = zonedLocalDateTimeToUtc("2026-07-15T12:00", "America/Los_Angeles");

  assert.equal(value.toISOString(), "2026-07-15T19:00:00.000Z");
});
