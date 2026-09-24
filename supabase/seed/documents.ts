import { createSeedAdminClient, normalizeEmail, seedError } from "./_shared/seed-utils.ts";

const supabaseAdmin = createSeedAdminClient();

const STORAGE_BUCKET = "internship-documents";

const ASSET_DIRECTORY = Deno.env.get("DOCUMENT_SEED_ASSET_DIR") ?? "./supabase/seed/data/assets";

const STORAGE_UPLOAD_MAX_ATTEMPTS = 4;

const STORAGE_UPLOAD_RETRY_DELAYS_MS = [1_000, 2_000, 4_000] as const;

type DocumentType = "signed_internship_agreement" | "fit_to_work" | "consent";

type DocumentStatus = "pending" | "approved" | "rejected";

type SeedDocument = {
  seedKey: string;
  studentEmail: string;
  documentType: DocumentType;
  status: DocumentStatus;
  fileName: string;
  assetFile: string;
  rejectionReason?: string;
};

type StudentRow = {
  id: string;
  email: string;
};

type InternshipRow = {
  id: string;
  student_id: string;
  status: "pending" | "active" | "completed";
};

type CoordinatorRow = {
  id: string;
  email: string;
  role: "internship_coordinator";
};

const COORDINATOR_EMAIL = "coordinatorsbims1@grr.la";

const REQUIRED_DOCUMENT_TYPES: readonly DocumentType[] = [
  "signed_internship_agreement",
  "fit_to_work",
  "consent",
];

/**
 * Development/demo document dataset.
 *
 * The sample PDFs are fictional documents created only for:
 * - local development
 * - integration testing
 * - UI demonstration
 * - database/storage seeding
 *
 * They are NOT real school, medical, legal, or employment documents.
 *
 * Dataset design:
 * - 11 interns have all three required documents.
 * - 3 interns have partial submissions, including pending/rejected records.
 * - 2 interns have no document submissions.
 *
 * This gives the UI/API realistic combinations of:
 * - approved/reviewed documents
 * - pending/unreviewed documents
 * - rejected/reviewed documents
 * - internships with no submissions
 */
