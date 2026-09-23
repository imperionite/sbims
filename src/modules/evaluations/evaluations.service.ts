import type { SupabaseClients } from "../../lib/supabase.ts";
import { AppError } from "../../errors/app-error.ts";

import { InternshipEligibilityService } from "../internships/internship-eligibility.service.ts";

import type {
  CreateEvaluationInput,
  EvaluationRecord,
  EvaluationResponses,
  EvaluationType,
  UpdateEvaluationInput,
} from "./evaluations.types.ts";

import { EVALUATION_CRITERIA } from "./evaluations.types.ts";

type EvaluationManagerRole =
  | "hte_supervisor"
  | "faculty_adviser"
  | "student";

type EvaluationAccessRole =
  | "administrator"
  | "internship_coordinator"
  | "faculty_adviser"
  | "hte_supervisor"
  | "student";

interface InternshipAuthorizationRecord {
  id: string;
  student_id: string;
  hte_id: string;
  faculty_adviser_id: string | null;
  status: string;
  hte_profiles:
    | Array<{
      supervisor_id: string | null;
    }>
    | { supervisor_id: string | null }
    | null;
}

export class EvaluationService {
  private readonly eligibilityService: InternshipEligibilityService;

  constructor(private readonly clients: SupabaseClients) {
    this.eligibilityService = new InternshipEligibilityService(clients);
  }

  /**
   * Retrieves the internship used for assignment and resource authorization.
   */
  private async getInternship(
    internshipId: string,
  ): Promise<InternshipAuthorizationRecord> {
    const { data, error } = await this.clients.supabaseAdmin
      .from("internships")
      .select(
        `
        id,
        student_id,
        hte_id,
        faculty_adviser_id,
        status,
        hte_profiles!inner (
          supervisor_id
        )
        `,
      )
      .eq("id", internshipId)
      .maybeSingle();

    if (error) {
      console.error("GET INTERNSHIP FOR EVALUATION FAILED:", error);
      throw new AppError(500, "Failed to verify internship access.");
    }

    if (!data) {
      throw new AppError(404, "Internship not found.");
    }

    return data as unknown as InternshipAuthorizationRecord;
  }

  /**
   * Verifies that the authenticated evaluator is assigned to the
   * internship for the requested evaluation type.
   */
  private async verifyEvaluatorAssignment(
    internshipId: string,
    userId: string,
    evaluationType: EvaluationType,
  ): Promise<InternshipAuthorizationRecord> {
    const internship = await this.getInternship(internshipId);

    if (evaluationType === "hte_supervisor") {
      const supervisorId = Array.isArray(internship.hte_profiles)
        ? (internship.hte_profiles[0]?.supervisor_id ?? null)
        : (internship.hte_profiles?.supervisor_id ?? null);

      if (!supervisorId || supervisorId !== userId) {
        throw new AppError(
          403,
          "You can only manage HTE evaluations for internships assigned to your HTE.",
        );
      }

      return internship;
    }

    if (evaluationType === "faculty_adviser") {
      if (internship.faculty_adviser_id !== userId) {
        throw new AppError(
          403,
          "You can only manage faculty evaluations for internships assigned to you.",
        );
      }

      return internship;
    }

    throw new AppError(
      403,
      "You are not authorized to manage this evaluation type.",
    );
  }

  /**
   * Verifies that the evaluator role matches the evaluation type.
   */
  private verifyEvaluationTypeForRole(
    role: EvaluationManagerRole,
    evaluationType: EvaluationType,
  ): void {
    if (role === "hte_supervisor" && evaluationType !== "hte_supervisor") {
      throw new AppError(
        403,
        "HTE Supervisors can only manage HTE Supervisor evaluations.",
      );
    }

    if (role === "faculty_adviser" && evaluationType !== "faculty_adviser") {
      throw new AppError(
        403,
        "Faculty Advisers can only manage Faculty Adviser evaluations.",
      );
    }
  }

  /**
   * Checks the final internship eligibility rule.
   *
   * This rule is intentionally used at final submission rather than
   * draft creation. It remains the single source of truth for whether
   * the internship is ready for final evaluation.
   */
  private async requireFinalEligibility(internshipId: string): Promise<void> {
    const eligibility = await this.eligibilityService.checkFinalEligibility(internshipId);

    if (eligibility.eligible) {
      return;
    }

    switch (eligibility.reason) {
      case "internship_not_found":
        throw new AppError(404, "Internship not found.");

      case "internship_period_not_ended":
        throw new AppError(400, "The internship period has not ended yet.");

      case "required_hours_not_set":
        throw new AppError(400, "Required internship hours have not been set.");

      case "required_hours_not_met":
        throw new AppError(
          400,
          "The required validated rendered hours have not been met.",
        );

      default:
        throw new AppError(
          400,
          "The internship is not eligible for evaluation.",
        );
    }
  }

