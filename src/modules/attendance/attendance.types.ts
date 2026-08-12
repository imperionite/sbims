export type AttendanceValidationStatus = "pending" | "validated" | "rejected";

export interface AttendanceRecord {
  id: string;
  internship_id: string;
  attendance_date: string;
  time_in: string;
  time_out: string;
  validation_status: AttendanceValidationStatus;
  validated_by: string | null;
  validated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateAttendanceInput {
  internship_id: string;
  attendance_date: string;
  time_in: string;
  time_out: string;
}

export interface UpdateAttendanceRequest {
  attendance_date?: string;
  time_in?: string;
  time_out?: string;
}

export interface AttendanceValidationInput {
  validation_status: "validated" | "rejected";
}

export interface RenderedHours {
  totalHours: number;
}
