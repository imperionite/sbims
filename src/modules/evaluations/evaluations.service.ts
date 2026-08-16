import type { SupabaseClients } from "../../lib/supabase.ts";
import { AppError } from "../../errors/app-error.ts";

import type {
  CreateEvaluationInput,
  EvaluationRecord,
  EvaluationResponses,
  UpdateEvaluationInput,
} from "./evaluations.types.ts";

type EvaluationAccessRole =
  | "hte_supervisor"
  | "student"
  | "internship_coordinator";

interface InternshipAuthorizationRecord {
  id: string;
  student_id: string;
  hte_id: string;
  status: string;
  hte_profiles: {
    supervisor_id: string | null;
  } | null;
}

export class EvaluationService {
  constructor(private readonly clients: SupabaseClients) {}

  /**
   * Verifies that the authenticated HTE Supervisor is
   * the supervisor assigned to the internship's HTE.
   */
  private async verifyHTESupervisorAssignment(
    internshipId: string,
    userId: string,
  ): Promise<InternshipAuthorizationRecord> {
    const { data, error } = await this.clients.supabaseAdmin
      .from("internships")
      .select(
        `
        id,
        student_id,
        hte_id,
        status,
        hte_profiles!inner (
          supervisor_id
        )
        `,
      )
      .eq("id", internshipId)
      .maybeSingle();

    if (error) {
      console.error("VERIFY HTE SUPERVISOR ASSIGNMENT FAILED:", error);

      throw new AppError(500, "Failed to verify internship assignment.");
    }

    if (!data) {
      throw new AppError(404, "Internship not found.");
    }

    const internship = data as unknown as InternshipAuthorizationRecord;

    if (
      !internship.hte_profiles ||
      internship.hte_profiles.supervisor_id !== userId
    ) {
      throw new AppError(
        403,
        "You can only manage evaluations for internships assigned to your HTE.",
      );
    }

    return internship;
  }

  /**
   * Verifies that the authenticated user is allowed to
   * access the evaluation.
   */
  private async verifyEvaluationAccess(
    evaluation: EvaluationRecord,
    userId: string,
    role: EvaluationAccessRole,
  ): Promise<InternshipAuthorizationRecord> {
    const { data, error } = await this.clients.supabaseAdmin
      .from("internships")
      .select(
        `
        id,
        student_id,
        hte_id,
        status,
        hte_profiles!inner (
          supervisor_id
        )
        `,
      )
      .eq("id", evaluation.internship_id)
      .maybeSingle();

    if (error) {
      console.error("VERIFY EVALUATION ACCESS FAILED:", error);

      throw new AppError(500, "Failed to verify evaluation access.");
    }

    if (!data) {
      throw new AppError(404, "Internship not found.");
    }

    const internship = data as unknown as InternshipAuthorizationRecord;

    if (role === "hte_supervisor") {
      if (
        !internship.hte_profiles ||
        internship.hte_profiles.supervisor_id !== userId
      ) {
        throw new AppError(
          403,
          "You can only access evaluations for internships assigned to your HTE.",
        );
      }

      return internship;
    }

    if (role === "student") {
      if (internship.student_id !== userId) {
        throw new AppError(
          403,
          "You can only access evaluations for your own internship.",
        );
      }

      if (evaluation.status !== "submitted") {
        throw new AppError(
          403,
          "Evaluation results are only available after submission.",
        );
      }

      return internship;
    }

    if (role === "internship_coordinator") {
      return internship;
    }

    throw new AppError(
      403,
      "You are not authorized to access this evaluation.",
    );
  }

  /**
   * Retrieves an evaluation record by ID.
   */
  async getEvaluationById(
    evaluationId: string,
    userId: string,
    role: EvaluationAccessRole,
  ): Promise<EvaluationRecord> {
    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("id", evaluationId)
      .maybeSingle();

    if (error) {
      console.error("GET EVALUATION FAILED:", error);

      throw new AppError(500, "Failed to retrieve evaluation.");
    }

    if (!data) {
      throw new AppError(404, "Evaluation not found.");
    }

    const evaluation = data as EvaluationRecord;

    await this.verifyEvaluationAccess(evaluation, userId, role);

    return evaluation;
  }

