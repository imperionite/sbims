import { supabaseAdmin } from "../../lib/supabase.ts";
import { AppError } from "../../errors/app-error.ts";

import type {
  AttendanceRecord,
  CreateAttendanceInput,
  UpdateAttendanceRequest,
} from "./attendance.types.ts";

function parseTimeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);

  return hours * 60 + minutes;
}

function calculateRenderedHours(timeIn: string, timeOut: string): number {
  const start = parseTimeToMinutes(timeIn);
  const end = parseTimeToMinutes(timeOut);

  const elapsedMinutes = end - start;

  if (elapsedMinutes <= 0) {
    throw new AppError(400, "Time-out must be later than time-in.");
  }

  // Standard one-hour meal break.
  const breakMinutes = 60;

  const renderedMinutes = elapsedMinutes - breakMinutes;

  if (renderedMinutes <= 0) {
    throw new AppError(
      400,
      "Attendance duration is too short for the standard one-hour break.",
    );
  }

  return renderedMinutes / 60;
}

class AttendanceService {
  /**
   * POST /attendance
   *
   * Student creates attendance for their own
   * active internship.
   */
  async createAttendance(
    userId: string,
    input: CreateAttendanceInput,
  ): Promise<AttendanceRecord> {
    const { internship_id, attendance_date, time_in, time_out } = input;

    // Validate time range before touching the database.
    calculateRenderedHours(time_in, time_out);

    // Verify that the internship belongs to the authenticated student
    // and is currently active.
    const { data: internship, error: internshipError } = await supabaseAdmin
      .from("internships")
      .select("id, student_id, status")
      .eq("id", internship_id)
      .single();

    if (internshipError || !internship) {
      throw new AppError(404, "Internship not found.");
    }

    if (internship.student_id !== userId) {
      throw new AppError(
        403,
        "You can only record attendance for your own internship.",
      );
    }

    if (internship.status !== "active") {
      throw new AppError(
        400,
        "Attendance can only be recorded for an active internship.",
      );
    }

    // Enforce one attendance record per internship per day.
    const { data: existingAttendance, error: existingError } = await supabaseAdmin
      .from("attendance_records")
      .select("id")
      .eq("internship_id", internship_id)
      .eq("attendance_date", attendance_date)
      .maybeSingle();

    if (existingError) {
      console.error("CHECK EXISTING ATTENDANCE FAILED:", existingError);

      throw new AppError(500, "Failed to check existing attendance.");
    }

    if (existingAttendance) {
      throw new AppError(409, "Attendance for this date already exists.");
    }

    // Create the attendance record.
    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .insert({
        internship_id,
        attendance_date,
        time_in,
        time_out,
        validation_status: "pending",
      })
      .select("*")
      .single();

    // Detailed diagnostic logging.
    if (error || !data) {
      console.error("CREATE ATTENDANCE SUPABASE ERROR:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
      });

      throw new AppError(500, "Failed to create attendance record.");
    }

