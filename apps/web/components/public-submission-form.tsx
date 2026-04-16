import type { AirportChoice } from "./airport-autocomplete";
import { SubmissionTripBuilder } from "./submission-trip-builder";

export function PublicSubmissionForm({ airports }: { airports: AirportChoice[] }) {
  return (
    <SubmissionTripBuilder
      mode="public"
      airports={airports}
      submitLabel="Submit for review"
      submitUrl="/api/public-submissions"
    />
  );
}
