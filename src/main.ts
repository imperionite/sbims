import { createApp } from "./app.ts";
import { loadEnv } from "./config/env.ts";
import { getDenoEnv } from "./config/runtime.ts";

const env = loadEnv(getDenoEnv());

const app = createApp(env);

export default {
  fetch: app.fetch,
};