    return data as AttendanceRecord;
  }

  /**
   * GET /attendance/:id
   *
   * Retrieves a single attendance record.
   */
  async getAttendanceById(attendanceId: string): Promise<AttendanceRecord> {
    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .select("*")
      .eq("id", attendanceId)
      .single();

    if (error || !data) {
      throw new AppError(404, "Attendance record not found.");
    }

    return data as AttendanceRecord;
  }

  /**
   * GET /attendance/me
   *
   * Student retrieves their own attendance.
   */
  async getMyAttendance(userId: string): Promise<AttendanceRecord[]> {
    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .select(
        `
        *,
        internships!inner (
          student_id
        )
        `,
      )
      .eq("internships.student_id", userId)
      .order("attendance_date", {
        ascending: true,
      });

    if (error) {
      console.error("GET MY ATTENDANCE FAILED:", error);

      throw new AppError(500, "Failed to retrieve attendance records.");
    }

    return (data ?? []).map((record) => {
      const { internships: _, ...attendance } = record;

      return attendance as AttendanceRecord;
    });
  }

  /**
   * GET /attendance/internship/:internshipId
   *
   * Retrieves all attendance records for an internship.
   */
  async getAttendanceByInternship(
    internshipId: string,
  ): Promise<AttendanceRecord[]> {
    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .select("*")
      .eq("internship_id", internshipId)
      .order("attendance_date", {
        ascending: true,
      });

    if (error) {
      console.error("GET ATTENDANCE BY INTERNSHIP FAILED:", error);

      throw new AppError(500, "Failed to retrieve attendance records.");
    }

    return (data ?? []) as AttendanceRecord[];
  }

  /**
   * PATCH /attendance/:id/validation
   *
   * Internship coordinator validates or rejects
   * a pending attendance record.
   */
  async validateAttendance(
    attendanceId: string,
    coordinatorId: string,
    status: "validated" | "rejected",
  ): Promise<AttendanceRecord> {
    // Make sure the record exists.
    const attendance = await this.getAttendanceById(attendanceId);

    if (attendance.validation_status !== "pending") {
      throw new AppError(
        400,
        "Only pending attendance records can be validated.",
      );
    }

    // Verify that the authenticated validator is
    // an active internship coordinator.
    const { data: coordinator, error: coordinatorError } = await supabaseAdmin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", coordinatorId)
      .single();

    if (
      coordinatorError ||
      !coordinator ||
      coordinator.role !== "internship_coordinator" ||
      !coordinator.is_active
    ) {
      throw new AppError(
        403,
        "Only an active internship coordinator can validate attendance.",
      );
    }

    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .update({
        validation_status: status,
        validated_by: coordinatorId,
        validated_at: new Date().toISOString(),
      })
      .eq("id", attendanceId)
      .select("*")
      .single();

    if (error || !data) {
      console.error("VALIDATE ATTENDANCE FAILED:", error);

      throw new AppError(500, "Failed to validate attendance.");
    }

    return data as AttendanceRecord;
  }

  /**
   * GET /attendance/internship/:internshipId/rendered-hours
   *
   * Calculates total validated rendered hours.
   */
  async getRenderedHours(internshipId: string): Promise<number> {
    const records = await this.getAttendanceByInternship(internshipId);

    return records
      .filter((record) => record.validation_status === "validated")
      .reduce((total, record) => {
        return total + calculateRenderedHours(record.time_in, record.time_out);
      }, 0);
  }

  /**
   * PATCH /attendance/:id
   *
   * Student may update their own attendance
   * while it is still pending.
   */
  async updateAttendance(
    attendanceId: string,
    userId: string,
    input: UpdateAttendanceRequest,
  ): Promise<AttendanceRecord> {
    const attendance = await this.getAttendanceById(attendanceId);

    if (attendance.validation_status !== "pending") {
      throw new AppError(
        400,
        "Only pending attendance records can be updated.",
      );
    }

    // Verify that the attendance belongs to the
    // authenticated student's internship.
    const { data: internship, error: internshipError } = await supabaseAdmin
      .from("internships")
      .select("id, student_id, status")
      .eq("id", attendance.internship_id)
      .single();

    if (internshipError || !internship) {
      throw new AppError(404, "Internship not found.");
    }

    if (internship.student_id !== userId) {
      throw new AppError(403, "You can only update your own attendance.");
    }

    if (internship.status !== "active") {
      throw new AppError(
        400,
        "Attendance can only be updated for an active internship.",
      );
    }

    const attendanceDate = input.attendance_date ?? attendance.attendance_date;

    const timeIn = input.time_in ?? attendance.time_in;

    const timeOut = input.time_out ?? attendance.time_out;

    // Validate the resulting time range.
    calculateRenderedHours(timeIn, timeOut);

    // Prevent changing the date to one that already
    // has another attendance record.
    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from("attendance_records")
      .select("id")
      .eq("internship_id", attendance.internship_id)
      .eq("attendance_date", attendanceDate)
      .neq("id", attendanceId)
      .maybeSingle();

    if (duplicateError) {
      console.error("CHECK DUPLICATE ATTENDANCE FAILED:", duplicateError);

      throw new AppError(500, "Failed to check existing attendance.");
    }

    if (duplicate) {
      throw new AppError(409, "Attendance for this date already exists.");
    }

    const { data, error } = await supabaseAdmin
      .from("attendance_records")
      .update({
        attendance_date: attendanceDate,
        time_in: timeIn,
        time_out: timeOut,
      })
      .eq("id", attendanceId)
      .select("*")
      .single();

    if (error || !data) {
      console.error("UPDATE ATTENDANCE FAILED:", error);

      throw new AppError(500, "Failed to update attendance.");
    }

    return data as AttendanceRecord;
  }
}

export const attendanceService = new AttendanceService();

export { calculateRenderedHours };
