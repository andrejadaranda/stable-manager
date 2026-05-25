// Pure types for horsePhotos. Safe to import from client components.
export type HorsePhoto = {
  id:         string;
  url:        string;
  caption:    string | null;
  sort_order: number;
  created_at: string;
};
