import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "/Claw-Chaos/",
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
}));
