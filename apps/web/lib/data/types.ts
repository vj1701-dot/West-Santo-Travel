export type Metric = {
  label: string;
  value: string;
  detail: string;
};

export type OverviewItinerary = {
  id: string;
  route: string;
  flightLabel: string;
  departureDate: string;
  status: string;
  statusTone: "neutral" | "warning" | "success";
  passengerSummary: string;
  transportSummary: string;
  mandir: string;
};

export type QueueItem = {
  label: string;
  value: string;
  detail: string;
};

export type OverviewData = {
  metrics: Metric[];
  upcomingItineraries: OverviewItinerary[];
  queue: QueueItem[];
};

export type ItineraryDetail = {
  id: string;
  status: string;
  notes: string | null;
};

export type Segment = {
  id: string;
  airline: string;
  flightNumber: string;
  route: string;
  departureTime: string;
  arrivalTime: string;
  notes: string;
};

export type Itinerary = {
  id: string;
  code: string;
  route: string;
  flightLabel: string;
  passengerCount: number;
  transportSummary: string;
  approvalState: string;
  status: string;
  statusTone: "neutral" | "warning" | "success";
  segments: Segment[];
};

export type TransportTask = {
  id: string;
  type: "PICKUP" | "DROPOFF";
  airport: string;
  mandir: string;
  scheduledTime: string;
  drivers: string[];
  status: string;
  statusTone: "neutral" | "warning" | "success";
  notes: string;
};

export type Approval = {
  id: string;
  title: string;
  subject: string;
  requestedBy: string;
  requestedAt: string;
  impact: string;
  status: string;
  statusTone: "neutral" | "warning" | "success";
  deltas: string[];
};

export type Passenger = {
  id: string;
  name: string;
  legalName: string;
  contact: string;
  telegram: string;
  passengerType: string;
  itineraryCount: number;
  notes: string;
};
