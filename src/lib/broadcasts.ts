import { getCollection, getEntries, type CollectionEntry } from "astro:content";

export type Broadcast = CollectionEntry<"broadcasts">;
const zone = { timeZone: "America/New_York" } as const;

export async function broadcasts() {
  const list = (await getCollection("broadcasts")).sort((a, b) => a.data.number - b.data.number);
  return Promise.all(list.map(async (b) => ({ b, guests: (await getEntries(b.data.guests ?? [])).map((g) => g.data.name) })));
}
export const aired = (b: Broadcast) => Boolean(b.data.audio);
export const url = (b: Broadcast) => `/broadcasts/${b.id}/`;
export const title = (b: Broadcast) => `Broadcast ${b.data.number}: ${b.data.theme}`;
export const and = (names: string[]) =>
  names.length > 1 ? names.slice(0, -1).join(", ") + " and " + names.at(-1) : names[0] ?? "";
export const short = (d: Date) => d.toLocaleDateString("en-US", { ...zone, weekday: "short", month: "numeric", day: "numeric" }).replace(",", "");
export const long = (d: Date) => d.toLocaleDateString("en-US", { ...zone, weekday: "long", month: "long", day: "numeric", year: "numeric" });
export const hour = (d: Date) => d.toLocaleTimeString("en-US", { ...zone, hour: "numeric", minute: "2-digit" }).replace(":00", "").replace("AM", "am").replace("PM", "pm");
export const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
