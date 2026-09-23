import { z } from "zod";

import { EVALUATION_CRITERIA } from "./evaluations.types.ts";

const evaluationScoreSchema = z.number().int().min(1).max(5);

const evaluationResponseFields = Object.fromEntries(
  EVALUATION_CRITERIA.map((criterion) => [
    criterion,
    evaluationScoreSchema.optional(),
  ]),
);

/**
 * Evaluation responses use a fixed set of eight approved criteria.
 * Drafts may contain no responses or only a partially completed set.
 * Final submission validates that all eight criteria are present.
 */
export const evaluationResponsesSchema = z
  .object(evaluationResponseFields)
  .strict();

export const createEvaluationSchema = z.object({
  internship_id: z.string().uuid(),

  evaluation_type: z
    .enum(["hte_supervisor", "faculty_adviser"])
    .optional()
    .default("hte_supervisor"),

  responses: evaluationResponsesSchema.optional().default({}),

  comments: z
    .string()
    .trim()
    .max(2000, "Comments must not exceed 2000 characters.")
    .nullable()
    .optional(),
});

export const updateEvaluationSchema = z
  .object({
    responses: evaluationResponsesSchema.optional(),

    comments: z
      .string()
      .trim()
      .max(2000, "Comments must not exceed 2000 characters.")
      .nullable()
      .optional(),
  })
  .refine(
    (data) => data.responses !== undefined || data.comments !== undefined,
    {
      message: "At least one evaluation field must be provided.",
    },
  );

export type CreateEvaluationRequest = z.infer<typeof createEvaluationSchema>;

export type UpdateEvaluationRequest = z.infer<typeof updateEvaluationSchema>;