  /**
   * Verifies access to an internship independently from evaluation state.
   * This avoids using a fake evaluation record when an internship has
   * no evaluations yet.
   */
  private async authorizeInternshipAccess(
    internshipId: string,
    userId: string,
    role: EvaluationAccessRole,
  ): Promise<InternshipAuthorizationRecord> {
    const internship = await this.getInternship(internshipId);

    if (role === "administrator" || role === "internship_coordinator") {
      return internship;
    }

    if (role === "student") {
      if (internship.student_id !== userId) {
        throw new AppError(
          403,
          "You can only access evaluations for your own internship.",
        );
      }

      return internship;
    }

    if (role === "hte_supervisor") {
      const supervisorId = Array.isArray(internship.hte_profiles)
        ? (internship.hte_profiles[0]?.supervisor_id ?? null)
        : (internship.hte_profiles?.supervisor_id ?? null);

      if (!supervisorId || supervisorId !== userId) {
        throw new AppError(
          403,
          "You can only access evaluations for internships assigned to your HTE.",
        );
      }

      return internship;
    }

    if (role === "faculty_adviser") {
      if (internship.faculty_adviser_id !== userId) {
        throw new AppError(
          403,
          "You can only access evaluations for internships assigned to you.",
        );
      }

      return internship;
    }

    throw new AppError(
      403,
      "You are not authorized to access this internship.",
    );
  }

  /**
   * Verifies access to a particular evaluation.
   *
   * Evaluators may view evaluations belonging to internships assigned to
   * them. Students may view only submitted evaluations belonging to their
   * own internship.
   */
  private async verifyEvaluationAccess(
    evaluation: EvaluationRecord,
    userId: string,
    role: EvaluationAccessRole,
  ): Promise<InternshipAuthorizationRecord> {
    const internship = await this.authorizeInternshipAccess(
      evaluation.internship_id,
      userId,
      role,
    );

    if (role === "student" && evaluation.status !== "submitted") {
      throw new AppError(
        403,
        "Evaluation results are only available after submission.",
      );
    }

    return internship;
  }

