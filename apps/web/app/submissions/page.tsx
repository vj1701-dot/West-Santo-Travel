import { listPublicSubmissions } from "@west-santo/data";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { PublicSubmissionReviewList } from "@/components/public-submission-review-list";
import { requireUser } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function SubmissionsPage() {
  const currentUser = await requireUser();
  if (!["ADMIN", "COORDINATOR"].includes(currentUser.role)) {
    redirect("/access-denied");
  }
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
