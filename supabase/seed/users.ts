import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";

const env = loadEnv(getDenoEnv());

if (env.ENVIRONMENT === "production") {
  throw new Error("Cannot seed production database");
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
}

const seedPassword = "Dev2026!";

const seedUsers: SeedUser[] = [
  {
    email: "adminsbims1@grr.la",
    password: seedPassword,
    firstName: "Isaac",
    middleName: "Maradona",
    lastName: "Clarke",
    suffix: null,
    role: "administrator",
  },

  {
    email: "coordinatorsbims1@grr.la",
    password: seedPassword,
    firstName: "Elise",
    middleName: "Manansala",
    lastName: "Quijano",
    suffix: null,
    role: "internship_coordinator",
  },

  {
    email: "facultysbims1@grr.la",
    password: seedPassword,
    firstName: "Nathaniel Andres",
    middleName: "Sarmiento",
    lastName: "Nacpil",
    suffix: "Jr.",
    role: "faculty_adviser",
  },

  {
    email: "studentsbims1@grr.la",
    password: seedPassword,
    firstName: "Rafael Joaquin",
    middleName: "Bondoc",
    lastName: "Dimalanta",
    suffix: "III",
    role: "student",
  },

  {
    email: "htesbims1@grr.la",
    password: seedPassword,
    firstName: "Roberto Luis",
    middleName: "Fernandez",
    lastName: "Valderama",
    role: "hte_supervisor",
  },
];

async function findUser(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
}

async function createSeedUser(user: SeedUser): Promise<void> {
  console.log(`Creating ${user.email}`);

  const existing = await findUser(user.email);

  let userId: string;

  if (existing) {
    console.log("Existing user found");

    userId = existing.id;
  } else {
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
      throw new Error(error?.message ?? "Unable to create user");
    }

    userId = data.user.id;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: userId,
      email: user.email,
      first_name: user.firstName,
      middle_name: user.middleName ?? null,
      last_name: user.lastName,
      suffix: user.suffix ?? null,
      role: user.role,
      is_active: true,
      must_change_password: true,
      created_by: null,
    },
    {
      onConflict: "id",
    },
  );

  if (profileError) {
    throw new Error(profileError.message);
  }

  console.log(`✓ ${user.email}`);
}

async function seed(): Promise<void> {
  console.log("SBIMS Development Seed");

  for (const user of seedUsers) {
    try {
      await createSeedUser(user);
    } catch (error) {
      console.error(error);
    }
  }

  console.log("Seed complete");
}

await seed();
