import test from "node:test";
import assert from "node:assert/strict";

import { matchPassengerByName } from "./passenger-matching";

const passengers = [
  { id: "p1", firstName: "John", lastName: "Doe", legalName: "Jonathan Doe" },
  { id: "p2", firstName: "Jane", lastName: "Smith", legalName: null },
  { id: "p3", firstName: "Rakesh", lastName: "Patel", legalName: "Rakeshbhai Patel" },
  { id: "p4", firstName: "Ana", lastName: "Maria", legalName: null },
  { id: "p5", firstName: "Anna", lastName: "Maria", legalName: null },
];

test("matches exact first and last name", () => {
  const result = matchPassengerByName(passengers, { firstName: "John", lastName: "Doe" });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.passenger?.id, "p1");
  assert.equal(result.strategy, "exact_full");
});

test("matches legal name only", () => {
  const result = matchPassengerByName(passengers, { firstName: "Jonathan", lastName: "Doe" });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.passenger?.id, "p1");
  assert.equal(result.strategy, "exact_full");
});

test("matches swapped names", () => {
  const result = matchPassengerByName(passengers, { firstName: "Smith", lastName: "Jane" });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.passenger?.id, "p2");
  assert.equal(result.strategy, "exact_swapped");
});

test("matches fuzzy legal name", () => {
  const result = matchPassengerByName(passengers, { firstName: "Rakeshbhai", lastName: "Patel" });
  assert.equal(result.status, "MATCHED");
  assert.equal(result.passenger?.id, "p3");
  assert.equal(result.strategy, "exact_full");
});

test("returns ambiguous instead of auto-matching weakly similar names", () => {
  const result = matchPassengerByName(passengers, { firstName: "Ann", lastName: "Maria" });
  assert.equal(result.status, "AMBIGUOUS");
  assert.equal(result.passenger, null);
  assert.ok(result.candidates.length >= 2);
});
