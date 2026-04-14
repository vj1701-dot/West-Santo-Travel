export type SegmentTransportInput = {
  id: string;
  departureAirportMonitored: boolean;
  arrivalAirportMonitored: boolean;
  departureAirportId: string;
  arrivalAirportId: string;
  defaultMandirId?: string | null;
  departureTimeLocal: string;
  arrivalTimeLocal: string;
};

export type GeneratedTransportTask = {
  segmentId: string;
  taskType: "PICKUP" | "DROPOFF";
  airportId: string;
  mandirId: string | null;
  scheduledTimeLocal: string;
};

export function generateTransportTasks(segments: SegmentTransportInput[]): GeneratedTransportTask[] {
  return segments.flatMap((segment) => {
    const tasks: GeneratedTransportTask[] = [];

    if (segment.arrivalAirportMonitored) {
      tasks.push({
        segmentId: segment.id,
        taskType: "PICKUP",
        airportId: segment.arrivalAirportId,
        mandirId: segment.defaultMandirId ?? null,
        scheduledTimeLocal: segment.arrivalTimeLocal,
      });
    }

    if (segment.departureAirportMonitored) {
      tasks.push({
        segmentId: segment.id,
        taskType: "DROPOFF",
        airportId: segment.departureAirportId,
        mandirId: segment.defaultMandirId ?? null,
        scheduledTimeLocal: segment.departureTimeLocal,
      });
    }

    return tasks;
  });
}
