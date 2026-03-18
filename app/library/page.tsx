import { redirect } from "next/navigation";
import { LibraryView } from "@/components/library-view";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

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

  return (
    <LibraryView
      userEmail={user.email ?? "Signed in user"}
      initialTracks={tracksWithCoverUrl}
    />
  );
}
