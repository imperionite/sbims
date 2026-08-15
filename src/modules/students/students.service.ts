import type { SupabaseClients } from "../../lib/supabase.ts";
import { AppError } from "../../errors/app-error.ts";

import type {
  CreateStudentProfileRequest,
  UpdateMyStudentProfileRequest,
  UpdateStudentProfileRequest,
} from "./students.types.ts";

const STUDENT_SELECT = `
  id,
  student_number,
  program,
  year_level,
  section,
  contact_number,
  address,
  emergency_contact_name,
  emergency_contact_number,
  internship_status,
  created_at,
  updated_at
`;

export class StudentService {
  constructor(private readonly clients: SupabaseClients) {}
  async listStudents() {
    const { data, error } = await this.clients.supabaseAdmin
      .from("student_profiles")
      .select(STUDENT_SELECT)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new AppError(500, "Unable to retrieve student profiles.");
    }

    return data;
  }

  async getStudent(id: string) {
    const { data, error } = await this.clients.supabaseAdmin
      .from("student_profiles")
      .select(STUDENT_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Unable to retrieve student profile.");
    }

    if (!data) {
      throw new AppError(404, "Student profile not found.");
    }

    return data;
  }

  async getMyStudentProfile(userId: string) {
    return await this.getStudent(userId);
  }

  /**
   * Creates a student profile for an existing user.
   *
   * The supplied userId must:
   * - exist in profiles
   * - have role "student"
   * - be active
   */
  async createStudent(request: CreateStudentProfileRequest) {
    const { data: profile, error: profileError } = await this.clients.supabaseAdmin
      .from("profiles")
      .select("id, role, is_active")
      .eq("id", request.userId)
      .maybeSingle();

    if (profileError) {
      throw new AppError(500, "Unable to validate student user.");
    }

    if (!profile) {
      throw new AppError(404, "Student user not found.");
    }

    if (profile.role !== "student") {
      throw new AppError(
        400,
        "The selected user does not have the student role.",
      );
    }

    if (!profile.is_active) {
      throw new AppError(400, "The selected student account is inactive.");
    }

    const { data: existingStudent, error: existingError } = await this.clients.supabaseAdmin
      .from("student_profiles")
      .select("id")
      .eq("id", request.userId)
      .maybeSingle();

    if (existingError) {
      throw new AppError(500, "Unable to check existing student profile.");
    }

    if (existingStudent) {
      throw new AppError(
        409,
        "A student profile already exists for this user.",
      );
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("student_profiles")
      .insert({
        id: request.userId,
        student_number: request.studentNumber,
        program: request.program,
        year_level: request.yearLevel,
        section: request.section ?? null,
        contact_number: request.contactNumber ?? null,
        address: request.address ?? null,
        emergency_contact_name: request.emergencyContactName ?? null,
        emergency_contact_number: request.emergencyContactNumber ?? null,
      })
      .select(STUDENT_SELECT)
      .single();

    if (error || !data) {
      throw new AppError(
        400,
        error?.message ?? "Unable to create student profile.",
      );
    }

    return data;
  }

  async updateStudent(id: string, request: UpdateStudentProfileRequest) {
    const updateData = {
      ...(request.studentNumber !== undefined && {
        student_number: request.studentNumber,
      }),

      ...(request.program !== undefined && {
        program: request.program,
      }),

      ...(request.yearLevel !== undefined && {
        year_level: request.yearLevel,
      }),

      ...(request.section !== undefined && {
        section: request.section,
      }),

      ...(request.contactNumber !== undefined && {
        contact_number: request.contactNumber,
      }),

      ...(request.address !== undefined && {
        address: request.address,
      }),

      ...(request.emergencyContactName !== undefined && {
        emergency_contact_name: request.emergencyContactName,
      }),

      ...(request.emergencyContactNumber !== undefined && {
        emergency_contact_number: request.emergencyContactNumber,
      }),

      ...(request.internshipStatus !== undefined && {
        internship_status: request.internshipStatus,
      }),
    };

    if (Object.keys(updateData).length === 0) {
      throw new AppError(
        400,
        "At least one student profile field is required.",
      );
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("student_profiles")
      .update(updateData)
      .eq("id", id)
      .select(STUDENT_SELECT)
      .maybeSingle();

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data) {
      throw new AppError(404, "Student profile not found.");
    }

    return data;
  }

  async updateMyStudentProfile(
    userId: string,
    request: UpdateMyStudentProfileRequest,
  ) {
    const updateData = {
      ...(request.contactNumber !== undefined && {
        contact_number: request.contactNumber,
      }),

      ...(request.address !== undefined && {
        address: request.address,
      }),

      ...(request.emergencyContactName !== undefined && {
        emergency_contact_name: request.emergencyContactName,
      }),

      ...(request.emergencyContactNumber !== undefined && {
        emergency_contact_number: request.emergencyContactNumber,
      }),
    };

    if (Object.keys(updateData).length === 0) {
      throw new AppError(
        400,
        "At least one student profile field is required.",
      );
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("student_profiles")
      .update(updateData)
      .eq("id", userId)
      .select(STUDENT_SELECT)
      .maybeSingle();

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data) {
      throw new AppError(404, "Student profile not found.");
    }

    return data;
  }
}
