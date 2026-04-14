export type DashboardMetricsInput = {
  todayArrivals: number;
  pendingApprovals: number;
  unassignedTasks: number;
  activeDrivers: number;
};

export function summarizeDashboard(input: DashboardMetricsInput) {
  return [
    { label: "Today's Arrivals", value: input.todayArrivals },
    { label: "Pending Approvals", value: input.pendingApprovals },
    { label: "Unassigned Tasks", value: input.unassignedTasks },
    { label: "Active Drivers", value: input.activeDrivers },
  ];
}
