import { Hono } from "hono";

import health from "../modules/health/health.routes.ts";
import auth from "../modules/auth/auth.routes.ts";
import users from "../modules/users/users.routes.ts";
import students from "../modules/students/students.routes.ts";
import htes from "../modules/htes/htes.routes.ts";
import internships from "../modules/internships/internships.routes.ts";
import attendance from "../modules/attendance/attendance.routes.ts";

const api = new Hono();

api.route("/health", health);

api.route("/auth", auth);

api.route("/users", users);

api.route("/students", students);

api.route("/htes", htes);

api.route("/internships", internships);

api.route("/attendance", attendance);

export default api;
