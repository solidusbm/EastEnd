export type ImageType = "menu" | "food";

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
  menuImageIds: string[];
  foodImageIds: string[];
  menuDurationSeconds: number;
  foodDurationSeconds: number;
  perImageDurationSeconds: number;
}

export interface StoreData {
  images: ImageRecord[];
  screens: Screen[];
}

export const DEFAULT_SCREEN_DEFAULTS = {
  menuDurationSeconds: 180,
  foodDurationSeconds: 60,
  perImageDurationSeconds: 10,
};
