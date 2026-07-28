import { Anton, Caveat, Fredoka, Poppins } from "next/font/google";

// Self-hosted via next/font (no runtime network dependency for the TVs) --
// chosen to match fonts actually used across the uploaded menu designs, see
// lib/labelStyle.ts for how each maps to a LabelFontFamily choice.
export const poppins = Poppins({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-label-poppins" });
export const fredoka = Fredoka({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-label-fredoka" });
export const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-label-anton" });
export const caveat = Caveat({ weight: ["500", "700"], subsets: ["latin"], variable: "--font-label-caveat" });

export const LABEL_FONT_VARIABLES = `${poppins.variable} ${fredoka.variable} ${anton.variable} ${caveat.variable}`;
