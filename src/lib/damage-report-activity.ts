export interface DamageReportActivitySource {
  status: string;
  created_at: string;
  updated_at: string;
}

// updated_at is the last report update, not a historical status-change timestamp.
export function getDamageReportActivity(report: DamageReportActivitySource) {
  const status = report.status === "pending" || report.status === "reviewed" || report.status === "closed"
    ? report.status
    : "unknown";

  return {
    status,
    date: report.updated_at || report.created_at,
  };
}