  /**
   * Creates an HTE Supervisor evaluation for an
   * assigned internship.
   */
  async createEvaluation(
    userId: string,
    input: CreateEvaluationInput,
  ): Promise<EvaluationRecord> {
    await this.verifyHTESupervisorAssignment(input.internship_id, userId);

    const { data: existingEvaluation, error: existingError } = await this.clients.supabaseAdmin
      .from("evaluations")
      .select("id, status")
      .eq("internship_id", input.internship_id)
      .eq("evaluator_id", userId)
      .eq("evaluation_type", "hte_supervisor")
      .maybeSingle();

    if (existingError) {
      console.error("CHECK EXISTING EVALUATION FAILED:", existingError);

      throw new AppError(500, "Failed to check existing evaluation.");
    }

    if (existingEvaluation) {
      throw new AppError(
        409,
        "An HTE Supervisor evaluation already exists for this internship.",
      );
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .insert({
        internship_id: input.internship_id,
        evaluator_id: userId,
        evaluation_type: "hte_supervisor",
        responses: input.responses ?? {},
        comments: input.comments ?? null,
        status: "draft",
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("CREATE EVALUATION FAILED:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });

      throw new AppError(500, "Failed to create evaluation.");
    }

    return data as EvaluationRecord;
  }

  /**
   * Retrieves all evaluations for an internship.
   */
  async getEvaluationsByInternship(
    internshipId: string,
    userId: string,
    role: EvaluationAccessRole,
  ): Promise<EvaluationRecord[]> {
    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("internship_id", internshipId)
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error("GET EVALUATIONS BY INTERNSHIP FAILED:", error);

      throw new AppError(500, "Failed to retrieve evaluations.");
    }

    const evaluations = (data ?? []) as EvaluationRecord[];

    for (const evaluation of evaluations) {
      await this.verifyEvaluationAccess(evaluation, userId, role);
    }

    return evaluations;
  }

  /**
   * Retrieves all evaluations assigned to an HTE Supervisor.
   */
  async getMyEvaluations(userId: string): Promise<EvaluationRecord[]> {
    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .select(
        `
        *,
        internships!inner (
          hte_profiles!inner (
            supervisor_id
          )
        )
        `,
      )
      .eq("internships.hte_profiles.supervisor_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("GET MY EVALUATIONS FAILED:", error);

      throw new AppError(500, "Failed to retrieve evaluations.");
    }

    return (data ?? []).map(
      (
        evaluation: EvaluationRecord & {
          internships?: unknown;
        },
      ) => {
        const { internships: _internship, ...record } = evaluation;

        return record;
      },
    ) as EvaluationRecord[];
  }

  /**
   * Updates an HTE Supervisor's own draft evaluation.
   */
  async updateEvaluation(
    evaluationId: string,
    userId: string,
    input: UpdateEvaluationInput,
  ): Promise<EvaluationRecord> {
    const evaluation = await this.getEvaluationById(
      evaluationId,
      userId,
      "hte_supervisor",
    );

    if (evaluation.status !== "draft") {
      throw new AppError(400, "Only draft evaluations can be updated.");
    }

    const updateData: {
      responses?: EvaluationResponses;
      comments?: string | null;
    } = {};

    if (input.responses !== undefined) {
      updateData.responses = input.responses;
    }

    if (input.comments !== undefined) {
      updateData.comments = input.comments;
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .update(updateData)
      .eq("id", evaluationId)
      .eq("evaluator_id", userId)
      .eq("status", "draft")
      .select("*")
      .single();

    if (error || !data) {
      console.error("UPDATE EVALUATION FAILED:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });

      throw new AppError(500, "Failed to update evaluation.");
    }

    return data as EvaluationRecord;
  }

  /**
   * Submits an HTE Supervisor evaluation.
   */
  async submitEvaluation(
    evaluationId: string,
    userId: string,
  ): Promise<EvaluationRecord> {
    const evaluation = await this.getEvaluationById(
      evaluationId,
      userId,
      "hte_supervisor",
    );

    if (evaluation.status !== "draft") {
      throw new AppError(400, "Only draft evaluations can be submitted.");
    }

    if (
      !evaluation.responses ||
      Object.keys(evaluation.responses).length === 0
    ) {
      throw new AppError(
        400,
        "Evaluation responses are required before submission.",
      );
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .update({
        status: "submitted",
        submitted_at: new Date().toISOString(),
      })
      .eq("id", evaluationId)
      .eq("evaluator_id", userId)
      .eq("status", "draft")
      .select("*")
      .single();

    if (error || !data) {
      console.error("SUBMIT EVALUATION FAILED:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });

      throw new AppError(500, "Failed to submit evaluation.");
    }

    return data as EvaluationRecord;
  }
}
