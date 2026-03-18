import { LibraryView } from "@/components/library-view";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function GuestPage() {
  const supabase = await createServerSupabaseClient();

  const { data: tracks } = await supabase
    .from("tracks")
    .select(
      "id,title,artist,album,duration_sec,storage_path,cover_storage_path,uploaded_by,created_at"
    )
    .order("created_at", { ascending: false });

  const tracksWithCoverUrl = await Promise.all(
    (tracks ?? []).map(async (track) => {
      if (!track.cover_storage_path) {
        return { ...track, cover_signed_url: null };
      }

      const { data } = await supabase.storage
        .from("songs")
        .createSignedUrl(track.cover_storage_path, 60 * 60);

      return { ...track, cover_signed_url: data?.signedUrl ?? null };
    })
  );

  const { data: albums } = await supabase
    .from("albums")
    .select("id,name,cover_storage_path,owner_id,created_at,album_tracks(track_id)")
    .order("created_at", { ascending: false });

  const albumsWithCoverUrl = await Promise.all(
    (albums ?? []).map(async (album) => {
      const trackIds = (album.album_tracks ?? []).map((row) => row.track_id);
      if (!album.cover_storage_path) {
        return { ...album, cover_signed_url: null, track_ids: trackIds };
      }

      const { data } = await supabase.storage
        .from("songs")
        .createSignedUrl(album.cover_storage_path, 60 * 60);

      return {
        ...album,
        cover_signed_url: data?.signedUrl ?? null,
        track_ids: trackIds
      };
    })
  );

  return (
    <LibraryView
      userEmail="Guest mode (listen only)"
      initialTracks={tracksWithCoverUrl}
      initialAlbums={albumsWithCoverUrl}
      canManage={false}
    />
  );
}
