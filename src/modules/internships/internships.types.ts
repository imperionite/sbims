export type InternshipStatus = "pending" | "active" | "completed";

export interface CreateInternshipRequest {
  studentId: string;
  hteId: string;
}

export interface UpdateInternshipRequest {
  hteId?: string;

  position?: string;

  startDate?: string;

  endDate?: string;
}

export interface ReviewInternshipRequest {
  status: Extract<InternshipStatus, "approved" | "rejected">;

  reviewRemarks?: string | null;
}
