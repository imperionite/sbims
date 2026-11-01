import { assertEquals, assertExists } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExpectedAuditEvent {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
}

/**
 * Verifies that an operation generated and persisted at least one
 * matching audit event.
 *
 * resourceId:
 * - string: matches the specified resource ID.
 * - null: explicitly matches a NULL resource ID.
 * - undefined: does not filter by resource ID.
 *
 * details:
 * - When supplied, verifies the specified top-level detail properties.
 * - Unspecified properties in the persisted details are ignored.
 *
 * Multiple matching events are permitted because integration tests
 * may be rerun against a database containing previous audit records.
 *
 * This function only reads audit_logs. It does not create audit events.
 */
export async function assertAuditEvent(
  supabaseAdmin: SupabaseClient,
  expected: ExpectedAuditEvent,
): Promise<void> {
  let query = supabaseAdmin
    .from("audit_logs")
    .select("user_id, action, resource_type, resource_id, details")
    .eq("user_id", expected.actorId)
    .eq("action", expected.action)
    .eq("resource_type", expected.resourceType);

  if (expected.resourceId === null) {
    query = query.is("resource_id", null);
  } else if (expected.resourceId !== undefined) {
    query = query.eq("resource_id", expected.resourceId);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to retrieve audit event: ${error.message}`);
  }

  assertExists(data, "Audit query should return a result.");

  assertEquals(
    data.length > 0,
    true,
    `Expected a persisted audit event matching: ${JSON.stringify(expected)}`,
  );

  const event = data[0];

  assertEquals(event.user_id, expected.actorId);
  assertEquals(event.action, expected.action);
  assertEquals(event.resource_type, expected.resourceType);

  if (expected.resourceId !== undefined) {
    assertEquals(event.resource_id, expected.resourceId);
  }

  if (expected.details !== undefined) {
    const actualDetails = event.details as Record<string, unknown> | null;

    assertExists(actualDetails, "Audit event details should exist.");

    for (const [key, expectedValue] of Object.entries(expected.details)) {
      assertEquals(
        actualDetails[key],
        expectedValue,
        `Unexpected audit detail value for "${key}".`,
      );
    }
  }
}
