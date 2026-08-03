export type AuthRole =
  | "administrator"
  | "internship_coordinator"
  | "faculty_adviser"
  | "student"
  | "hte_supervisor";

export interface AuthUser {
  id: string;

  email: string;

  firstName: string;

  middleName: string | null;

  lastName: string;

  suffix: string | null;

  role: AuthRole;

  mustChangePassword: boolean;
}

export interface LoginResponse {
  accessToken: string;

  refreshToken: string;

  requiresPasswordChange: boolean;

  user: AuthUser;
}

export interface Profile {
  id: string;

  email: string;

  first_name: string;

  middle_name: string | null;

  last_name: string;

  suffix: string | null;

  role: AuthRole;

  must_change_password: boolean;

  is_active: boolean;
}
