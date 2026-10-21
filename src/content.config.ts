import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

// One Markdown file per broadcast, from the start: the date, theme and any
// guests. After it airs, the same file gets the recording, hosts and chapters,
// and its body is the description. A broadcast with audio is in the archive.
const broadcasts = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/content/broadcasts" }),
  schema: z.object({
    number: z.number(),
    theme: z.string(),
    date: z.coerce.date(),
    guests: z.array(reference("guests")).default([]),
    audio: z.string().url().optional(),
    peaks: z.string().optional(),
    duration: z.number().optional(),  // seconds
    hosts: z.array(z.string()).default([]),
    chapters: z.array(z.object({ time: z.string(), title: z.string() })).default([]),
  }),
});

// One Markdown file per guest: the body is the bio.
const guests = defineCollection({
  loader: glob({ pattern: "*.md", base: "src/content/guests" }),
  schema: z.object({ name: z.string() }),
});

// One Markdoc file per vignette of the precedents report. "broadcast" is the
// number of the broadcast where it's read (its theme); "start" is when the
// reading starts in that broadcast's recording, once it has aired.
const vignettes = defineCollection({
  loader: glob({ pattern: "*.mdoc", base: "src/content/vignettes" }),
  schema: z.object({
    title: z.string(),
    authors: z.array(z.string()),
    broadcast: z.number(),
    order: z.number().default(0),
    start: z.string().optional(),  // "5:48"
  }),
});

export const collections = { broadcasts, guests, vignettes };
