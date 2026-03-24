import { LibraryView } from "@/components/library-view";
import { listAlbumsForLibrary, listTracksForLibrary } from "@/lib/modules/catalog";
import { createServerAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function GuestPage() {
  const readerClient = await createServerSupabaseClient();
  const signerClient = createServerAdminSupabaseClient() ?? readerClient;
  const [tracksWithCoverUrl, albumsWithCoverUrl] = await Promise.all([
    listTracksForLibrary(readerClient, signerClient),
    listAlbumsForLibrary(readerClient, signerClient)
  ]);

  return (
    <LibraryView
      userEmail="Guest mode (listen only)"
      initialTracks={tracksWithCoverUrl}
      initialAlbums={albumsWithCoverUrl}
      canManage={false}
    />
  );
}
