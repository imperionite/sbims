import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";

const runtimeEnv = getDenoEnv();
const env = loadEnv(runtimeEnv);

if (env.ENVIRONMENT === "production") {
  throw new Error("Cannot seed production database");
}

const seedPassword = runtimeEnv.SEED_USER_PASSWORD;
if (!seedPassword) {
  throw new Error("SEED_USER_PASSWORD is required when seeding users.");
}
if (seedPassword.length < 8) {
  throw new Error("SEED_USER_PASSWORD must be at least 8 characters long.");
}

const { supabaseAdmin } = createSupabaseClients(env);

type UserRole =
  | "administrator"
  | "internship_coordinator"
  | "faculty_adviser"
  | "student"
  | "hte_supervisor";

interface SeedUser {
  email: string;
  password: string;
  firstName: string;
  middleName?: string;
  lastName: string;
  suffix?: string | null;
  role: UserRole;
  /**
   * Applies only when the Auth user/profile is created for the first time.
   * Existing users retain their current password state.
   */
  mustChangePassword: boolean;
}

const seedUsers: SeedUser[] = [
  // =====================================================
  // Administrator
  // =====================================================
  {
    email: "adminsbims1@grr.la",
    password: seedPassword,
    firstName: "Isaac",
    middleName: "Maradona",
    lastName: "Clarke",
    suffix: null,
    role: "administrator",
    mustChangePassword: false,
  },
  // =====================================================
  // Internship Coordinators
  // =====================================================
  {
    email: "coordinatorsbims1@grr.la",
    password: seedPassword,
    firstName: "Elise",
    middleName: "Manansala",
    lastName: "Quijano",
    suffix: null,
    role: "internship_coordinator",
    mustChangePassword: false,
  },
  {
    email: "coordinatorsbims2@grr.la",
    password: seedPassword,
    firstName: "Gabriel",
    middleName: "Santos",
    lastName: "Villanueva",
    suffix: null,
    role: "internship_coordinator",
    mustChangePassword: true,
  },
  // =====================================================
  // Faculty Advisers
  // =====================================================
  {
    email: "facultysbims1@grr.la",
    password: seedPassword,
    firstName: "Nathaniel Andres",
    middleName: "Sarmiento",
    lastName: "Nacpil",
    suffix: "Jr.",
    role: "faculty_adviser",
    mustChangePassword: false,
  },
  {
    email: "facultysbims2@grr.la",
    password: seedPassword,
    firstName: "Camille",
    middleName: "Reyes",
    lastName: "Mendoza",
    suffix: null,
    role: "faculty_adviser",
    mustChangePassword: true,
  },
  {
    email: "facultysbims3@grr.la",
    password: seedPassword,
    firstName: "Adrian Miguel",
    middleName: "Torres",
    lastName: "Santiago",
    suffix: null,
    role: "faculty_adviser",
    mustChangePassword: false,
  },
  // =====================================================
  // Students
  // =====================================================
  {
    email: "studentsbims1@grr.la",
    password: seedPassword,
    firstName: "Rafael Joaquin",
    middleName: "Bondoc",
    lastName: "Dimalanta",
    suffix: "III",
    role: "student",
    mustChangePassword: false,
  },
  {
    email: "studentsbims2@grr.la",
    password: seedPassword,
    firstName: "Sofia",
    middleName: "Luna",
    lastName: "Cabrera",
    suffix: null,
    role: "student",
    mustChangePassword: true,
  },
  {
    email: "studentsbims3@grr.la",
    password: seedPassword,
    firstName: "Daniel",
    middleName: "Jose",
    lastName: "Navarro",
    suffix: null,
    role: "student",
    mustChangePassword: false,
  },
  {
    email: "studentsbims4@grr.la",
    password: seedPassword,
    firstName: "Mikaela",
    middleName: "Diaz",
    lastName: "Flores",
    suffix: null,
    role: "student",
    mustChangePassword: false,
  },
  {
    email: "studentsbims5@grr.la",
    password: seedPassword,
    firstName: "Lucas",
    middleName: "David",
    lastName: "Pascual",
    suffix: null,
    role: "student",
    mustChangePassword: false,
  },
  {
    email: "studentsbims6@grr.la",
    password: seedPassword,
    firstName: "Bea Bianca",
    middleName: "Sánchez",
    lastName: "Mallari",
    suffix: null,
    role: "student",
    mustChangePassword: false,
  },
  // =====================================================
  // HTE Supervisors
  // =====================================================
  {
    email: "htesbims1@grr.la",
    password: seedPassword,
    firstName: "Roberto Luis",
    middleName: "Fernandez",
    lastName: "Valderama",
    suffix: null,
    role: "hte_supervisor",
    mustChangePassword: false,
  },
  {
    email: "htesbims2@grr.la",
    password: seedPassword,
    firstName: "Patricia Anne",
    middleName: "Ramirez",
    lastName: "Dominguez",
    suffix: null,
    role: "hte_supervisor",
    mustChangePassword: true,
  },
  {
    email: "htesbims3@grr.la",
    password: seedPassword,
    firstName: "Marco Luis",
    middleName: "Corpuz",
    lastName: "Bautista",
    suffix: null,
    role: "hte_supervisor",
    mustChangePassword: false,
  },
  {
    email: "htesbims4@grr.la",
    password: seedPassword,
    firstName: "Elena",
    middleName: "Santos",
    lastName: "Fajardo",
    suffix: null,
    role: "hte_supervisor",
    mustChangePassword: false,
  },
];

async function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();
  if (error) {
    throw new Error(`Unable to list Auth users: ${error.message}`);
  }
  return data.users.find(
    (user) => user.email?.trim().toLowerCase() === normalizedEmail,
  );
}

