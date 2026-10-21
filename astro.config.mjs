import { defineConfig } from "astro/config";
import markdoc from "@astrojs/markdoc";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  site: "https://mpr-studio.github.io",
  trailingSlash: "always",
  build: { format: "directory" },
  integrations: [markdoc()],
  vite: { plugins: [tailwindcss()] },
});
