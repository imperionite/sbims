import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";

import { requireAuth } from "../auth/auth.middleware.ts";
import { requireRole } from "../auth/role.middleware.ts";

import { createHTESchema, updateHTESchema, updateHTEStatusSchema } from "./htes.schema.ts";

import { hteService } from "./htes.service.ts";

const htes = new Hono();

htes.use(
  "*",
  requireAuth,
  requireRole("administrator", "internship_coordinator"),
);

/**

* ---
* GET /htes
* ---
*
* Administrator and internship coordinator only.
  */
htes.get("/", async (c) => {
  const result = await hteService.listHtes();

  return c.json({
    success: true,
    data: result,
  });
});

/**

* ---
* GET /htes/:id
* ---
*
* Administrator and internship coordinator only.
  */
htes.get("/:id", async (c) => {
  const result = await hteService.getHte(c.req.param("id"));

  return c.json({
    success: true,
    data: result,
  });
});

/**

* ---
* POST /htes
* ---
*
* Administrator and internship coordinator may
* create HTE profiles.
  */
htes.post("/", zValidator("json", createHTESchema), async (c) => {
  const body = c.req.valid("json");

  const result = await hteService.createHte(body);

  return c.json(
    {
      success: true,
      data: result,
    },
    201,
  );
});

/**

* ---
* PATCH /htes/:id
* ---
*
* Administrator and internship coordinator may
* update HTE profile information.
  */
htes.patch("/:id", zValidator("json", updateHTESchema), async (c) => {
  const body = c.req.valid("json");

  const result = await hteService.updateHte(c.req.param("id"), body);

  return c.json({
    success: true,
    data: result,
  });
});

/**

* ---
* PATCH /htes/:id/status
* ---
*
* Administrator and internship coordinator may
* activate or deactivate an HTE profile.
  */
htes.patch(
  "/:id/status",
  zValidator("json", updateHTEStatusSchema),
  async (c) => {
    const body = c.req.valid("json");

    const result = await hteService.updateStatus(c.req.param("id"), body);

    return c.json({
      success: true,
      data: result,
    });
  },
);

export default htes;
