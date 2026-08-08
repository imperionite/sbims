export type InternshipStatus = "pending" | "active" | "completed";

export interface StudentProfile {
  id: string;

  student_number: string;

  program: string;

  year_level: number;

  section: string | null;

  contact_number: string | null;

  address: string | null;

  emergency_contact_name: string | null;

  emergency_contact_number: string | null;

  internship_status: InternshipStatus;

  created_at: string;

  updated_at: string;
}

export interface CreateStudentProfileRequest {
  userId: string;

  studentNumber: string;

  program: string;

  yearLevel: number;

  section?: string | null;

  contactNumber?: string | null;

  address?: string | null;

  emergencyContactName?: string | null;

  emergencyContactNumber?: string | null;
}

export interface UpdateStudentProfileRequest {
  studentNumber?: string;

  program?: string;

  yearLevel?: number;

  section?: string | null;

  contactNumber?: string | null;

  address?: string | null;

  emergencyContactName?: string | null;

  emergencyContactNumber?: string | null;

  internshipStatus?: InternshipStatus;
}

export interface UpdateMyStudentProfileRequest {
  contactNumber?: string | null;

  address?: string | null;

  emergencyContactName?: string | null;

  emergencyContactNumber?: string | null;
}
