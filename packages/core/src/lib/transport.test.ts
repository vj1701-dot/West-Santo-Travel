import test from "node:test";
import assert from "node:assert/strict";

import { generateTransportTasks } from "./transport";

test("generateTransportTasks creates pickup and dropoff only for monitored airports", () => {
  const tasks = generateTransportTasks([
    {
      id: "segment-1",
      departureAirportMonitored: false,
      arrivalAirportMonitored: true,
      departureAirportId: "ord",
      arrivalAirportId: "lax",
      defaultMandirId: "la-mandir",
      departureTimeLocal: "2026-05-12T12:00:00",
      arrivalTimeLocal: "2026-05-12T14:30:00",
    },
    {
      id: "segment-2",
      departureAirportMonitored: true,
      arrivalAirportMonitored: false,
      departureAirportId: "lax",
      arrivalAirportId: "sfo",
      defaultMandirId: "la-mandir",
      departureTimeLocal: "2026-05-13T08:00:00",
      arrivalTimeLocal: "2026-05-13T09:30:00",
    },
  ]);

  assert.deepEqual(tasks, [
    {
      segmentId: "segment-1",
      taskType: "PICKUP",
      airportId: "lax",
      mandirId: "la-mandir",
      scheduledTimeLocal: "2026-05-12T14:30:00",
    },
    {
      segmentId: "segment-2",
      taskType: "DROPOFF",
      airportId: "lax",
      mandirId: "la-mandir",
      scheduledTimeLocal: "2026-05-13T08:00:00",
    },
  ]);
});