async function findProfileById(id: string) {
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select(
      "id, email, first_name, middle_name, last_name, suffix, role, is_active, must_change_password, last_password_changed_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to load profile ${id}: ${error.message}`);
  }
  return data;
}

async function createAuthUser(user: SeedUser): Promise<string> {
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: user.email,
    password: user.password,
    email_confirm: true,
    user_metadata: {
      first_name: user.firstName,
      middle_name: user.middleName ?? null,
      last_name: user.lastName,
      suffix: user.suffix ?? null,
      role: user.role,
    },
  });

  if (error || !data.user) {
    throw new Error(
      error?.message ?? `Unable to create Auth user ${user.email}`,
    );
  }
  return data.user.id;
}

async function createProfile(userId: string, user: SeedUser): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("profiles")
    .insert({
      id: userId,
      email: user.email,
      first_name: user.firstName,
      middle_name: user.middleName ?? null,
      last_name: user.lastName,
      suffix: user.suffix ?? null,
      role: user.role,
      is_active: true,
      must_change_password: user.mustChangePassword,
      last_password_changed_at: user.mustChangePassword ? null : now,
      created_by: null,
    });

  if (error) {
    throw new Error(`Unable to create profile for ${user.email}: ${error.message}`);
  }
}

async function reconcileExistingProfile(
  userId: string,
  user: SeedUser,
): Promise<void> {
  const existingProfile = await findProfileById(userId);
  if (!existingProfile) {
    console.log("  Profile missing; creating profile");
    await createProfile(userId, user);
    return;
  }

  const { error } = await supabaseAdmin
    .from("profiles")
    .update({
      email: user.email,
      first_name: user.firstName,
      middle_name: user.middleName ?? null,
      last_name: user.lastName,
      suffix: user.suffix ?? null,
      role: user.role,
    })
    .eq("id", userId);

  if (error) {
    throw new Error(`Unable to reconcile profile for ${user.email}: ${error.message}`);
  }

  console.log(
    `  Existing state preserved: ` +
      `is_active=${existingProfile.is_active}, ` +
      `must_change_password=${existingProfile.must_change_password}, ` +
      `last_password_changed_at=${existingProfile.last_password_changed_at ?? "null"}`,
  );
}

async function createSeedUser(user: SeedUser): Promise<void> {
  const normalizedEmail = user.email.trim().toLowerCase();
  console.log(`\nProcessing ${normalizedEmail}`);

  const existingAuthUser = await findUserByEmail(normalizedEmail);
  if (!existingAuthUser) {
    console.log("  Auth user does not exist; creating");
    const userId = await createAuthUser({
      ...user,
      email: normalizedEmail,
    });

    try {
      await createProfile(userId, {
        ...user,
        email: normalizedEmail,
      });
    } catch (error) {
      console.error(
        `  Profile creation failed; rolling back Auth user ${userId}`,
      );

      const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

      if (deleteError) {
        throw new Error(
          `${error instanceof Error ? error.message : String(error)} ` +
            `Additionally failed to roll back Auth user: ${deleteError.message}`,
        );
      }

      throw error;
    }

    console.log(
      `  ✓ Created ${normalizedEmail} ` +
        `(role=${user.role}, ` +
        `must_change_password=${user.mustChangePassword})`,
    );
    return;
  }

  console.log(`  Auth user already exists: ${existingAuthUser.id}`);
  await reconcileExistingProfile(existingAuthUser.id, {
    ...user,
    email: normalizedEmail,
  });
  console.log(`  ✓ Reconciled ${normalizedEmail}`);
}

function validateSeedUsers(): void {
  const seenEmails = new Set<string>();
  for (const user of seedUsers) {
    const email = user.email.trim().toLowerCase();
    if (seenEmails.has(email)) {
      throw new Error(`Duplicate seed user email: ${email}`);
    }
    seenEmails.add(email);
  }

  const roles: UserRole[] = [
    "administrator",
    "internship_coordinator",
    "faculty_adviser",
    "student",
    "hte_supervisor",
  ];

  for (const role of roles) {
    const usersForRole = seedUsers.filter((user) => user.role === role);
    const usersRequiringPasswordChange = usersForRole.filter(
      (user) => user.mustChangePassword,
    );

    if (role === "administrator") {
      if (usersRequiringPasswordChange.length > 1) {
        throw new Error(
          `Expected at most one ${role} seed user with ` +
            `mustChangePassword=true, found ` +
            `${usersRequiringPasswordChange.length}.`,
        );
      }
    } else {
      if (usersRequiringPasswordChange.length !== 1) {
        throw new Error(
          `Expected exactly one ${role} seed user with ` +
            `mustChangePassword=true, found ` +
            `${usersRequiringPasswordChange.length}.`,
        );
      }
    }
  }
}

async function seed(): Promise<void> {
  validateSeedUsers();
  console.log("========================================");
  console.log("SBIMS Development User Seed");
  console.log("========================================");
  console.log(`Users to process: ${seedUsers.length}`);

  let successCount = 0;
  let failureCount = 0;

  for (const user of seedUsers) {
    try {
      await createSeedUser(user);
      successCount++;
    } catch (error) {
      failureCount++;
      console.error(
        `✗ Failed to seed ${user.email}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  console.log("\n========================================");
  console.log("Seed complete");
  console.log(`Successful: ${successCount}`);
  console.log(`Failed:     ${failureCount}`);
  console.log("========================================");

  if (failureCount > 0) {
    throw new Error(`User seed completed with ${failureCount} failure(s).`);
  }
}

await seed();
