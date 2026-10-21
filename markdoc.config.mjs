import { defineMarkdocConfig, component } from "@astrojs/markdoc/config";

// The tags for the text design, as on the Parques site:
// {% nota %}, {% figura %}, {% galeria %}, plus {% ref %} and {% fuentes %}
// for numbered sources.
export default defineMarkdocConfig({
  tags: {
    nota: { render: component("./src/components/texto/Nota.astro") },
    figura: {
      render: component("./src/components/texto/Figura.astro"),
      selfClosing: true,
      attributes: {
        src: { type: String, required: true },
        alt: { type: String, default: "" },
        pie: { type: String },
        ancho: { type: String, default: "columna", matches: ["columna", "completo", "margen"] },
      },
    },
    galeria: {
      render: component("./src/components/texto/Galeria.astro"),
      attributes: { ancho: { type: String, default: "completo", matches: ["columna", "completo"] } },
    },
    ref: {
      render: component("./src/components/texto/Ref.astro"),
      selfClosing: true,
      attributes: { n: { type: Number, required: true } },
    },
    fuentes: { render: component("./src/components/texto/Fuentes.astro") },
  },
});
