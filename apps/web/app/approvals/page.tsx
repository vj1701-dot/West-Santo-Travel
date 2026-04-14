import { ApprovalReviewList } from "@/components/approval-review-list";
import { AppShell } from "@/components/app-shell";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/session";
import { dataAdapter } from "@/lib/data/adapter";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const currentUser = await requireUser();
  const approvals = await dataAdapter.listApprovals();

  return (
    <AppShell currentUser={currentUser}>
      <PageHeader
        eyebrow="Approvals"
        title="Coordinator edits that wait for admin review"
        description="Use this queue to inspect proposed changes, compare snapshots, and resolve pending work explicitly."
      />
      <ApprovalReviewList approvals={approvals} canReview={currentUser.role === "ADMIN"} />
    </AppShell>
  );
}
