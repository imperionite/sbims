import { createSeedAdminClient, normalizeEmail, seedError } from "./_shared/seed-utils.ts";
import { AUDIT_ACTIONS, type AuditAction } from "../../src/modules/audit/audit.types.ts";

const supabaseAdmin = createSeedAdminClient();

type ProfileRow = {
  id: string;
  email: string;
  role: string;
};

type SeedAuditRow = {
  seedKey: string;
  actorEmail: string;
  action: AuditAction;
  resourceType: string;
  resourceIdResolver?:
    | "actor"
    | "internship"
    | "document"
    | "evaluation"
    | "static";
  staticResourceId?: string;
  details: Record<string, unknown>;
  ipAddress: string;
  daysAgo: number;
};

// Stable references from previous seeds
const ACTOR_EMAILS = [
  "adminsbims1@grr.la",
  "coordinatorsbims1@grr.la",
  "facultysbims1@grr.la",
  "htesbims1@grr.la",
  "studentsbims1@grr.la",
] as const;

/**
 * Historical seed events representing the full lifecycle across modules.
 */
const seedAuditEvents: readonly SeedAuditRow[] = [
  // -------------------------------------------------------------------------
  // 1. Authentication & Security
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-01",
    actorEmail: "adminsbims1@grr.la",
    action: "LOGIN",
    resourceType: "AUTH",
    resourceIdResolver: "actor",
    details: {
      method: "password",
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
    ipAddress: "192.168.1.100",
    daysAgo: 30,
  },
  {
    seedKey: "audit-02",
    actorEmail: "studentsbims1@grr.la",
    action: "PASSWORD_CHANGE",
    resourceType: "AUTH",
    resourceIdResolver: "actor",
    details: { firstLogin: true },
    ipAddress: "112.201.144.12",
    daysAgo: 28,
  },

  // -------------------------------------------------------------------------
  // 2. User & Role Governance
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-03",
    actorEmail: "adminsbims1@grr.la",
    action: "CREATE_USER",
    resourceType: "USER",
    details: {
      createdUserEmail: "studentsbims1@grr.la",
      assignedRole: "student",
    },
    ipAddress: "192.168.1.100",
    daysAgo: 29,
  },
  {
    seedKey: "audit-04",
    actorEmail: "adminsbims1@grr.la",
    action: "UPDATE_USER",
    resourceType: "USER",
    details: { fieldsUpdated: ["first_name", "last_name"] },
    ipAddress: "192.168.1.100",
    daysAgo: 25,
  },
  {
    seedKey: "audit-05",
    actorEmail: "adminsbims1@grr.la",
    action: "CHANGE_ROLE",
    resourceType: "USER",
    details: {
      previousRole: "faculty_adviser",
      newRole: "internship_coordinator",
    },
    ipAddress: "192.168.1.100",
    daysAgo: 20,
  },

  // -------------------------------------------------------------------------
  // 3. Internship Lifecycle
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-06",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "CREATE_INTERNSHIP",
    resourceType: "INTERNSHIP",
    resourceIdResolver: "internship",
    details: { requiredHours: 150, program: "BSCS" },
    ipAddress: "192.168.1.105",
    daysAgo: 27,
  },
  {
    seedKey: "audit-07",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "ASSIGN_FACULTY_ADVISER",
    resourceType: "INTERNSHIP",
    resourceIdResolver: "internship",
    details: { assignedAdviserEmail: "facultysbims1@grr.la" },
    ipAddress: "192.168.1.105",
    daysAgo: 26,
  },
  {
    seedKey: "audit-08",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "CHANGE_INTERNSHIP_STATUS",
    resourceType: "INTERNSHIP",
    resourceIdResolver: "internship",
    details: { fromStatus: "pending", toStatus: "active" },
    ipAddress: "192.168.1.105",
    daysAgo: 25,
  },

  // -------------------------------------------------------------------------
  // 4. Attendance Tracking & Verification
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-09",
    actorEmail: "studentsbims1@grr.la",
    action: "CREATE_ATTENDANCE",
    resourceType: "ATTENDANCE",
    details: { date: "2026-08-17", timeIn: "08:00:00", timeOut: "17:00:00" },
    ipAddress: "112.201.144.12",
    daysAgo: 24,
  },
  {
    seedKey: "audit-10",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "VALIDATE_ATTENDANCE",
    resourceType: "ATTENDANCE",
    details: { renderedHours: 8, validationStatus: "validated" },
    ipAddress: "192.168.1.105",
    daysAgo: 23,
  },
  {
    seedKey: "audit-11",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "REJECT_ATTENDANCE",
    resourceType: "ATTENDANCE",
    details: {
      reason: "Time-out entry does not align with company log sheet.",
    },
    ipAddress: "192.168.1.105",
    daysAgo: 10,
  },

  // -------------------------------------------------------------------------
  // 5. Document Management
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-12",
    actorEmail: "studentsbims1@grr.la",
    action: "UPLOAD_DOCUMENT",
    resourceType: "DOCUMENT",
    details: {
      documentType: "signed_internship_agreement",
      fileName: "signed-internship-agreement.pdf",
    },
    ipAddress: "112.201.144.12",
    daysAgo: 22,
  },
  {
    seedKey: "audit-13",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "APPROVE_DOCUMENT",
    resourceType: "DOCUMENT",
    details: {
      documentType: "signed_internship_agreement",
      status: "approved",
    },
    ipAddress: "192.168.1.105",
    daysAgo: 21,
  },
  {
    seedKey: "audit-14",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "REJECT_DOCUMENT",
    resourceType: "DOCUMENT",
    details: {
      documentType: "fit_to_work",
      reason: "Missing physician medical license number.",
    },
    ipAddress: "192.168.1.105",
    daysAgo: 15,
  },

  // -------------------------------------------------------------------------
  // 6. Evaluations
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-15",
    actorEmail: "htesbims1@grr.la",
    action: "CREATE_EVALUATION",
    resourceType: "EVALUATION",
    details: { evaluationType: "hte_supervisor", status: "draft" },
    ipAddress: "175.176.45.22",
    daysAgo: 5,
  },
  {
    seedKey: "audit-16",
    actorEmail: "htesbims1@grr.la",
    action: "SUBMIT_EVALUATION",
    resourceType: "EVALUATION",
    details: {
      evaluationType: "hte_supervisor",
      finalStatus: "submitted",
      criteriaEvaluated: 8,
    },
    ipAddress: "175.176.45.22",
    daysAgo: 2,
  },

  // -------------------------------------------------------------------------
  // 7. Institutional Reporting & Governance
  // -------------------------------------------------------------------------
  {
    seedKey: "audit-17",
    actorEmail: "coordinatorsbims1@grr.la",
    action: "GENERATE_REPORT",
    resourceType: "REPORT",
    details: {
      reportType: "internship_monitoring",
      format: "summary",
      filters: { program: "BSIT" },
    },
    ipAddress: "192.168.1.105",
    daysAgo: 1,
  },
];

