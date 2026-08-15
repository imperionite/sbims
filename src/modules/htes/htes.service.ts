import type { SupabaseClients } from "../../lib/supabase.ts";
import { AppError } from "../../errors/app-error.ts";

import type { CreateHTERequest, UpdateHTERequest, UpdateHTEStatusRequest } from "./htes.types.ts";

const HTE_SELECT = `
  id,
  company_name,
  address,
  contact_person,
  contact_email,
  contact_number,
  supervisor_id,
  is_active,
  created_at,
  updated_at
`;

export class HteService {
  constructor(private readonly clients: SupabaseClients) {}
  async listHtes() {
    const { data, error } = await this.clients.supabaseAdmin
      .from("hte_profiles")
      .select(HTE_SELECT)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      throw new AppError(500, "Unable to retrieve HTE profiles.");
    }

    return data;
  }

  async getHte(id: string) {
    const { data, error } = await this.clients.supabaseAdmin
      .from("hte_profiles")
      .select(HTE_SELECT)
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new AppError(500, "Unable to retrieve HTE profile.");
    }

    if (!data) {
      throw new AppError(404, "HTE profile not found.");
    }

    return data;
  }

  async createHte(request: CreateHTERequest) {
    const { data, error } = await this.clients.supabaseAdmin
      .from("hte_profiles")
      .insert({
        company_name: request.companyName,
        address: request.address,
        contact_person: request.contactPerson,
        contact_email: request.contactEmail ?? null,
        contact_number: request.contactNumber ?? null,
      })
      .select(HTE_SELECT)
      .single();

    if (error || !data) {
      throw new AppError(
        400,
        error?.message ?? "Unable to create HTE profile.",
      );
    }

    return data;
  }

  async updateHte(id: string, request: UpdateHTERequest) {
    const updateData = {
      ...(request.companyName !== undefined && {
        company_name: request.companyName,
      }),

      ...(request.address !== undefined && {
        address: request.address,
      }),

      ...(request.contactPerson !== undefined && {
        contact_person: request.contactPerson,
      }),

      ...(request.contactEmail !== undefined && {
        contact_email: request.contactEmail,
      }),

      ...(request.contactNumber !== undefined && {
        contact_number: request.contactNumber,
      }),
    };

    if (Object.keys(updateData).length === 0) {
      throw new AppError(400, "At least one HTE profile field is required.");
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("hte_profiles")
      .update(updateData)
      .eq("id", id)
      .select(HTE_SELECT)
      .maybeSingle();

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data) {
      throw new AppError(404, "HTE profile not found.");
    }

    return data;
  }

  async updateStatus(id: string, request: UpdateHTEStatusRequest) {
    const { data, error } = await this.clients.supabaseAdmin
      .from("hte_profiles")
      .update({
        is_active: request.isActive,
      })
      .eq("id", id)
      .select(HTE_SELECT)
      .maybeSingle();

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data) {
      throw new AppError(404, "HTE profile not found.");
    }

    return data;
  }

  async assignSupervisor(id: string, supervisorId: string | null) {
    if (supervisorId !== null) {
      const { data: supervisor, error: supervisorError } = await this.clients.supabaseAdmin
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", supervisorId)
        .maybeSingle();

      if (supervisorError) {
        throw new AppError(500, "Unable to verify the HTE supervisor.");
      }

      if (!supervisor) {
        throw new AppError(404, "HTE supervisor profile not found.");
      }

      if (supervisor.role !== "hte_supervisor") {
        throw new AppError(400, "The selected user is not an HTE supervisor.");
      }

      if (!supervisor.is_active) {
        throw new AppError(
          400,
          "The selected HTE supervisor account is inactive.",
        );
      }
    }

    const { data, error } = await this.clients.supabaseAdmin
      .from("hte_profiles")
      .update({
        supervisor_id: supervisorId,
      })
      .eq("id", id)
      .select(HTE_SELECT)
      .maybeSingle();

    if (error) {
      throw new AppError(400, error.message);
    }

    if (!data) {
      throw new AppError(404, "HTE profile not found.");
    }

    return data;
  }
}
