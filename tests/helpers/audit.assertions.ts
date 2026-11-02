import { assertEquals, assertExists } from "@std/assert";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface ExpectedAuditEvent {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  details?: Record<string, unknown>;
  createdAfter?: string;
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
    .select("user_id, action, resource_type, resource_id, details, created_at")
    .eq("user_id", expected.actorId)
    .eq("action", expected.action)
    .eq("resource_type", expected.resourceType);

  if (expected.resourceId === null) {
    query = query.is("resource_id", null);
  } else if (expected.resourceId !== undefined) {
    query = query.eq("resource_id", expected.resourceId);
  }

  if (expected.createdAfter !== undefined) {
    query = query.gte("created_at", expected.createdAfter);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Unable to retrieve audit event: ${error.message}`);
  }

  assertExists(data);

  assertEquals(
    data.length > 0,
    true,
    `Expected a persisted audit event matching: ${JSON.stringify(expected)}`,
  );

  const matchingEvent = data.find((event) => {
    if (expected.details === undefined) {
      return true;
    }

    const actualDetails = event.details as Record<string, unknown> | null;

    if (!actualDetails) return false;

    return Object.entries(expected.details).every(
      ([key, value]) => actualDetails[key] === value,
    );
  });

  assertExists(
    matchingEvent,
    `No audit event matched the expected details: ${JSON.stringify(expected.details)}`,
  );

  assertEquals(matchingEvent.user_id, expected.actorId);
  assertEquals(matchingEvent.action, expected.action);
  assertEquals(matchingEvent.resource_type, expected.resourceType);

  if (expected.resourceId !== undefined) {
    assertEquals(matchingEvent.resource_id, expected.resourceId);
  }
}
