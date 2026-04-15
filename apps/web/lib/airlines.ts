export type AirlineBrand = {
  match: string[];
  name: string;
  code: string;
  accentClassName: string;
};

export const AIRLINE_OPTIONS = [
  "Air Canada",
  "Air India",
  "Air New Zealand",
  "Alaska Airlines",
  "American Airlines",
  "Delta Air Lines",
  "Emirates",
  "Etihad Airways",
  "Fiji Airways",
  "Hawaiian Airlines",
  "JetBlue",
  "Lufthansa",
  "Qantas",
  "Qatar Airways",
  "Singapore Airlines",
  "Southwest Airlines",
  "United Airlines",
  "Virgin Atlantic",
  "Virgin Australia",
];

const AIRLINE_BRANDS: AirlineBrand[] = [
  { match: ["air canada"], name: "Air Canada", code: "AC", accentClassName: "bg-rose-100 text-rose-700" },
  { match: ["air india"], name: "Air India", code: "AI", accentClassName: "bg-orange-100 text-orange-700" },
  { match: ["air new zealand"], name: "Air New Zealand", code: "NZ", accentClassName: "bg-slate-200 text-slate-800" },
  { match: ["alaska airlines", "alaska"], name: "Alaska Airlines", code: "AS", accentClassName: "bg-emerald-100 text-emerald-700" },
  { match: ["american airlines", "american"], name: "American Airlines", code: "AA", accentClassName: "bg-sky-100 text-sky-700" },
  { match: ["delta air lines", "delta"], name: "Delta Air Lines", code: "DL", accentClassName: "bg-indigo-100 text-indigo-700" },
  { match: ["emirates"], name: "Emirates", code: "EK", accentClassName: "bg-red-100 text-red-700" },
  { match: ["etihad airways", "etihad"], name: "Etihad Airways", code: "EY", accentClassName: "bg-amber-100 text-amber-700" },
  { match: ["fiji airways", "fiji"], name: "Fiji Airways", code: "FJ", accentClassName: "bg-cyan-100 text-cyan-700" },
  { match: ["hawaiian airlines", "hawaiian"], name: "Hawaiian Airlines", code: "HA", accentClassName: "bg-fuchsia-100 text-fuchsia-700" },
  { match: ["jetblue"], name: "JetBlue", code: "B6", accentClassName: "bg-blue-100 text-blue-700" },
  { match: ["lufthansa"], name: "Lufthansa", code: "LH", accentClassName: "bg-yellow-100 text-yellow-700" },
  { match: ["qantas"], name: "Qantas", code: "QF", accentClassName: "bg-red-100 text-red-700" },
  { match: ["qatar airways", "qatar"], name: "Qatar Airways", code: "QR", accentClassName: "bg-rose-100 text-rose-700" },
  { match: ["singapore airlines", "singapore"], name: "Singapore Airlines", code: "SQ", accentClassName: "bg-amber-100 text-amber-800" },
  { match: ["southwest airlines", "southwest"], name: "Southwest Airlines", code: "WN", accentClassName: "bg-blue-100 text-blue-700" },
  { match: ["united airlines", "united"], name: "United Airlines", code: "UA", accentClassName: "bg-sky-100 text-sky-700" },
  { match: ["virgin atlantic"], name: "Virgin Atlantic", code: "VS", accentClassName: "bg-pink-100 text-pink-700" },
  { match: ["virgin australia"], name: "Virgin Australia", code: "VA", accentClassName: "bg-pink-100 text-pink-700" },
];

function normalizeAirlineName(value: string) {
  return value.trim().toLowerCase();
}

export function getAirlineBrand(airline: string) {
  const normalized = normalizeAirlineName(airline);
  const match = AIRLINE_BRANDS.find((brand) => brand.match.includes(normalized));

  if (match) {
    return match;
  }

  const initials = airline
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "FL";

  return {
    name: airline || "Flight",
    code: initials,
    accentClassName: "bg-slate-100 text-slate-700",
  };
}
