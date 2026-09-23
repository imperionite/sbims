export const EVALUATION_TYPES = ["hte_supervisor", "faculty_adviser"] as const;

export type EvaluationType = (typeof EVALUATION_TYPES)[number];

export const EVALUATION_CRITERIA = [
  "criterion_1",
  "criterion_2",
  "criterion_3",
  "criterion_4",
  "criterion_5",
  "criterion_6",
  "criterion_7",
  "criterion_8",
] as const;

export type EvaluationCriterion = (typeof EVALUATION_CRITERIA)[number];

export type EvaluationStatus = "draft" | "submitted";

export type EvaluationResponses = Partial<Record<EvaluationCriterion, number>>;

export interface EvaluationPerson {
  id: string;
  email: string | null;
  full_name: string;
}

export interface EvaluationStudentInfo {
  id: string;
  student_number: string;
  email: string | null;
  program: string;
  year_level: number;
  section: string | null;
  full_name: string;
}

export interface EvaluationHteInfo {
  id: string;
  company_name: string;
  contact_person: string;
  contact_email: string | null;
}

export interface EvaluationAssignmentInfo {
  hte: EvaluationHteInfo | null;
  hte_supervisor: EvaluationPerson | null;
  faculty_adviser: EvaluationPerson | null;
}

export interface EvaluationRecord {
  id: string;
  internship_id: string;
  evaluator_id: string;
  evaluation_type: EvaluationType;

  responses: EvaluationResponses;
  comments: string | null;

  status: EvaluationStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;

  /**
   * Read-only related information resolved from the internship.
   *
   * These fields are intentionally not stored in the evaluations table.
   */
  student?: EvaluationStudentInfo;
  evaluator?: EvaluationPerson;
  assignment?: EvaluationAssignmentInfo;
}

export interface CreateEvaluationInput {
  internship_id: string;
  evaluation_type?: EvaluationType;
  responses?: EvaluationResponses;
  comments?: string | null;
}

export interface UpdateEvaluationInput {
  responses?: EvaluationResponses;
  comments?: string | null;
}

export interface EvaluationSummary {
  id: string;
  internship_id: string;
  evaluator_id: string;
  evaluation_type: EvaluationType;
  status: EvaluationStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}
