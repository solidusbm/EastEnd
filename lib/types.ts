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
}

export interface Screen {
  id: string;
  name: string;
  imageIdsByType: Record<ImageType, string[]>;
  durationSecondsByType: Record<ImageType, number>;
  perImageDurationSeconds: number;
}

export interface StoreData {
  images: ImageRecord[];
  screens: Screen[];
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

/** Reads `input[type]` for each known image type, falling back per-type when missing/invalid. */
export function normalizeDurationSecondsByType(
  input: unknown,
  fallback: Record<ImageType, number> = DEFAULT_DURATION_SECONDS
): Record<ImageType, number> {
  const source = (input ?? {}) as Record<string, unknown>;
  const result = {} as Record<ImageType, number>;
  for (const type of IMAGE_TYPES) {
    const value = source[type];
    const num = typeof value === "number" ? value : Number(value);
    result[type] = Number.isFinite(num) && num > 0 ? Math.round(num) : fallback[type];
  }
  return result;
}
