import { getDenoEnv } from "../../src/config/runtime.ts";
import { loadEnv } from "../../src/config/env.ts";
import { createSupabaseClients } from "../../src/lib/supabase.ts";

import { TEST_USERS } from "../../tests/fixtures/test-users.ts";
import { setupTestUsers } from "../../tests/helpers/test-user.setup.ts";

const securityTestPassword = Deno.env.get("SECURITY_TEST_PASSWORD");

if (!securityTestPassword) {
  throw new Error("SECURITY_TEST_PASSWORD environment variable is required.");
}

// Create or update the standard integration-test accounts and profiles.
await setupTestUsers();

// Use the same test environment as the integration-test setup helper.
const env = loadEnv(getDenoEnv());
const { supabaseAdmin } = createSupabaseClients(env);

const coordinatorEmail = TEST_USERS.coordinator.email;

const { data, error } = await supabaseAdmin.auth.admin.listUsers();

if (error) {
  throw new Error(`Unable to retrieve test users: ${error.message}`);
}

const coordinator = data.users.find(
  (user) => user.email?.toLowerCase() === coordinatorEmail.toLowerCase(),
);

if (!coordinator) {
  throw new Error(
    `Coordinator test account was not found: ${coordinatorEmail}`,
  );
}

// Reset the coordinator password on every security-baseline run.
// The password is supplied by GitHub Actions, not printed or committed.
const { error: passwordError } = await supabaseAdmin.auth.admin.updateUserById(
  coordinator.id,
  {
    password: securityTestPassword,
  },
);

if (passwordError) {
  throw new Error(
    `Unable to configure coordinator test account: ${passwordError.message}`,
  );
}

console.log("Security test users provisioned.");
console.log("Security test coordinator account configured.");
