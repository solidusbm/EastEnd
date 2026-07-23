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

/**
 * Auto-switches a screen to show just one category (optionally just one
 * image within it) during a time window -- the same effect as the "Only"
 * checkboxes in the image picker, just applied on a schedule instead of by
 * hand. The screen's normal imageIdsByType/durationSecondsByType stay
 * exactly as configured and are used whenever no rule is currently active,
 * so a schedule is purely an addition, never a replacement, of the base
 * setup.
 */
export interface ScheduleRule {
  id: string;
  label: string;
  /** 24h "HH:MM". If startTime > endTime, the window wraps past midnight. */
  startTime: string;
  endTime: string;
  /** 0=Sunday..6=Saturday. Empty means every day. */
  days: number[];
  type: ImageType;
  /** Narrow further to just this one image within `type`; unset shows the whole category. */
  imageId?: string;
}

export interface Screen {
  id: string;
  name: string;
  /** Order within each category's array is the display order -- reorderable in the image picker. */
  imageIdsByType: Record<ImageType, string[]>;
  durationSecondsByType: Record<ImageType, number>;
  perImageDurationSeconds: number;
  /** Per-image duration override (seconds), keyed by image id. Falls back to perImageDurationSeconds when absent. */
  imageDurationOverrides: Record<string, number>;
  /** Time-based auto-switching; first matching rule wins. See ScheduleRule. */
  scheduleRules: ScheduleRule[];
  /** Last time this screen's display page polled /api/display/[screenId], for an "is this TV alive" check in /admin. */
  lastSeenAt?: string;
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

/** Reads a map of imageId -> duration seconds, dropping any non-positive or invalid entries. */
export function normalizeImageDurationOverrides(input: unknown): Record<string, number> {
  const source = (input ?? {}) as Record<string, unknown>;
  const result: Record<string, number> = {};
  for (const [id, value] of Object.entries(source)) {
    const num = typeof value === "number" ? value : Number(value);
    if (Number.isFinite(num) && num > 0) {
      result[id] = Math.round(num);
    }
  }
  return result;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isValidTime(value: unknown): value is string {
  return typeof value === "string" && TIME_PATTERN.test(value);
}

/** Reads and validates an array of schedule rules, dropping any malformed entries. */
export function normalizeScheduleRules(input: unknown): ScheduleRule[] {
  if (!Array.isArray(input)) return [];
  const result: ScheduleRule[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) continue;
    const rule = raw as Record<string, unknown>;
    if (typeof rule.id !== "string" || !rule.id) continue;
    if (!isValidTime(rule.startTime) || !isValidTime(rule.endTime)) continue;
    if (typeof rule.type !== "string" || !IMAGE_TYPES.includes(rule.type as ImageType)) continue;
    const days = Array.isArray(rule.days)
      ? rule.days.filter((d): d is number => typeof d === "number" && d >= 0 && d <= 6)
      : [];
    result.push({
      id: rule.id,
      label: typeof rule.label === "string" ? rule.label : "",
      startTime: rule.startTime,
      endTime: rule.endTime,
      days,
      type: rule.type as ImageType,
      imageId: typeof rule.imageId === "string" && rule.imageId ? rule.imageId : undefined,
    });
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
