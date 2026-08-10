export interface HTEProfile {
  id: string;

  company_name: string;
  address: string;
  contact_person: string;
  contact_email: string | null;
  contact_number: string | null;

  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface CreateHTERequest {
  companyName: string;
  address: string;
  contactPerson: string;
  contactEmail?: string | null;
  contactNumber?: string | null;
}

export interface UpdateHTERequest {
  companyName?: string;
  address?: string;
  contactPerson?: string;
  contactEmail?: string | null;
  contactNumber?: string | null;
}

export interface UpdateHTEStatusRequest {
  isActive: boolean;
}