  /**
   * Ensures that every approved evaluation criterion has a score before
   * an evaluation can become submitted.
   */
  private requireCompleteResponses(responses: EvaluationResponses): void {
    const missingCriteria = EVALUATION_CRITERIA.filter(
      (criterion) => responses[criterion] === undefined,
    );

    if (missingCriteria.length > 0) {
      throw new AppError(
        400,
        `All evaluation criteria must be answered before submission. Missing: ${
          missingCriteria.join(
            ", ",
          )
        }.`,
      );
    }
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
   * Creates a draft evaluation for an assigned internship.
   *
   * Final internship eligibility is intentionally NOT checked here.
   * This allows evaluators to prepare drafts before the internship
   * period ends or before required hours are fully satisfied.
   */
  async createEvaluation(
    userId: string,
    role: EvaluationManagerRole,
    input: CreateEvaluationInput,
  ): Promise<EvaluationRecord> {
    const evaluationType = input.evaluation_type ?? "hte_supervisor";

    this.verifyEvaluationTypeForRole(role, evaluationType);

    await this.verifyEvaluatorAssignment(
      input.internship_id,
      userId,
      evaluationType,
    );

    const { data: existingEvaluation, error: existingError } = await this.clients.supabaseAdmin
      .from("evaluations")
      .select("id, status")
      .eq("internship_id", input.internship_id)
      .eq("evaluator_id", userId)
      .eq("evaluation_type", evaluationType)
      .maybeSingle();

    if (existingError) {
      console.error("CHECK EXISTING EVALUATION FAILED:", existingError);
      throw new AppError(500, "Failed to check existing evaluation.");
    }

    if (existingEvaluation) {
      const evaluationLabel = evaluationType === "hte_supervisor"
        ? "HTE Supervisor"
        : "Faculty Adviser";

      throw new AppError(
        409,
        `A ${evaluationLabel} evaluation already exists for this internship.`,
      );
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .insert({
        internship_id: input.internship_id,
        evaluator_id: userId,
        evaluation_type: evaluationType,
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
   *
   * Student requests are restricted at query level to submitted records.
   * Other authorized roles can see both draft and submitted records.
   */
  async getEvaluationsByInternship(
    internshipId: string,
    userId: string,
    role: EvaluationAccessRole,
  ): Promise<EvaluationRecord[]> {
    await this.authorizeInternshipAccess(internshipId, userId, role);

    let query = this.clients.supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("internship_id", internshipId)
      .order("created_at", {
        ascending: true,
      });

    if (role === "student") {
      query = query.eq("status", "submitted");
    }

    const { data, error } = await query;

    if (error) {
      console.error("GET EVALUATIONS BY INTERNSHIP FAILED:", error);

      throw new AppError(500, "Failed to retrieve evaluations.");
    }

    return this.enrichEvaluationRecords((data ?? []) as EvaluationRecord[]);
  }
  /**
   * Retrieves evaluations actually created by the current evaluator.
   *
   * The endpoint contract is intentionally ownership-based:
   * evaluator_id must equal the authenticated user ID.
   */
  async getMyEvaluations(
    userId: string,
    role: EvaluationManagerRole,
  ): Promise<EvaluationRecord[]> {
    if (role === "student") {
      const { data: internships, error: internshipError } = await this.clients.supabaseAdmin
        .from("internships")
        .select("id")
        .eq("student_id", userId);

      if (internshipError) {
        console.error(
          "GET STUDENT EVALUATIONS - INTERNSHIP LOOKUP FAILED:",
          internshipError,
        );

        throw new AppError(
          500,
          "Failed to retrieve student internships.",
        );
      }

      const internshipIds = [
        ...new Set(
          (internships ?? [])
            .map((internship) => internship.id)
            .filter(Boolean),
        ),
      ];

      if (internshipIds.length === 0) {
        return [];
      }

      const { data, error } = await this.clients.supabaseAdmin
        .from("evaluations")
        .select("*")
        .in("internship_id", internshipIds)
        .eq("status", "submitted")
        .order("submitted_at", {
          ascending: false,
        });

      if (error) {
        console.error(
          "GET STUDENT EVALUATIONS FAILED:",
          error,
        );

        throw new AppError(
          500,
          "Failed to retrieve your evaluations.",
        );
      }

      return this.enrichEvaluationRecords(
        (data ?? []) as EvaluationRecord[],
      );
    }

    const evaluationType: EvaluationType = role === "hte_supervisor"
      ? "hte_supervisor"
      : "faculty_adviser";

    const { data, error } = await this.clients.supabaseAdmin
      .from("evaluations")
      .select("*")
      .eq("evaluator_id", userId)
      .eq("evaluation_type", evaluationType)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error("GET MY EVALUATIONS FAILED:", error);

      throw new AppError(
        500,
        "Failed to retrieve evaluations.",
      );
    }

    return this.enrichEvaluationRecords(
      (data ?? []) as EvaluationRecord[],
    );
  }

  /**
   * Updates the current evaluator's own draft evaluation.
   */
  async updateEvaluation(
    evaluationId: string,
    userId: string,
    role: EvaluationManagerRole,
    input: UpdateEvaluationInput,
  ): Promise<EvaluationRecord> {
    const evaluation = await this.getEvaluationById(evaluationId, userId, role);

    this.verifyEvaluationTypeForRole(role, evaluation.evaluation_type);

    if (evaluation.evaluator_id !== userId) {
      throw new AppError(403, "You can only update your own evaluation.");
    }

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
   * Submits the current evaluator's draft evaluation.
   *
   * Final internship eligibility is checked here so a draft cannot
   * bypass the business rule if internship state changes after draft
   * creation.
   */
  async submitEvaluation(
    evaluationId: string,
    userId: string,
    role: EvaluationManagerRole,
  ): Promise<EvaluationRecord> {
    const evaluation = await this.getEvaluationById(evaluationId, userId, role);

    this.verifyEvaluationTypeForRole(role, evaluation.evaluation_type);

    if (evaluation.evaluator_id !== userId) {
      throw new AppError(403, "You can only submit your own evaluation.");
    }

    if (evaluation.status !== "draft") {
      throw new AppError(400, "Only draft evaluations can be submitted.");
    }

    this.requireCompleteResponses(evaluation.responses);

    await this.requireFinalEligibility(evaluation.internship_id);

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

  private buildFullName(
    profile: {
      first_name?: string | null;
      middle_name?: string | null;
      last_name?: string | null;
      suffix?: string | null;
    } | null,
  ): string {
    if (!profile) {
      return "";
    }

    return [
      profile.first_name,
      profile.middle_name,
      profile.last_name,
      profile.suffix,
    ]
      .filter((part): part is string => Boolean(part?.trim()))
      .join(" ");
  }

  private async enrichEvaluationRecords(
    evaluations: EvaluationRecord[],
  ): Promise<EvaluationRecord[]> {
    if (evaluations.length === 0) {
      return [];
    }

    const internshipIds = [
      ...new Set(
        evaluations
          .map((evaluation) => evaluation.internship_id)
          .filter(Boolean),
      ),
    ];

    if (internshipIds.length === 0) {
      return evaluations;
    }

    const { data: internships, error: internshipError } = await this.clients.supabaseAdmin
      .from("internships")
      .select(
        `
        id,
        student_id,
        faculty_adviser_id,
        hte_profiles (
          id,
          company_name,
          contact_person,
          contact_email,
          supervisor_id
        ),
        student_profiles (
          id,
          student_number,
          program,
          year_level,
          section,
          profiles (
            id,
            email,
            first_name,
            middle_name,
            last_name,
            suffix
          )
        )
      `,
      )
      .in("id", internshipIds);

    if (internshipError) {
      console.error(
        "ENRICH EVALUATIONS - INTERNSHIP LOOKUP FAILED:",
        internshipError,
      );

      throw new AppError(
        500,
        "Failed to retrieve evaluation internship information.",
      );
    }

    const internshipMap = new Map(
      (internships ?? []).map((internship) => [internship.id, internship]),
    );

    const profileIds = [
      ...new Set(
        [
          ...evaluations.map((evaluation) => evaluation.evaluator_id),
          ...(internships ?? []).map(
            (internship) => internship.faculty_adviser_id,
          ),
          ...(internships ?? []).flatMap((internship) => {
            const hteProfile = Array.isArray(internship.hte_profiles)
              ? (internship.hte_profiles[0] ?? null)
              : (internship.hte_profiles ?? null);

            return hteProfile?.supervisor_id ? [hteProfile.supervisor_id] : [];
          }),
        ].filter(Boolean),
      ),
    ];

    const { data: profiles, error: profileError } = profileIds.length > 0
      ? await this.clients.supabaseAdmin
        .from("profiles")
        .select(
          `
            id,
            email,
            first_name,
            middle_name,
            last_name,
            suffix
          `,
        )
        .in("id", profileIds)
      : { data: [], error: null };

    if (profileError) {
      console.error(
        "ENRICH EVALUATIONS - PROFILE LOOKUP FAILED:",
        profileError,
      );

      throw new AppError(
        500,
        "Failed to retrieve evaluation evaluator information.",
      );
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [profile.id, profile]),
    );

    return evaluations.map((evaluation) => {
      const internship = internshipMap.get(evaluation.internship_id);

      if (!internship) {
        return evaluation;
      }

      const student = Array.isArray(internship.student_profiles)
        ? (internship.student_profiles[0] ?? null)
        : (internship.student_profiles ?? null);

      const studentProfile = Array.isArray(student?.profiles)
        ? (student.profiles[0] ?? null)
        : (student?.profiles ?? null);

      const hteProfile = Array.isArray(internship.hte_profiles)
        ? (internship.hte_profiles[0] ?? null)
        : (internship.hte_profiles ?? null);

      const evaluatorProfile = profileMap.get(evaluation.evaluator_id);

      const facultyAdviserProfile = internship.faculty_adviser_id
        ? profileMap.get(internship.faculty_adviser_id)
        : null;

      const hteSupervisorId = hteProfile?.supervisor_id ?? null;

      const hteSupervisorProfile = hteSupervisorId ? profileMap.get(hteSupervisorId) : null;

      return {
        ...evaluation,

        student: student
          ? {
            id: student.id,
            student_number: student.student_number,
            email: studentProfile?.email ?? null,
            program: student.program,
            year_level: student.year_level,
            section: student.section ?? null,
            full_name: this.buildFullName(studentProfile) || "Unknown student",
          }
          : undefined,

        evaluator: evaluatorProfile
          ? {
            id: evaluatorProfile.id,
            email: evaluatorProfile.email ?? null,
            full_name: this.buildFullName(evaluatorProfile) || "Unknown evaluator",
          }
          : undefined,

        assignment: {
          hte: hteProfile
            ? {
              id: hteProfile.id,
              company_name: hteProfile.company_name,
              contact_person: hteProfile.contact_person,
              contact_email: hteProfile.contact_email ?? null,
            }
            : null,

          hte_supervisor: hteSupervisorProfile
            ? {
              id: hteSupervisorProfile.id,
              email: hteSupervisorProfile.email ?? null,
              full_name: this.buildFullName(hteSupervisorProfile) ||
                "Unknown HTE Supervisor",
            }
            : null,

          faculty_adviser: facultyAdviserProfile
            ? {
              id: facultyAdviserProfile.id,
              email: facultyAdviserProfile.email ?? null,
              full_name: this.buildFullName(facultyAdviserProfile) ||
                "Unknown Faculty Adviser",
            }
            : null,
        },
      };
    });
  }
}
