export type InternshipStatus = "pending" | "active" | "completed";

export interface CreateInternshipRequest {
  studentId: string;
  hteId: string;
  requiredHours?: number | null;
}

export interface UpdateInternshipRequest {
  hteId?: string;

  requiredHours?: number | null;

  position?: string;

  startDate?: string;

  endDate?: string;
}

export interface ReviewInternshipRequest {
  status: Extract<InternshipStatus, "approved" | "rejected">;

  reviewRemarks?: string | null;
}

export interface UpdateFacultyAdviserRequest {
  facultyAdviserId: string | null;
}
