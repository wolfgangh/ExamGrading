/** Stabile Farbklassen pro Teilgebiet-Index (UI-Chips, Buttons, Kacheln). */

export type SubAreaColorClasses = {
  /** Chip / Badge / Button-Hintergrund */
  solid: string;
  /** Kachel-Hintergrund wenn zugeordnet */
  tile: string;
  /** Border */
  border: string;
};

const PALETTE: SubAreaColorClasses[] = [
  {
    solid:
      "border-sky-500/50 bg-sky-100 text-sky-950 hover:bg-sky-200 dark:border-sky-600 dark:bg-sky-950/60 dark:text-sky-50 dark:hover:bg-sky-900/70",
    tile: "border-sky-400 bg-sky-50/90 dark:border-sky-700 dark:bg-sky-950/40",
    border: "border-sky-500",
  },
  {
    solid:
      "border-violet-500/50 bg-violet-100 text-violet-950 hover:bg-violet-200 dark:border-violet-600 dark:bg-violet-950/60 dark:text-violet-50 dark:hover:bg-violet-900/70",
    tile: "border-violet-400 bg-violet-50/90 dark:border-violet-700 dark:bg-violet-950/40",
    border: "border-violet-500",
  },
  {
    solid:
      "border-teal-500/50 bg-teal-100 text-teal-950 hover:bg-teal-200 dark:border-teal-600 dark:bg-teal-950/60 dark:text-teal-50 dark:hover:bg-teal-900/70",
    tile: "border-teal-400 bg-teal-50/90 dark:border-teal-700 dark:bg-teal-950/40",
    border: "border-teal-500",
  },
  {
    solid:
      "border-orange-500/50 bg-orange-100 text-orange-950 hover:bg-orange-200 dark:border-orange-600 dark:bg-orange-950/60 dark:text-orange-50 dark:hover:bg-orange-900/70",
    tile: "border-orange-400 bg-orange-50/90 dark:border-orange-700 dark:bg-orange-950/40",
    border: "border-orange-500",
  },
  {
    solid:
      "border-rose-500/50 bg-rose-100 text-rose-950 hover:bg-rose-200 dark:border-rose-600 dark:bg-rose-950/60 dark:text-rose-50 dark:hover:bg-rose-900/70",
    tile: "border-rose-400 bg-rose-50/90 dark:border-rose-700 dark:bg-rose-950/40",
    border: "border-rose-500",
  },
  {
    solid:
      "border-lime-600/50 bg-lime-100 text-lime-950 hover:bg-lime-200 dark:border-lime-600 dark:bg-lime-950/60 dark:text-lime-50 dark:hover:bg-lime-900/70",
    tile: "border-lime-500 bg-lime-50/90 dark:border-lime-700 dark:bg-lime-950/40",
    border: "border-lime-600",
  },
];

export function subAreaColorAt(index: number): SubAreaColorClasses {
  return PALETTE[index % PALETTE.length];
}

export const UNASSIGNED_TILE =
  "border-amber-400 bg-amber-50/80 dark:border-amber-700 dark:bg-amber-950/35";
