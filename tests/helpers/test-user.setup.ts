import { supabaseAdmin } from "../../src/lib/supabase.ts";
import { TEST_USERS } from "../fixtures/test-users.ts";

async function findAuthUser(email: string) {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
}

// deno-lint-ignore no-explicit-any
async function ensureAuthUser(user: any) {
  let authUser = await findAuthUser(user.email);

  if (!authUser) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
    });

    if (error || !data.user) {
      throw error ?? new Error("Unable to create test user");
    }

    authUser = data.user;
  }

  return authUser;
}

async function upsertProfile(
  // deno-lint-ignore no-explicit-any
  user: any,
  // deno-lint-ignore no-explicit-any
  authUser: any,
  mustChangePassword: boolean,
) {
  // If it's a first login user, update their auth password explicitly
  if (mustChangePassword) {
    const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
      password: user.password,
    });

    if (passwordError) {
      throw passwordError;
    }
  }

  const { error } = await supabaseAdmin.from("profiles").upsert(
    {
      id: authUser.id,
      email: user.email,
      first_name: user.firstName,
      middle_name: null,
      last_name: user.lastName,
      suffix: null,
      role: user.role,
      is_active: true,
      must_change_password: mustChangePassword,
    },
    {
      onConflict: "id",
    },
  );

  if (error) {
    throw error;
  }
}

export async function setupTestUsers() {
  const standardUsers = [
    TEST_USERS.admin,
    TEST_USERS.student,
    TEST_USERS.coordinator,
  ];

  // Setup standard users
  for (const userConfig of standardUsers) {
    const authUser = await ensureAuthUser(userConfig);
    await upsertProfile(userConfig, authUser, false);
  }

  // Setup first-login user separately due to password/flag requirements
  const firstLoginConfig = TEST_USERS.firstLogin;
  const firstLoginAuthUser = await ensureAuthUser(firstLoginConfig);
  await upsertProfile(firstLoginConfig, firstLoginAuthUser, true);
}
