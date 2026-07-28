import type { AppSettings } from "./settings";

// Font choices picked to match the fonts actually used across the uploaded
// menu designs: Poppins for the clean rounded body/header text, Fredoka for
// the bubbly display headers (BEER/WINE/DRINKS), Anton for the bold
// condensed badges (SPECIALTY PIZZAS), Caveat for the handwritten accents
// (the "Add" callout). See app/dis/fonts.ts for the actual font loading.
export type LabelFontFamily = "default" | "poppins" | "fredoka" | "anton" | "caveat";

export const LABEL_FONT_FAMILIES: LabelFontFamily[] = ["default", "poppins", "fredoka", "anton", "caveat"];

export const LABEL_FONT_FAMILY_LABELS: Record<LabelFontFamily, string> = {
  default: "Default (system sans)",
  poppins: "Poppins (clean, rounded)",
  fredoka: "Fredoka (bold, playful)",
  anton: "Anton (bold, condensed)",
  caveat: "Caveat (handwritten)",
};

/** CSS var each font is loaded under via next/font -- see app/dis/fonts.ts. "default" has none (falls back to the page's normal font). */
export const LABEL_FONT_CSS_VARS: Record<LabelFontFamily, string | undefined> = {
  default: undefined,
  poppins: "var(--font-label-poppins)",
  fredoka: "var(--font-label-fredoka)",
  anton: "var(--font-label-anton)",
  caveat: "var(--font-label-caveat)",
};

export interface LabelStyle {
  /** Main-rotation caption font size in px. The pip overlay's caption scales down from this. */
  fontSize: number;
  fontFamily: LabelFontFamily;
  /** Hex, e.g. "#ffffff". */
  textColor: string;
  /** Hex, e.g. "#000000". */
  backgroundColor: string;
  /** 0-100. */
  backgroundOpacity: number;
}

export const DEFAULT_LABEL_STYLE: LabelStyle = {
  fontSize: 28,
  fontFamily: "default",
  textColor: "#ffffff",
  backgroundColor: "#000000",
  backgroundOpacity: 70,
};

const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Reads label style out of the app's global settings, falling back to defaults for anything missing/invalid. */
export function normalizeLabelStyle(settings: AppSettings): LabelStyle {
  const fontSizeNum = Number(settings.labelFontSize);
  const opacityNum = Number(settings.labelBackgroundOpacity);
  return {
    fontSize: Number.isFinite(fontSizeNum) && fontSizeNum > 0 ? Math.round(fontSizeNum) : DEFAULT_LABEL_STYLE.fontSize,
    fontFamily: LABEL_FONT_FAMILIES.includes(settings.labelFontFamily as LabelFontFamily)
      ? (settings.labelFontFamily as LabelFontFamily)
      : DEFAULT_LABEL_STYLE.fontFamily,
    textColor: HEX_COLOR_PATTERN.test(settings.labelTextColor ?? "")
      ? (settings.labelTextColor as string)
      : DEFAULT_LABEL_STYLE.textColor,
    backgroundColor: HEX_COLOR_PATTERN.test(settings.labelBackgroundColor ?? "")
      ? (settings.labelBackgroundColor as string)
      : DEFAULT_LABEL_STYLE.backgroundColor,
    backgroundOpacity:
      Number.isFinite(opacityNum) && opacityNum >= 0 && opacityNum <= 100
        ? Math.round(opacityNum)
        : DEFAULT_LABEL_STYLE.backgroundOpacity,
  };
}

/** Converts a "#rrggbb" hex color + 0-100 opacity into an rgba() CSS color string. */
export function hexToRgba(hex: string, opacityPercent: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
}
