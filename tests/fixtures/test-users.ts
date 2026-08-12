export const TEST_USERS = {
  admin: {
    email: "sbims-test-admin@maildrop.cc",
    password: "TestPassword2026!",
    firstName: "Test",
    lastName: "Administrator",
    role: "administrator",
  },

  student: {
    email: "sbims-test-student@maildrop.cc",
    password: "TestPassword2026!",
    firstName: "Test",
    lastName: "Student",
    role: "student",
  },

  coordinator: {
    email: "sbims-test-coordinator@maildrop.cc",
    password: "TestPassword2026!",
    firstName: "Test",
    lastName: "Internship Coordinator",
    role: "internship_coordinator",
  },

  firstLogin: {
    email: "sbims-test-first-login@maildrop.cc",
    password: "TestPassword2026!",
    newPassword: "NewTestPassword2026!",
    firstName: "Test",
    lastName: "FirstLogin",
    role: "student",
  },
} as const;
