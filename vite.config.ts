import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "CLAW_CHAOS_");

  return {
    base:
      env.CLAW_CHAOS_BASE_PATH ??
      "/Claw-Chaos/",
    resolve: {
      alias:
        mode === "test"
          ? []
          : [
              {
                find: "@dimforge/rapier3d-compat",
                replacement: "@dimforge/rapier3d/rapier.js",
              },
            ],
    },
  };
});
