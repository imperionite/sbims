import { loadEnv } from "../../src/config/env.ts";
import { getDenoEnv } from "../../src/config/runtime.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";

const runtimeEnv = getDenoEnv();

const env = loadEnv(runtimeEnv);

if (env.ENVIRONMENT !== "production") {
  throw new Error("Bootstrap admin should only run in production.");
}

const email = runtimeEnv.INITIAL_ADMIN_EMAIL;
const password = runtimeEnv.INITIAL_ADMIN_PASSWORD;

if (!email || !password) {
  throw new Error("Missing INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD");
}

const adminEmail = email.toLowerCase();

const { supabaseAdmin } = createSupabaseClients(env);

async function createInitialAdmin(): Promise<void> {
  console.log("Creating initial SBIMS administrator...");

  const { data: existingUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();

  if (listError) {
    throw listError;
  }

  const existing = existingUsers.users.find(
    (user) => user.email?.toLowerCase() === adminEmail,
  );

  let userId: string;

  if (existing) {
    console.log("Administrator already exists.");

    userId = existing.id;
  } else {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: "System",
        last_name: "Administrator",
        role: "administrator",
      },
    });

    if (error || !data.user) {
      throw new Error(error?.message ?? "Unable to create administrator");
    }

    userId = data.user.id;
  }

  const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
    id: userId,
    email,
    first_name: "System",
    middle_name: null,
    last_name: "Administrator",
    suffix: null,
    role: "administrator",
    is_active: true,
    must_change_password: true,
    created_by: null,
  });

  if (profileError) {
    throw profileError;
  }

  console.log("Initial administrator created successfully.");
}

await createInitialAdmin();
