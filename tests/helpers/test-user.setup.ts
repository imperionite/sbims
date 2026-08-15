import type { User } from "@supabase/supabase-js";

import { getDenoEnv } from "../../src/config/runtime.ts";
import { loadEnv } from "../../src/config/env.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";

import { TEST_USERS } from "../fixtures/test-users.ts";

const env = loadEnv(getDenoEnv());

const { supabaseAdmin } = createSupabaseClients(env);

type TestUser = {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  newPassword?: string;
};

async function findAuthUser(email: string): Promise<User | undefined> {
  const { data, error } = await supabaseAdmin.auth.admin.listUsers();

  if (error) {
    throw error;
  }

  return data.users.find(
    (user) => user.email?.toLowerCase() === email.toLowerCase(),
  );
}

async function ensureAuthUser(user: TestUser): Promise<User> {
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
  user: TestUser,
  authUser: User,
  mustChangePassword: boolean,
): Promise<void> {
  /*
   * Keep the first-login password deterministic.
   *
   * This is important because the same test users
   * are reused between test runs.
   */
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

export async function setupTestUsers(): Promise<void> {
  const standardUsers: TestUser[] = [
    TEST_USERS.admin,
    TEST_USERS.student,
    TEST_USERS.coordinator,
  ];

  for (const userConfig of standardUsers) {
    const authUser = await ensureAuthUser(userConfig);

    await upsertProfile(userConfig, authUser, false);
  }

  const firstLoginConfig: TestUser = TEST_USERS.firstLogin;

  const firstLoginAuthUser = await ensureAuthUser(firstLoginConfig);

  await upsertProfile(firstLoginConfig, firstLoginAuthUser, true);
}
