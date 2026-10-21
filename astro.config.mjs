import { defineConfig } from "astro/config";
import markdoc from "@astrojs/markdoc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://mpr-studio.github.io",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [markdoc()],
  // The broadcasts moved under /radio/ on 2026-10-21.
  redirects: {
    "/broadcasts": "/radio/",
    "/broadcasts/[slug]": "/radio/[slug]",
  },
  vite: { plugins: [tailwindcss()] },
});
