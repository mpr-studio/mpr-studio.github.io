import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://mpr-studio.github.io",
  trailingSlash: "always",
  build: { format: "directory" },
});
