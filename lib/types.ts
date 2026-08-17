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
  /** When true, the display overlays this image's label as a caption whenever it's shown. Defaults to false/absent (off). */
  showLabel?: boolean;
  /** Canva design this image is linked to, if imported/synced from Canva. */
  canvaDesignId?: string;
  /** When this image was last refreshed from the linked Canva design. */
  canvaSyncedAt?: string;
  /**
   * Set (to the remote's uploaded_at) when this image is mirrored from the
   * hosted admin panel's signage tab, not created locally -- see
   * lib/signageSync.ts. Marks it as owned by that sync: removed locally if
   * it's deleted remotely, never treated as a local-only image to preserve.
   */
  signageSyncedAt?: string;
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

/**
 * "category": the normal rotation -- cycle each category as a block for its
 * durationSecondsByType, walking imageIdsByType within it (the original
 * behavior). "fineGrain": ignore category grouping/durations entirely and
 * play `playlist` as one flat, manually ordered sequence instead. Either
 * way, an active ScheduleRule still overrides on top -- it's a temporary
 * single-category takeover regardless of which mode is selected.
 */
export type TimingMode = "category" | "fineGrain";

/** "percent": sizeValue is a percentage of the screen's width. "pixels": sizeValue is a fixed pixel width. */
export type PipSizeUnit = "percent" | "pixels";

export type PipPosition = "top-left" | "top-right" | "bottom-left" | "bottom-right";

export const PIP_SIZE_UNITS: PipSizeUnit[] = ["percent", "pixels"];
export const PIP_SIZE_UNIT_LABELS: Record<PipSizeUnit, string> = {
  percent: "% of screen width",
  pixels: "px (fixed width)",
};

export const PIP_POSITIONS: PipPosition[] = ["top-left", "top-right", "bottom-left", "bottom-right"];
export const PIP_POSITION_LABELS: Record<PipPosition, string> = {
  "top-left": "Top left",
  "top-right": "Top right",
  "bottom-left": "Bottom left",
  "bottom-right": "Bottom right",
};

/** "corner": snap to one of the four PipPosition presets. "custom": place freely via offsetX/offsetY from the top-left. */
export type PipPlacementMode = "corner" | "custom";

export const PIP_OFFSET_UNIT_LABELS: Record<PipSizeUnit, string> = {
  percent: "%",
  pixels: "px",
};

/**
 * Picture-in-picture: an independent second rotation, overlaid in a corner
 * on top of the screen's normal rotation. Mirrors the main rotation's own
 * shape (its own timingMode, category images/durations, and fine-grain
 * playlist) so it works exactly like a second, smaller screen layered on
 * top of the first -- enabling it never changes the main rotation.
 */
export interface PipConfig {
  enabled: boolean;
  timingMode: TimingMode;
  imageIdsByType: Record<ImageType, string[]>;
  durationSecondsByType: Record<ImageType, number>;
  perImageDurationSeconds: number;
  imageDurationOverrides: Record<string, number>;
  playlist: string[];
  /** Overlay width, interpreted per sizeUnit -- height follows automatically (16:9). */
  sizeUnit: PipSizeUnit;
  sizeValue: number;
  /** "corner" uses `position` below; "custom" uses offsetX/offsetY instead. */
  placementMode: PipPlacementMode;
  /** Which corner of the display the overlay is anchored to (placementMode "corner" only). */
  position: PipPosition;
  /** Distance from the left edge, interpreted per offsetXUnit (placementMode "custom" only). */
  offsetXUnit: PipSizeUnit;
  offsetXValue: number;
  /** Distance from the top edge, interpreted per offsetYUnit (placementMode "custom" only). */
  offsetYUnit: PipSizeUnit;
  offsetYValue: number;
}

/**
 * Which way the strip travels in scroll mode. The axis is implied rather
 * than stored separately: "left"/"right" are horizontal, "up"/"down" are
 * vertical, so there's no way to save an axis and a direction that
 * contradict each other.
 */
export type ScrollDirection = "left" | "right" | "up" | "down";

export const SCROLL_DIRECTIONS: ScrollDirection[] = ["left", "right", "up", "down"];

/** Phrased as the motion the viewer sees, since "left" alone reads ambiguously on a TV. */
export const SCROLL_DIRECTION_LABELS: Record<ScrollDirection, string> = {
  left: "Right → left",
  right: "Left → right",
  up: "Bottom → top",
  down: "Top → bottom",
};

export type ScrollAxis = "horizontal" | "vertical";

export function scrollAxis(direction: ScrollDirection): ScrollAxis {
  return direction === "up" || direction === "down" ? "vertical" : "horizontal";
}

/** Generous bounds -- a crawl and a blur are both legitimate looks. */
export const MIN_SCROLL_SPEED = 1;
export const MAX_SCROLL_SPEED = 2000;

