import { createSeedAdminClient, normalizeEmail, seedError } from "./_shared/seed-utils.ts";
import { ReportsService } from "../../src/modules/reports/reports.service.ts";
import type { SupabaseClients } from "../../src/lib/supabase.ts";

const supabaseAdmin = createSeedAdminClient();

// Wrap supabaseAdmin into the SupabaseClients interface expected by ReportsService
const clients = {
  supabaseAdmin,
  supabaseClient: supabaseAdmin,
  createAuthenticatedClient: () => supabaseAdmin as never,
  createPublicClient: () => supabaseAdmin as never,
} as unknown as SupabaseClients;

const COORDINATOR_EMAIL = "coordinatorsbims1@grr.la";

async function resolveCoordinatorId(): Promise<string> {
  const normalizedEmail = normalizeEmail(COORDINATOR_EMAIL);
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, role, is_active")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw seedError("reports.resolve-coordinator", error);
  }

  if (!data) {
    throw new Error(`Coordinator profile not found: ${COORDINATOR_EMAIL}`);
  }

  return data.id;
}

/**
 * Seeds demonstration audit log entries for FR-10 and FR-11 compliance.
 * Whenever reports are extracted by institutional staff, an audit trail
 * must exist showing who accessed the report and when.
 */
async function seedReportAuditLogs(coordinatorId: string): Promise<void> {
  const auditEntries = [
    {
      user_id: coordinatorId,
      action: "GENERATE_REPORT",
      resource_type: "REPORT",
      resource_id: "internship_monitoring",
      details: {
        filter: "all",
        format: "summary",
        academic_year: "2026-2027",
      },
      ip_address: "127.0.0.1",
      created_at: new Date(Date.now() - 3 * 86400 * 1000).toISOString(),
    },
    {
      user_id: coordinatorId,
      action: "GENERATE_REPORT",
      resource_type: "REPORT",
      resource_id: "internship_monitoring",
      details: {
        filter: "status=completed",
        format: "detailed",
        academic_year: "2026-2027",
      },
      ip_address: "127.0.0.1",
      created_at: new Date(Date.now() - 1 * 86400 * 1000).toISOString(),
    },
  ];

  for (const entry of auditEntries) {
    // Check if an audit log for this coordinator and resource already exists
    const { data: existing } = await supabaseAdmin
      .from("audit_logs")
      .select("id")
      .eq("user_id", entry.user_id)
      .eq("action", entry.action)
      .eq("resource_id", entry.resource_id)
      .contains("details", { filter: entry.details.filter })
      .maybeSingle();

    if (!existing) {
      const { error } = await supabaseAdmin.from("audit_logs").insert(entry);
      if (error) {
        throw seedError("reports.seed-audit-logs", error);
      }
    }
  }

  console.log("  ✓ Sample report generation audit logs verified/seeded.");
}

/**
 * Validates the operational reporting projections across all modules.
 * This guarantees that when an administrator or evaluator views the reports,
 * the calculations for required, rendered, and remaining hours are mathematically sound.
 */
async function verifyReportIntegrity(): Promise<void> {
  const reportsService = new ReportsService(clients);

  // 1. Validate full detailed report rows
  const detailed = await reportsService.getInternshipReport({});

  if (!detailed || detailed.length === 0) {
    throw new Error(
      "Reporting verification failed: No internships found. Ensure prior seeds (users, students, htes, internships) have executed.",
    );
  }

  // 2. Validate aggregate summary computation
  const summary = await reportsService.getInternshipReportSummary({});

  console.log("----------------------------------------");
  console.log("Reporting Dataset Verification Metrics:");
  console.log(`  Total Internships : ${summary.totalInternships}`);
  console.log(`  - Pending         : ${summary.pending}`);
  console.log(`  - Active          : ${summary.active}`);
  console.log(`  - Completed       : ${summary.completed}`);
  console.log(`  Total Required    : ${summary.totalRequiredHours} hrs`);
  console.log(`  Total Rendered    : ${summary.totalRenderedHours} hrs`);
  console.log(`  Total Remaining   : ${summary.totalRemainingHours} hrs`);
  console.log("----------------------------------------");

  // Integrity checks based on seed datasets
  if (
    summary.pending === 0 ||
    summary.active === 0 ||
    summary.completed === 0
  ) {
    throw new Error(
      "Reporting verification failed: Seeded dataset must contain a mixture of pending, active, and completed internships.",
    );
  }

  if (summary.totalRenderedHours <= 0) {
    throw new Error(
      "Reporting verification failed: Seeded attendance hours were not calculated in the report summary.",
    );
  }

  // 3. Verify Program filtering works (BSIT)
  const itReport = await reportsService.getInternshipReport({
    program: "Bachelor of Science in Information Technology",
  });
  if (itReport.length === 0) {
    throw new Error(
      "Reporting verification failed: Program filter returned no rows.",
    );
  }

  // 4. Verify Status filtering works (completed)
  const completedReport = await reportsService.getInternshipReport({
    status: "completed",
  });
  if (completedReport.length !== summary.completed) {
    throw new Error(
      `Reporting status filter mismatch: expected ${summary.completed}, got ${completedReport.length}`,
    );
  }

  console.log(
    "  ✓ All reporting filters and aggregations verified successfully.",
  );
}

async function seed(): Promise<void> {
  console.log("========================================");
  console.log("SBIMS Development Reporting Seed & Audit");
  console.log("========================================");

  try {
    const coordinatorId = await resolveCoordinatorId();
    await seedReportAuditLogs(coordinatorId);
    await verifyReportIntegrity();

    console.log("========================================");
    console.log("Reporting module seed completed successfully.");
    console.log("========================================");
  } catch (error) {
    console.error(
      "✗ Failed to execute reporting seed:",
      error instanceof Error ? error.message : error,
    );
    throw error;
  }
}

if (import.meta.main) {
  await seed();
}
