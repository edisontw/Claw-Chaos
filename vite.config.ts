import { defineConfig } from "vite";

export default defineConfig(({ mode }) => ({
  base: "/Claw-Chaos/",
  resolve: {
    alias:
      mode === "test"
        ? {}
        : {
            "@dimforge/rapier3d-compat":
              "@dimforge/rapier3d/rapier.js",
          },
  },
}));
