import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGoogleSheetsTripIdentityKey,
  classifyTelegramLinkInput,
  dedupeGoogleSheetsPassengers,
  normalizeGoogleSheetsPassenger,
} from "./google-sheets-sync";

test("normalizeGoogleSheetsPassenger strips extra-seat aliases", () => {
  const exst = normalizeGoogleSheetsPassenger({ firstName: "EXSTDivyacharandas", lastName: "Sadhu" });
  const exts = normalizeGoogleSheetsPassenger({ firstName: "EXTS Divyacharandas", lastName: "Sadhu" });
  const xs = normalizeGoogleSheetsPassenger({ firstName: "XSDivyacharandas", lastName: "Sadhu" });
  const middle = normalizeGoogleSheetsPassenger({ firstName: "Divyacharandas xs", lastName: "Sadhu" });

  assert.deepEqual(exst, {
    firstName: "Divyacharandas",
    lastName: "Sadhu",
    rawDisplayName: "EXSTDivyacharandas Sadhu",
    primaryDisplayName: "Divyacharandas Sadhu",
    isExtraSeat: true,
  });
  assert.equal(exts.primaryDisplayName, "Divyacharandas Sadhu");
  assert.equal(xs.primaryDisplayName, "Divyacharandas Sadhu");
  assert.equal(middle.primaryDisplayName, "Divyacharandas Sadhu");
  assert.equal(exts.isExtraSeat, true);
  assert.equal(xs.isExtraSeat, true);
  assert.equal(middle.isExtraSeat, true);
});

test("dedupeGoogleSheetsPassengers collapses base and extra-seat alias rows", () => {
  const passengers = dedupeGoogleSheetsPassengers([
    { firstName: "Divyacharandas", lastName: "Sadhu" },
    { firstName: "EXTSDivyacharandas", lastName: "Sadhu" },
  ]);

  assert.equal(passengers.length, 1);
  assert.equal(passengers[0]?.primaryDisplayName, "Divyacharandas Sadhu");
});

test("buildGoogleSheetsTripIdentityKey groups same-flight rows even when locator differs", () => {
  const firstKey = buildGoogleSheetsTripIdentityKey({
    locatorNumber: "ABC123",
    airline: "Delta",
    flightNumber: "DL 123",
    departureAirport: "LAX",
    departureDate: "2026-05-01",
    departureTime: "08:30",
    arrivalAirport: "JFK",
    arrivalDate: "2026-05-01",
    arrivalTime: "16:45",
  });
  const secondKey = buildGoogleSheetsTripIdentityKey({
    locatorNumber: "XYZ789",
    airline: "Delta",
    flightNumber: "DL 123",
    departureAirport: "LAX",
    departureDate: "2026-05-01",
    departureTime: "08:30",
    arrivalAirport: "JFK",
    arrivalDate: "2026-05-01",
    arrivalTime: "16:45",
  });
  const differentFlightKey = buildGoogleSheetsTripIdentityKey({
    locatorNumber: "XYZ789",
    airline: "Delta",
    flightNumber: "DL 124",
    departureAirport: "LAX",
    departureDate: "2026-05-01",
    departureTime: "08:30",
    arrivalAirport: "JFK",
    arrivalDate: "2026-05-01",
    arrivalTime: "16:45",
  });

  assert.equal(firstKey, secondKey);
  assert.notEqual(firstKey, differentFlightKey);
});

test("classifyTelegramLinkInput distinguishes staff email from phone input", () => {
  assert.deepEqual(classifyTelegramLinkInput("admin@westsanto.org"), {
    kind: "email",
    email: "admin@westsanto.org",
  });
  assert.deepEqual(classifyTelegramLinkInput("+1 (555) 123-4567"), {
    kind: "phone",
    phone: "15551234567",
    normalizedInput: "+1 (555) 123-4567",
  });
});