const seedDocuments: readonly SeedDocument[] = [
  // -------------------------------------------------
  // Fully compliant interns
  // -------------------------------------------------

  {
    seedKey: "document-01",
    studentEmail: "studentsbims1@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-02",
    studentEmail: "studentsbims1@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-03",
    studentEmail: "studentsbims1@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-04",
    studentEmail: "studentsbims3@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-05",
    studentEmail: "studentsbims3@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-06",
    studentEmail: "studentsbims3@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-07",
    studentEmail: "studentsbims4@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-08",
    studentEmail: "studentsbims4@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-09",
    studentEmail: "studentsbims4@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-10",
    studentEmail: "studentsbims6@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-11",
    studentEmail: "studentsbims6@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-12",
    studentEmail: "studentsbims6@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-13",
    studentEmail: "studentsbims7@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-14",
    studentEmail: "studentsbims7@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-15",
    studentEmail: "studentsbims7@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-16",
    studentEmail: "studentsbims8@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-17",
    studentEmail: "studentsbims8@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-18",
    studentEmail: "studentsbims8@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-19",
    studentEmail: "studentsbims9@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-20",
    studentEmail: "studentsbims9@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-21",
    studentEmail: "studentsbims9@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-22",
    studentEmail: "studentsbims10@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-23",
    studentEmail: "studentsbims10@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-24",
    studentEmail: "studentsbims10@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-25",
    studentEmail: "studentsbims11@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-26",
    studentEmail: "studentsbims11@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-27",
    studentEmail: "studentsbims11@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-28",
    studentEmail: "studentsbims12@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-29",
    studentEmail: "studentsbims12@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-30",
    studentEmail: "studentsbims12@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-31",
    studentEmail: "studentsbims5@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-32",
    studentEmail: "studentsbims5@grr.la",
    documentType: "fit_to_work",
    status: "approved",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-33",
    studentEmail: "studentsbims5@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  // -------------------------------------------------
  // Partial / pending / rejected submissions
  // -------------------------------------------------

  {
    seedKey: "document-34",
    studentEmail: "studentsbims13@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-35",
    studentEmail: "studentsbims13@grr.la",
    documentType: "fit_to_work",
    status: "pending",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },

  {
    seedKey: "document-36",
    studentEmail: "studentsbims13@grr.la",
    documentType: "consent",
    status: "pending",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-37",
    studentEmail: "studentsbims14@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-38",
    studentEmail: "studentsbims14@grr.la",
    documentType: "fit_to_work",
    status: "rejected",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
    rejectionReason:
      "Sample rejection: fit-to-work document is incomplete and requires resubmission.",
  },

  {
    seedKey: "document-39",
    studentEmail: "studentsbims14@grr.la",
    documentType: "consent",
    status: "approved",
    fileName: "internship-consent.pdf",
    assetFile: "consent.pdf",
  },

  {
    seedKey: "document-40",
    studentEmail: "studentsbims15@grr.la",
    documentType: "signed_internship_agreement",
    status: "approved",
    fileName: "signed-internship-agreement.pdf",
    assetFile: "signed_internship_agreement.pdf",
  },

  {
    seedKey: "document-41",
    studentEmail: "studentsbims15@grr.la",
    documentType: "fit_to_work",
    status: "pending",
    fileName: "fit-to-work.pdf",
    assetFile: "fit_to_work.pdf",
  },
  // -------------------------------------------------
  // studentsbims16 and studentsbims2 intentionally
  // have no seeded documents.
  // -------------------------------------------------
];

function validateSeedDocuments(): void {
  const seenKeys = new Set<string>();
  const seenCombinations = new Set<string>();

  for (const seed of seedDocuments) {
    if (seenKeys.has(seed.seedKey)) {
      throw new Error(`Duplicate document seed key: ${seed.seedKey}`);
    }

    const combination = `${normalizeEmail(seed.studentEmail)}:${seed.documentType}`;

    if (seenCombinations.has(combination)) {
      throw new Error(`Duplicate document type for student: ${combination}`);
    }

    if (seed.status === "rejected" && !seed.rejectionReason?.trim()) {
      throw new Error(
        `Rejected document ${seed.seedKey} requires a rejection reason.`,
      );
    }

    if (seed.status !== "rejected" && seed.rejectionReason !== undefined) {
      throw new Error(
        `Only rejected document ${seed.seedKey} may have a rejection reason.`,
      );
    }

    seenKeys.add(seed.seedKey);
    seenCombinations.add(combination);
  }
}

async function resolveCoordinator(): Promise<CoordinatorRow> {
  const normalizedEmail = normalizeEmail(COORDINATOR_EMAIL);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role")
    .eq("email", normalizedEmail)
    .eq("role", "internship_coordinator")
    .maybeSingle();

  if (error) {
    throw seedError("documents.resolve-coordinator", error);
  }

  if (!data) {
    throw new Error(
      `Internship coordinator profile not found: ${COORDINATOR_EMAIL}`,
    );
  }

  return data as CoordinatorRow;
}

async function resolveInternships(): Promise<Map<string, InternshipRow>> {
  const studentEmails = [
    ...new Set(
      seedDocuments.map((document) => normalizeEmail(document.studentEmail)),
    ),
  ];

  const { data: studentRows, error: studentError } = await supabaseAdmin
    .from("student_profiles")
    .select("id, profiles!inner(email)")
    .in("profiles.email", studentEmails);

  if (studentError) {
    throw seedError("documents.resolve-students", studentError);
  }

  const students = new Map<string, StudentRow>();

  for (const row of studentRows ?? []) {
    const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;

    if (profile?.email) {
      const email = normalizeEmail(profile.email);

      students.set(email, {
        id: row.id,
        email,
      });
    }
  }

  for (const email of studentEmails) {
    if (!students.has(email)) {
      throw new Error(`Student profile not found: ${email}`);
    }
  }

  const { data: internshipRows, error: internshipError } = await supabaseAdmin
    .from("internships")
    .select("id, student_id, status")
    .in(
      "student_id",
      [...students.values()].map((student) => student.id),
    );

  if (internshipError) {
    throw seedError("documents.resolve-internships", internshipError);
  }

  const internships = new Map<string, InternshipRow>();

  for (const email of studentEmails) {
    const student = students.get(email)!;

    const internship = (internshipRows ?? []).find(
      (row) => row.student_id === student.id,
    ) as InternshipRow | undefined;

    if (!internship) {
      throw new Error(`Internship not found for document student: ${email}`);
    }

    internships.set(email, internship);
  }

  return internships;
}

async function loadAsset(
  assetFile: string,
): Promise<{ file: File; bytes: Uint8Array }> {
  const assetPath = `${ASSET_DIRECTORY}/${assetFile}`;

  let bytes: Uint8Array;

  try {
    bytes = await Deno.readFile(assetPath);
  } catch (error) {
    throw new Error(
      `Unable to read document seed asset "${assetPath}". ` +
        `Provide the sample PDF files in that directory. ` +
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (bytes.length === 0) {
    throw new Error(`Document seed asset is empty: ${assetPath}`);
  }

  const fileBytes = new Uint8Array(bytes.length);
  fileBytes.set(bytes);

  const file = new File([fileBytes.buffer], assetFile, {
    type: "application/pdf",
  });

  return {
    file,
    bytes,
  };
}

/**
 * Determines whether a Supabase Storage error is likely transient.
 *
 * Storage gateway/network failures can occasionally happen even though
 * the request itself is valid. Those failures are safe to retry because
 * the upload uses a deterministic path with upsert enabled.
 */
function isTransientStorageError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);

  const normalizedMessage = message.toLowerCase();

  const transientPatterns = [
    "gateway timeout",
    "bad gateway",
    "service unavailable",
    "timeout",
    "timed out",
    "network error",
    "fetch failed",
    "connection reset",
    "connection refused",
    "temporarily unavailable",
    "503",
    "502",
    "504",
  ];

  return transientPatterns.some((pattern) => normalizedMessage.includes(pattern));
}

function getRetryDelayMs(attempt: number): number {
  return (
    STORAGE_UPLOAD_RETRY_DELAYS_MS[attempt - 1] ??
      STORAGE_UPLOAD_RETRY_DELAYS_MS[STORAGE_UPLOAD_RETRY_DELAYS_MS.length - 1]
  );
}

/**
 * Uploads one document to Supabase Storage with bounded retries.
 *
 * The operation is idempotent because the caller always uses:
 * - a deterministic storage path
 * - upsert: true
 */
async function uploadDocumentWithRetry(
  storagePath: string,
  file: File,
  seedKey: string,
): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= STORAGE_UPLOAD_MAX_ATTEMPTS; attempt++) {
    const { error: storageError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, file, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!storageError) {
      if (attempt > 1) {
        console.log(
          `  ↻ Storage upload succeeded on attempt ${attempt}: ${seedKey}`,
        );
      }

      return;
    }

    lastError = storageError;

    const canRetry = attempt < STORAGE_UPLOAD_MAX_ATTEMPTS &&
      isTransientStorageError(storageError);

    if (!canRetry) {
      throw seedError(`documents.storage:${seedKey}`, storageError);
    }

    const delayMs = getRetryDelayMs(attempt);

    console.warn(
      `  ! Transient Storage error for ${seedKey} ` +
        `(attempt ${attempt}/${STORAGE_UPLOAD_MAX_ATTEMPTS}): ` +
        `${storageError.message}. Retrying in ${delayMs}ms...`,
    );

    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  throw new Error(
    `Storage upload failed after ${STORAGE_UPLOAD_MAX_ATTEMPTS} attempts ` +
      `for ${seedKey}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  );
}

async function findExistingDocument(
  internshipId: string,
  documentType: DocumentType,
): Promise<
  {
    id: string;
    storage_path: string;
  } | null
> {
  const { data, error } = await supabaseAdmin
    .from("documents")
    .select("id, storage_path")
    .eq("internship_id", internshipId)
    .eq("document_type", documentType)
    .maybeSingle();

  if (error) {
    throw seedError("documents.find-existing", error);
  }

  return data as {
    id: string;
    storage_path: string;
  } | null;
}

async function seedDocument(
  seed: SeedDocument,
  internship: InternshipRow,
  coordinator: CoordinatorRow,
): Promise<void> {
  const { file } = await loadAsset(seed.assetFile);

  const existing = await findExistingDocument(internship.id, seed.documentType);

  const documentId = existing?.id ?? crypto.randomUUID();

  /**
   * Stable seed storage path.
   *
   * Using a deterministic path makes this seed safely rerunnable.
   * The production API uses its own document-id-based path generation;
   * this seed path is only for development data.
   */
  const storagePath = `${internship.id}/seed-${seed.documentType}.pdf`;

  await uploadDocumentWithRetry(storagePath, file, seed.seedKey);

  const now = new Date().toISOString();

  const row = {
    id: documentId,
    internship_id: internship.id,
    document_type: seed.documentType,
    file_name: seed.fileName,
    storage_path: storagePath,
    mime_type: "application/pdf",
    file_size: file.size,
    status: seed.status,
    uploaded_by: internship.student_id,
    uploaded_at: now,
    reviewed_by: seed.status === "pending" ? null : coordinator.id,
    reviewed_at: seed.status === "pending" ? null : now,
    rejection_reason: seed.status === "rejected" ? (seed.rejectionReason ?? null) : null,
  };

  const { error: databaseError } = await supabaseAdmin
    .from("documents")
    .upsert(row, {
      onConflict: "internship_id,document_type",
    });

  if (databaseError) {
    throw seedError(`documents.database:${seed.seedKey}`, databaseError);
  }

  console.log(
    `  ✓ ${seed.seedKey} | ${seed.studentEmail} | ` +
      `${seed.documentType} | ${seed.status}`,
  );

  /**
   * If an older seed version used another storage path, remove it
   * after the metadata has been successfully updated.
   */
  if (existing && existing.storage_path !== storagePath) {
    const { error: cleanupError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .remove([existing.storage_path]);

    if (cleanupError) {
      console.warn(
        `  ! Could not remove old storage object ` +
          `${existing.storage_path}: ${cleanupError.message}`,
      );
    }
  }
}

async function seed(): Promise<void> {
  validateSeedDocuments();

  const coordinator = await resolveCoordinator();
  const internships = await resolveInternships();

  console.log("========================================");
  console.log("SBIMS Development Document Seed");
  console.log("========================================");
  console.log(`Required document types: ${REQUIRED_DOCUMENT_TYPES.length}`);
  console.log(`Document records to process: ${seedDocuments.length}`);
  console.log(`Storage bucket: ${STORAGE_BUCKET}`);
  console.log("");

  let successCount = 0;
  let failureCount = 0;

  for (const seedDocumentRecord of seedDocuments) {
    const email = normalizeEmail(seedDocumentRecord.studentEmail);

    const internship = internships.get(email);

    if (!internship) {
      failureCount++;

      console.error(
        `✗ Missing internship for ` + `${seedDocumentRecord.seedKey}: ${email}`,
      );

      continue;
    }

    try {
      await seedDocument(seedDocumentRecord, internship, coordinator);

      successCount++;
    } catch (error) {
      failureCount++;

      console.error(
        `✗ Failed to seed ${seedDocumentRecord.seedKey}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("");

  console.log("========================================");
  console.log("Document seed complete");
  console.log(`Successful: ${successCount}`);
  console.log(`Failed:     ${failureCount}`);
  console.log("========================================");

  if (failureCount > 0) {
    throw new Error(`Document seed completed with ${failureCount} failure(s).`);
  }
}

if (import.meta.main) {
  await seed();
}
