export type ImageType = "menu" | "food" | "location" | "promo";

export const IMAGE_TYPES: ImageType[] = ["menu", "food", "location", "promo"];

export const IMAGE_TYPE_LABELS: Record<ImageType, string> = {
  menu: "Menu",
  food: "Food",
  location: "Location",
  promo: "Promo",
};

export interface ImageRecord {
  id: string;
  url: string;
  type: ImageType;
  label: string;
  uploadedAt: string;
  /** Canva design this image is linked to, if imported/synced from Canva. */
  canvaDesignId?: string;
  /** When this image was last refreshed from the linked Canva design. */
  canvaSyncedAt?: string;
}

export interface Screen {
  id: string;
  name: string;
  imageIdsByType: Record<ImageType, string[]>;
  durationSecondsByType: Record<ImageType, number>;
  perImageDurationSeconds: number;
}

/**
 * A manual, instant override shown on every screen in place of its normal
 * rotation -- e.g. "Closed for a private event today." Global (not
 * per-screen) since the point is a single button that reaches every TV at
 * once without hunting through individual screens.
 */
export interface EmergencyOverride {
  active: boolean;
  /** Existing image id to show full-screen instead of the normal rotation. */
  imageId?: string;
  /** Text shown instead of (or captioned under, if imageId is also set) the image. */
  message?: string;
  activatedAt?: string;
}

export const DEFAULT_EMERGENCY_OVERRIDE: EmergencyOverride = { active: false };

export interface StoreData {
  images: ImageRecord[];
  screens: Screen[];
  emergencyOverride: EmergencyOverride;
}

export const DEFAULT_DURATION_SECONDS: Record<ImageType, number> = {
  menu: 180,
  food: 60,
  location: 60,
  promo: 30,
};

export const DEFAULT_SCREEN_DEFAULTS = {
  durationSecondsByType: DEFAULT_DURATION_SECONDS,
  perImageDurationSeconds: 10,
};

/** Reads `input[type]` for each known image type, keeping only string entries. */
export function normalizeImageIdsByType(input: unknown): Record<ImageType, string[]> {
  const source = (input ?? {}) as Record<string, unknown>;
  const result = {} as Record<ImageType, string[]>;
  for (const type of IMAGE_TYPES) {
    const value = source[type];
    result[type] = Array.isArray(value)
      ? value.filter((v): v is string => typeof v === "string")
      : [];
  }
  return result;
}

/**
 * Reads `input[type]` for each known image type, falling back per-type when
 * missing/invalid. 0 is a valid, meaningful value here (it's how a screen
 * disables/silences a category, e.g. via the "only this category" shortcut)
 * so it's preserved rather than treated as missing.
 */
export function normalizeDurationSecondsByType(
  input: unknown,
  fallback: Record<ImageType, number> = DEFAULT_DURATION_SECONDS
): Record<ImageType, number> {
  const source = (input ?? {}) as Record<string, unknown>;
  const result = {} as Record<ImageType, number>;
  for (const type of IMAGE_TYPES) {
    const value = source[type];
    const num = typeof value === "number" ? value : Number(value);
    result[type] = Number.isFinite(num) && num >= 0 ? Math.round(num) : fallback[type];
  }
  return result;
}