/**
 * Replaces the screen's one-image-at-a-time crossfade with a single
 * continuous strip of every image, marching across the display and looping
 * seamlessly. Which images (and in what order) still comes from the normal
 * timing setup -- fine-grain playlist order, or every audible category
 * concatenated -- so this only changes *how* they're presented, never
 * *which*. Per-image durations are ignored while it's on: speed governs how
 * long anything stays on screen.
 *
 * Nothing is letterboxed here, by construction: each image is scaled to the
 * full cross-axis (full height when scrolling horizontally, full width when
 * scrolling vertically) and given whatever length its own aspect ratio
 * calls for, so a narrow image is simply a narrow slice of the strip rather
 * than a full-screen slot with black bars either side of it.
 */
export interface ScrollConfig {
  enabled: boolean;
  direction: ScrollDirection;
  /**
   * Travel speed in CSS pixels per second. Resolution-dependent by design
   * -- it's what the animation actually applies, and these are 1080p TVs.
   */
  speedPxPerSecond: number;
}

export function defaultScrollConfig(): ScrollConfig {
  return { enabled: false, direction: "left", speedPxPerSecond: 120 };
}

/** Reads and validates a ScrollConfig, falling back to defaults for any missing/invalid parts. */
export function normalizeScrollConfig(input: unknown): ScrollConfig {
  const source = (input ?? {}) as Record<string, unknown>;
  const fallback = defaultScrollConfig();
  const speed =
    typeof source.speedPxPerSecond === "number" ? source.speedPxPerSecond : Number(source.speedPxPerSecond);
  return {
    enabled: source.enabled === true,
    direction: SCROLL_DIRECTIONS.includes(source.direction as ScrollDirection)
      ? (source.direction as ScrollDirection)
      : fallback.direction,
    speedPxPerSecond: Number.isFinite(speed)
      ? Math.min(MAX_SCROLL_SPEED, Math.max(MIN_SCROLL_SPEED, Math.round(speed)))
      : fallback.speedPxPerSecond,
  };
}

/**
 * How far to rotate everything drawn on screen, in degrees clockwise.
 *
 * A TV physically mounted sideways still receives an ordinary landscape
 * signal -- the stick or player has no idea the panel was turned -- so the
 * content comes out lying on its side and the only place left to fix it is
 * here, by rotating what gets painted.
 */
export type Orientation = 0 | 90 | 180 | 270;

export const ORIENTATIONS: Orientation[] = [0, 90, 180, 270];

export const ORIENTATION_LABELS: Record<Orientation, string> = {
  0: "Landscape",
  90: "Portrait (90°)",
  180: "Landscape, flipped",
  270: "Portrait (270°)",
};

export const DEFAULT_ORIENTATION: Orientation = 0;

/** Anything that isn't one of the four quarter turns falls back to landscape. */
export function normalizeOrientation(input: unknown): Orientation {
  const num = typeof input === "number" ? input : Number(input);
  return ORIENTATIONS.includes(num as Orientation) ? (num as Orientation) : DEFAULT_ORIENTATION;
}

/** True for the two quarter turns that swap the display's width and height. */
export function isQuarterTurn(orientation: Orientation): boolean {
  return orientation === 90 || orientation === 270;
}

/**
 * Whether a screen's display page actively fights the TV going to sleep or
 * dropping into a screensaver. Defaults to ON: a menu board that blanks
 * itself has failed at the one thing it exists to do, so the safe default is
 * the one that keeps showing the menu. See useKeepAwake for what the display
 * actually does with it, and why a web page can't always win this fight.
 */
export const DEFAULT_KEEP_AWAKE = true;

