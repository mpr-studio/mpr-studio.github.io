import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One Markdown file per broadcast: the body is the description.
const broadcasts = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/content/broadcasts" }),
  schema: z.object({
    number: z.number(),
    theme: z.string(),
    date: z.coerce.date(),
    audio: z.string().url(),
    peaks: z.string(),
    duration: z.number(),  // seconds
    hosts: z.array(z.string()),
    guest: reference("guests").optional(),
    chapters: z.array(z.object({ time: z.string(), title: z.string() })),
  }),
});

// One Markdown file per guest: the body is the bio.
const guests = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/content/guests" }),
  schema: z.object({ name: z.string() }),
});

export const collections = { broadcasts, guests };
