import { listPublicSubmissions } from "@west-santo/data";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PublicSubmissionReviewList } from "@/components/public-submission-review-list";
import { requireRole } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const currentUser = await requireRole("ADMIN");
  const submissions = await listPublicSubmissions();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        title="Public Submissions"
        tooltip="Review guest-submitted flight details and convert approved submissions into itineraries"
      />
      <PublicSubmissionReviewList submissions={submissions} />
    </AppShell>
  );
}