/** Absent/invalid means "on" -- see DEFAULT_KEEP_AWAKE. Only an explicit `false` turns it off. */
export function normalizeKeepAwake(input: unknown): boolean {
  return input !== false;
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
  /** Which of the two display models below is active. Defaults to "category" so existing screens keep behaving exactly as before. */
  timingMode: TimingMode;
  /**
   * Flat, manually ordered list of image ids (any category, mix freely)
   * used only when timingMode is "fineGrain". Duration per entry comes from
   * imageDurationOverrides/perImageDurationSeconds, same as category mode --
   * this only overrides order and category grouping, not the duration model.
   */
  playlist: string[];
  /** Independent overlay rotation shown in a corner on top of the above. See PipConfig. */
  pip: PipConfig;
  /** Continuous-scroll presentation instead of the one-at-a-time crossfade. See ScrollConfig. */
  scroll: ScrollConfig;
  /** Hold the TV awake while this screen's display page is open. See DEFAULT_KEEP_AWAKE. */
  keepAwake: boolean;
  /** Quarter-turn rotation for sideways-mounted TVs. See Orientation. */
  orientation: Orientation;
  /** Time-based auto-switching; first matching rule wins. See ScheduleRule. */
  scheduleRules: ScheduleRule[];
  /** Last time this screen's display page polled /api/display/[screenId], for an "is this TV alive" check in /admin. */
  lastSeenAt?: string;
  /** Set when this screen is mirrored from the hosted admin panel's signage tab -- see lib/signageSync.ts. */
  signageSyncedAt?: string;
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

/**
 * A reusable, named fine-grain playlist -- built once in the playlist
 * library and then loaded into any screen's `playlist`/`imageDurationOverrides`
 * (a copy, not a live link: editing a saved playlist later doesn't retroactively
 * change screens that already loaded it). Also what gets mirrored to GitHub
 * backups, keyed by image filename rather than id since ids are re-minted
 * on import -- see lib/githubBackup.ts.
 */
export interface SavedPlaylist {
  id: string;
  name: string;
  imageIds: string[];
  imageDurationOverrides: Record<string, number>;
}

export interface StoreData {
  images: ImageRecord[];
  screens: Screen[];
  savedPlaylists: SavedPlaylist[];
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
  // New screens start in fine-grain mode -- category timing is still there
  // as the alternative, just no longer the default.
  timingMode: "fineGrain" as TimingMode,
  playlist: [] as string[],
};

export function defaultPipConfig(): PipConfig {
  return {
    enabled: false,
    timingMode: "fineGrain",
    imageIdsByType: { menu: [], food: [], location: [], promo: [] },
    durationSecondsByType: { ...DEFAULT_DURATION_SECONDS },
    perImageDurationSeconds: 10,
    imageDurationOverrides: {},
    playlist: [],
    sizeUnit: "percent",
    sizeValue: 25,
    placementMode: "corner",
    position: "top-right",
    offsetXUnit: "percent",
    offsetXValue: 4,
    offsetYUnit: "percent",
    offsetYValue: 4,
  };
}

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

/** Reads a flat list of image ids for fine-grain playlist mode, dropping any non-string entries. */
export function normalizePlaylist(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((v): v is string => typeof v === "string");
}

/** Reads and validates an array of saved playlists, dropping any malformed entries. */
export function normalizeSavedPlaylists(input: unknown): SavedPlaylist[] {
  if (!Array.isArray(input)) return [];
  const result: SavedPlaylist[] = [];
  for (const raw of input) {
    if (typeof raw !== "object" || raw === null) continue;
    const playlist = raw as Record<string, unknown>;
    if (typeof playlist.id !== "string" || !playlist.id) continue;
    result.push({
      id: playlist.id,
      name: typeof playlist.name === "string" ? playlist.name : "",
      imageIds: normalizePlaylist(playlist.imageIds),
      imageDurationOverrides: normalizeImageDurationOverrides(playlist.imageDurationOverrides),
    });
  }
  return result;
}

export function normalizeTimingMode(input: unknown): TimingMode {
  return input === "fineGrain" ? "fineGrain" : "category";
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

/** Reads and validates a PipConfig, falling back to sensible defaults for any missing/invalid parts. */
export function normalizePipConfig(input: unknown): PipConfig {
  const source = (input ?? {}) as Record<string, unknown>;
  const fallback = defaultPipConfig();
  const num =
    typeof source.perImageDurationSeconds === "number" ? source.perImageDurationSeconds : Number(source.perImageDurationSeconds);
  const sizeNum = typeof source.sizeValue === "number" ? source.sizeValue : Number(source.sizeValue);

  function unit(value: unknown, fallbackUnit: PipSizeUnit): PipSizeUnit {
    return PIP_SIZE_UNITS.includes(value as PipSizeUnit) ? (value as PipSizeUnit) : fallbackUnit;
  }
  // Offsets may legitimately be 0 (flush against an edge), unlike sizeValue/perImageDurationSeconds.
  function offset(value: unknown, fallbackValue: number): number {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : fallbackValue;
  }

  return {
    enabled: source.enabled === true,
    timingMode: normalizeTimingMode(source.timingMode),
    imageIdsByType: normalizeImageIdsByType(source.imageIdsByType),
    durationSecondsByType: normalizeDurationSecondsByType(source.durationSecondsByType, fallback.durationSecondsByType),
    perImageDurationSeconds: Number.isFinite(num) && num > 0 ? Math.round(num) : fallback.perImageDurationSeconds,
    imageDurationOverrides: normalizeImageDurationOverrides(source.imageDurationOverrides),
    playlist: normalizePlaylist(source.playlist),
    sizeUnit: unit(source.sizeUnit, fallback.sizeUnit),
    sizeValue: Number.isFinite(sizeNum) && sizeNum > 0 ? Math.round(sizeNum) : fallback.sizeValue,
    placementMode: source.placementMode === "custom" ? "custom" : "corner",
    position: PIP_POSITIONS.includes(source.position as PipPosition) ? (source.position as PipPosition) : fallback.position,
    offsetXUnit: unit(source.offsetXUnit, fallback.offsetXUnit),
    offsetXValue: offset(source.offsetXValue, fallback.offsetXValue),
    offsetYUnit: unit(source.offsetYUnit, fallback.offsetYUnit),
    offsetYValue: offset(source.offsetYValue, fallback.offsetYValue),
  };
}
