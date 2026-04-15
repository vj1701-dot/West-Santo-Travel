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
        title="Approvals"
        tooltip="Review and approve coordinator edits with change comparison and approval workflow"
      />
      <ApprovalReviewList approvals={approvals} canReview={currentUser.role === "ADMIN"} />
    </AppShell>
  );
}
