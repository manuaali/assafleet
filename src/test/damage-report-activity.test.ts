import { describe, expect, it } from "vitest";
import { getDamageReportActivity } from "@/lib/damage-report-activity";

describe("damage report activity", () => {
  const report = {
    status: "pending",
    created_at: "2026-11-01T08:00:00Z",
    updated_at: "2026-11-11T10:19:00Z",
  };

  it("keeps the saved status for tracking processing progress", () => {
    for (const status of ["pending", "reviewed", "closed"]) {
      expect(getDamageReportActivity({ ...report, status }).status).toBe(status);
    }
    expect(getDamageReportActivity({ ...report, status: "invalid" }).status).toBe("unknown");
  });

  it("uses the report update timestamp for its position in vehicle history", () => {
    expect(getDamageReportActivity(report).date).toBe("2026-11-11T10:19:00Z");
  });

  it("uses the creation timestamp when an update timestamp is unavailable", () => {
    expect(getDamageReportActivity({ ...report, updated_at: "" }).date).toBe("2026-11-01T08:00:00Z");
  });
});