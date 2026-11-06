export type Tone = "navy" | "blue" | "amber" | "green" | "red";

/** Classes par ton : fond d'icône (contraste AA), texte, point de couleur. */
export const TONES: Record<Tone, { icon: string; text: string; dot: string; ring: string }> = {
  navy: { text: "text-navy", icon: "bg-navy text-white", dot: "bg-navy", ring: "hover:border-navy/40" },
  blue: { text: "text-blue-800", icon: "bg-blue-100 text-blue-800", dot: "bg-sky-accent", ring: "hover:border-sky-accent" },
  amber: { text: "text-amber-800", icon: "bg-amber-100 text-amber-800", dot: "bg-amber-brand", ring: "hover:border-amber-brand" },
  green: { text: "text-green-800", icon: "bg-green-100 text-green-800", dot: "bg-success", ring: "hover:border-success" },
  red: { text: "text-red-800", icon: "bg-red-100 text-red-800", dot: "bg-danger", ring: "hover:border-danger" },
};
