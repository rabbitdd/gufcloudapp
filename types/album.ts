export type Album = {
  id: string;
  name: string;
  cover_storage_path: string | null;
  cover_thumb_storage_path?: string | null;
  cover_signed_url?: string | null;
  owner_id: string;
  created_at: string;
  track_ids: string[];
};
