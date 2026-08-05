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

async function resetProfile(
  // deno-lint-ignore no-explicit-any
  user: any,
  // deno-lint-ignore no-explicit-any
  authUser: any,
  mustChangePassword: boolean,
) {
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

// deno-lint-ignore no-explicit-any
async function resetFirstLoginUser(authUser: any) {
  const user = TEST_USERS.firstLogin;

  const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    password: user.password,
  });

  if (passwordError) {
    throw passwordError;
  }

  await resetProfile(user, authUser, true);
}

export async function setupTestUsers() {
  const admin = await ensureAuthUser(TEST_USERS.admin);

  await resetProfile(TEST_USERS.admin, admin, false);

  const student = await ensureAuthUser(TEST_USERS.student);

  await resetProfile(TEST_USERS.student, student, false);

  const firstLogin = await ensureAuthUser(TEST_USERS.firstLogin);

  await resetFirstLoginUser(firstLogin);
}
