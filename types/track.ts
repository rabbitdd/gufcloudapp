export type Track = {
  id: string;
  title: string;
  artist: string | null;
  album: string | null;
  duration_sec: number | null;
  storage_path: string;
  cover_storage_path: string | null;
  cover_signed_url?: string | null;
  uploaded_by: string;
  created_at: string;
};
