export const USER_ROLES = [
  "administrator",
  "internship_coordinator",
  "faculty_adviser",
  "student",
  "hte_supervisor",
] as const;

export type UserRole = typeof USER_ROLES[number];
