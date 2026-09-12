import { createSeedAdminClient, normalizeEmail, seedError } from "./_shared/seed-utils.ts";

const supabaseAdmin = createSeedAdminClient();

type AttendanceValidationStatus = "pending" | "validated" | "rejected";

interface SeedAttendance {
  seedKey: string;
  studentEmail: string;
  attendanceDate: string;
  timeIn: string;
  timeOut: string;
  validationStatus: AttendanceValidationStatus;
  validatedByEmail: string | null;
  validatedAt: string | null;
}

interface StudentRow {
  id: string;
  email: string;
}

interface InternshipRow {
  id: string;
  student_id: string;
  start_date: string | null;
  end_date: string | null;
  status: "pending" | "active" | "completed";
}

interface CoordinatorRow {
  id: string;
  email: string;
  role: "internship_coordinator";
  is_active: boolean;
}

interface AttendanceRow {
  id: string;
  internship_id: string;
  attendance_date: string;
  time_in: string;
  time_out: string;
  validation_status: AttendanceValidationStatus;
  validated_by: string | null;
  validated_at: string | null;
}

const FIRST_SEMESTER_START = "2026-08-17";
const FIRST_SEMESTER_CURRENT_SEED_END = "2026-09-12";
const SUMMER_OJT_START = "2026-06-01";
const SUMMER_OJT_END = "2026-08-07";

function toDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function getWorkingDatesInclusive(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const cursor = toDate(startDate);
  const end = toDate(endDate);

  while (cursor <= end) {
    const day = cursor.getUTCDay();

    if (day >= 1 && day <= 6) {
      dates.push(toDateString(cursor));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
}

function buildAttendanceSeed(): SeedAttendance[] {
  const activeStudents = [
    "studentsbims1@grr.la",
    "studentsbims3@grr.la",
    "studentsbims4@grr.la",
    "studentsbims6@grr.la",
    "studentsbims7@grr.la",
    "studentsbims8@grr.la",
    "studentsbims9@grr.la",
    "studentsbims10@grr.la",
    "studentsbims11@grr.la",
    "studentsbims12@grr.la",
  ] as const;

  const currentPeriodDates = getWorkingDatesInclusive(
    FIRST_SEMESTER_START,
    FIRST_SEMESTER_CURRENT_SEED_END,
  );

  const records: SeedAttendance[] = [];

  for (const studentEmail of activeStudents) {
    currentPeriodDates.forEach((attendanceDate, index) => {
      const isPending = index === currentPeriodDates.length - 2 ||
        index === currentPeriodDates.length - 1;
      const isRejected = index === currentPeriodDates.length - 3;
      const validationStatus: AttendanceValidationStatus = isPending
        ? "pending"
        : isRejected
        ? "rejected"
        : "validated";

      records.push({
        seedKey: `attendance-${records.length + 1}`,
        studentEmail,
        attendanceDate,
        timeIn: "08:00:00",
        timeOut: "17:00:00",
        validationStatus,
        validatedByEmail: validationStatus === "pending" ? null : "coordinatorsbims1@grr.la",
        validatedAt: validationStatus === "pending" ? null : `${attendanceDate}T17:30:00+08:00`,
      });
    });
  }

  // One completed historical Summer OJT record set with exactly 300
  // validated rendered hours: 37 x 8 hours + 1 x 4 hours.
  const summerDates = getWorkingDatesInclusive(SUMMER_OJT_START, SUMMER_OJT_END);
  const completedDates = summerDates.slice(0, 38);
  const completedStudentEmail = "studentsbims5@grr.la";

  completedDates.forEach((attendanceDate, index) => {
    const isFinalShortDay = index === completedDates.length - 1;

    records.push({
      seedKey: `attendance-${records.length + 1}`,
      studentEmail: completedStudentEmail,
      attendanceDate,
      timeIn: "08:00:00",
      timeOut: isFinalShortDay ? "13:00:00" : "17:00:00",
      validationStatus: "validated",
      validatedByEmail: "coordinatorsbims1@grr.la",
      validatedAt: `${attendanceDate}T${isFinalShortDay ? "13:30" : "17:30"}:00+08:00`,
    });
  });

  return records;
}

const seedAttendance = buildAttendanceSeed();

const ATTENDANCE_SELECT = `
  id,
  internship_id,
  attendance_date,
  time_in,
  time_out,
  validation_status,
  validated_by,
  validated_at
`;

async function findStudentByEmail(email: string): Promise<StudentRow | null> {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabaseAdmin
    .from("student_profiles")
    .select(
      `
      id,
      profiles!inner (
        email
      )
    `,
    )
    .eq("profiles.email", normalizedEmail)
    .maybeSingle();

  if (error) {
    throw seedError(`attendance.find-student:${normalizedEmail}`, error);
  }

  if (!data) {
    return null;
  }

  const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

  if (!profile) {
    return null;
  }

  return {
    id: data.id,
    email: normalizeEmail(profile.email),
  };
}

async function findInternshipByStudent(
  studentId: string,
): Promise<InternshipRow | null> {
  const { data, error } = await supabaseAdmin
    .from("internships")
    .select("id, student_id, start_date, end_date, status")
    .eq("student_id", studentId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw seedError(`attendance.find-internship:${studentId}`, error);
  }

  return data as InternshipRow | null;
}

async function findCoordinatorByEmail(
  email: string,
): Promise<CoordinatorRow | null> {
  const normalizedEmail = normalizeEmail(email);

  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id, email, role, is_active")
    .eq("email", normalizedEmail)
    .eq("role", "internship_coordinator")
    .maybeSingle();

  if (error) {
    throw seedError(`attendance.find-coordinator:${normalizedEmail}`, error);
  }

  return data as CoordinatorRow | null;
}

async function resolveStudent(email: string): Promise<StudentRow> {
  const student = await findStudentByEmail(email);

  if (!student) {
    throw new Error(`Student profile not found: ${normalizeEmail(email)}`);
  }

  return student;
}

async function resolveInternship(
  studentId: string,
  studentEmail: string,
): Promise<InternshipRow> {
  const internship = await findInternshipByStudent(studentId);

  if (!internship) {
    throw new Error(
      `Internship not found for student: ${normalizeEmail(studentEmail)}`,
    );
  }

  if (internship.status !== "active" && internship.status !== "completed") {
    throw new Error(
      `Internship for ${normalizeEmail(studentEmail)} is ` +
        `${internship.status} and cannot receive seeded attendance records.`,
    );
  }

  if (!internship.start_date || !internship.end_date) {
    throw new Error(
      `Internship for ${normalizeEmail(studentEmail)} has no valid internship period.`,
    );
  }

  return internship;
}

async function resolveCoordinator(email: string): Promise<CoordinatorRow> {
  const coordinator = await findCoordinatorByEmail(email);

  if (!coordinator) {
    throw new Error(
      `Internship coordinator profile not found: ${normalizeEmail(email)}`,
    );
  }

  if (!coordinator.is_active) {
    throw new Error(
      `Internship coordinator ${normalizeEmail(email)} is inactive ` +
        "and cannot validate attendance.",
    );
  }

  return coordinator;
}

async function findExistingAttendance(
  internshipId: string,
  attendanceDate: string,
): Promise<AttendanceRow | null> {
  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .select(ATTENDANCE_SELECT)
    .eq("internship_id", internshipId)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();

  if (error) {
    throw seedError(
      `attendance.find-existing:${internshipId}:${attendanceDate}`,
      error,
    );
  }

  return data as AttendanceRow | null;
}

async function createAttendance(
  seed: SeedAttendance,
  internship: InternshipRow,
  validatedBy: CoordinatorRow | null,
): Promise<void> {
  const { data, error } = await supabaseAdmin
    .from("attendance_records")
    .insert({
      internship_id: internship.id,
      attendance_date: seed.attendanceDate,
      time_in: seed.timeIn,
      time_out: seed.timeOut,
      validation_status: seed.validationStatus,
      validated_by: validatedBy?.id ?? null,
      validated_at: seed.validatedAt,
    })
    .select(ATTENDANCE_SELECT)
    .single();

  if (error || !data) {
    throw seedError(`attendance.create:${seed.seedKey}`, error);
  }

  console.log(
    `  ✓ Created attendance ${data.id} ` +
      `(date=${seed.attendanceDate}, ` +
      `time=${seed.timeIn}-${seed.timeOut}, ` +
      `status=${seed.validationStatus})`,
  );
}

async function reconcileAttendance(
  seed: SeedAttendance,
  existing: AttendanceRow,
  validatedBy: CoordinatorRow | null,
): Promise<void> {
  /*
   * Attendance status represents the current validation state.
   *
   * Do not change an existing lifecycle state during reconciliation.
   * This prevents a previously validated or rejected record from
   * being silently reset to another state when the seed is rerun.
   */
  const { error } = await supabaseAdmin
    .from("attendance_records")
    .update({
      attendance_date: seed.attendanceDate,
      time_in: seed.timeIn,
      time_out: seed.timeOut,
      validated_by: validatedBy?.id ?? null,
      validated_at: seed.validatedAt,
    })
    .eq("id", existing.id);

  if (error) {
    throw seedError(`attendance.reconcile:${seed.seedKey}`, error);
  }

  console.log(
    `  Attendance already exists: ${existing.id} ` +
      `(status=${existing.validation_status})`,
  );
}

async function seedAttendanceRecord(
  seed: SeedAttendance,
): Promise<"created" | "exists"> {
  console.log(`\nProcessing ${seed.seedKey}`);

  const student = await resolveStudent(seed.studentEmail);

  const internship = await resolveInternship(student.id, student.email);

  if (seed.attendanceDate < internship.start_date! || seed.attendanceDate > internship.end_date!) {
    throw new Error(
      `Attendance date ${seed.attendanceDate} for ${normalizeEmail(seed.studentEmail)} ` +
        `is outside internship period ${internship.start_date}..${internship.end_date}.`,
    );
  }

  let validatedBy: CoordinatorRow | null = null;

  if (seed.validatedByEmail) {
    validatedBy = await resolveCoordinator(seed.validatedByEmail);
  }

  const existing = await findExistingAttendance(
    internship.id,
    seed.attendanceDate,
  );

  if (existing) {
    await reconcileAttendance(seed, existing, validatedBy);
    return "exists";
  }

  await createAttendance(seed, internship, validatedBy);

  return "created";
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

function isValidTime(value: string): boolean {
  return /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
}

function timeToSeconds(value: string): number {
  const [hours, minutes, seconds = "00"] = value.split(":");

  return Number(hours) * 60 * 60 + Number(minutes) * 60 + Number(seconds);
}

function validateSeedAttendance(): void {
  const seenSeedKeys = new Set<string>();
  const seenStudentDates = new Set<string>();

  for (const attendance of seedAttendance) {
    const studentEmail = normalizeEmail(attendance.studentEmail);

    if (seenSeedKeys.has(attendance.seedKey)) {
      throw new Error(`Duplicate attendance seed key: ${attendance.seedKey}`);
    }

    if (!isValidDate(attendance.attendanceDate)) {
      throw new Error(
        `Invalid attendance date for ${attendance.seedKey}: ` +
          attendance.attendanceDate,
      );
    }

    if (!isValidTime(attendance.timeIn)) {
      throw new Error(
        `Invalid time_in for ${attendance.seedKey}: ${attendance.timeIn}`,
      );
    }

    if (!isValidTime(attendance.timeOut)) {
      throw new Error(
        `Invalid time_out for ${attendance.seedKey}: ${attendance.timeOut}`,
      );
    }

    if (timeToSeconds(attendance.timeOut) <= timeToSeconds(attendance.timeIn)) {
      throw new Error(
        `time_out must be later than time_in for ${attendance.seedKey}`,
      );
    }

    if (
      attendance.validationStatus === "pending" &&
      (attendance.validatedByEmail !== null || attendance.validatedAt !== null)
    ) {
      throw new Error(
        `Pending attendance ${attendance.seedKey} cannot have ` +
          "validated_by or validated_at.",
      );
    }

    if (
      attendance.validationStatus !== "pending" &&
      (!attendance.validatedByEmail || !attendance.validatedAt)
    ) {
      throw new Error(
        `Attendance ${attendance.seedKey} requires ` +
          "validated_by and validated_at.",
      );
    }

    const studentDateKey = `${studentEmail}:${attendance.attendanceDate}`;

    if (seenStudentDates.has(studentDateKey)) {
      throw new Error(
        `Duplicate attendance date for student: ${studentDateKey}`,
      );
    }

    seenSeedKeys.add(attendance.seedKey);
    seenStudentDates.add(studentDateKey);
  }
}

async function seed(): Promise<void> {
  validateSeedAttendance();

  console.log("========================================");
  console.log("SBIMS Development Attendance Seed");
  console.log("========================================");
  console.log(`Attendance records to process: ${seedAttendance.length}`);

  let createdCount = 0;
  let existingCount = 0;
  let failureCount = 0;

  for (const attendance of seedAttendance) {
    try {
      const result = await seedAttendanceRecord(attendance);

      switch (result) {
        case "created":
          createdCount++;
          break;

        case "exists":
          existingCount++;
          break;
      }
    } catch (error) {
      failureCount++;

      console.error(
        `✗ Failed to seed ${attendance.seedKey}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\n========================================");
  console.log("Attendance Seed Summary");
  console.log("========================================");
  console.log(`Created:  ${createdCount}`);
  console.log(`Existing: ${existingCount}`);
  console.log(`Failed:   ${failureCount}`);
  console.log(`Total:    ${seedAttendance.length}`);

  if (failureCount > 0) {
    throw new Error(
      `Attendance seeding completed with ${failureCount} failure(s).`,
    );
  }

  console.log("\nAttendance seeding completed successfully.");
}

await seed();