async function resolveProfiles(): Promise<Map<string, ProfileRow>> {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .in("email", ACTOR_EMAILS);

  if (error) throw seedError("audit.resolve-profiles", error);

  const profileMap = new Map<string, ProfileRow>();
  for (const row of data ?? []) {
    profileMap.set(normalizeEmail(row.email), row as ProfileRow);
  }

  for (const email of ACTOR_EMAILS) {
    if (!profileMap.has(email)) {
      throw new Error(
        `Audit actor profile not found: ${email}. Ensure seed:users has run.`,
      );
    }
  }

  return profileMap;
}

async function resolveSampleInternshipId(studentId: string): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from("internships")
    .select("id")
    .eq("student_id", studentId)
    .limit(1)
    .maybeSingle();

  if (error) throw seedError("audit.resolve-internship", error);
  return data?.id ?? crypto.randomUUID();
}

function validateAuditActions(): void {
  const allowedSet = new Set(AUDIT_ACTIONS);
  for (const row of seedAuditEvents) {
    if (!allowedSet.has(row.action)) {
      throw new Error(
        `Invalid audit action in seed: "${row.action}". Must exist in AUDIT_ACTIONS.`,
      );
    }
  }
}

async function seed(): Promise<void> {
  validateAuditActions();

  console.log("========================================");
  console.log("SBIMS Development Audit Logging Seed");
  console.log("========================================");

  const profiles = await resolveProfiles();
  const studentProfile = profiles.get("studentsbims1@grr.la")!;
  const sampleInternshipId = await resolveSampleInternshipId(studentProfile.id);

  const rowsToInsert = [];

  for (const event of seedAuditEvents) {
    const actor = profiles.get(event.actorEmail);
    if (!actor) {
      throw new Error(`Unresolved actor for audit seed: ${event.actorEmail}`);
    }

    let resourceId: string | null = null;
    if (event.resourceIdResolver === "actor") {
      resourceId = actor.id;
    } else if (event.resourceIdResolver === "internship") {
      resourceId = sampleInternshipId;
    } else if (event.staticResourceId) {
      resourceId = event.staticResourceId;
    }

    // Generate a deterministic timestamp based on daysAgo
    const timestamp = new Date(
      Date.now() - event.daysAgo * 86400 * 1000,
    ).toISOString();

    rowsToInsert.push({
      user_id: actor.id,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: resourceId,
      details: {
        ...event.details,
        seedKey: event.seedKey,
      },
      ip_address: event.ipAddress,
      created_at: timestamp,
    });
  }

  // Idempotency: Insert entries that don't already exist by checking seedKey in json details
  let insertedCount = 0;
  let skippedCount = 0;

  for (const row of rowsToInsert) {
    const seedKey = (row.details as Record<string, unknown>).seedKey;

    const { data: existing, error: checkError } = await supabaseAdmin
      .from("audit_logs")
      .select("id")
      .eq("user_id", row.user_id)
      .eq("action", row.action)
      .contains("details", { seedKey })
      .maybeSingle();

    if (checkError) throw seedError("audit.check-existing", checkError);

    if (existing) {
      skippedCount++;
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("audit_logs")
        .insert(row);

      if (insertError) throw seedError(`audit.insert:${seedKey}`, insertError);
      insertedCount++;
    }
  }

  console.log(`Audited Events Defined : ${seedAuditEvents.length}`);
  console.log(`Newly Inserted Logs   : ${insertedCount}`);
  console.log(`Existing Logs Preserved: ${skippedCount}`);
  console.log("========================================");
  console.log("Audit log seeding completed successfully.");
}

if (import.meta.main) {
  await seed();
}
