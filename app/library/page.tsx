import { redirect } from "next/navigation";
import { LibraryView } from "@/components/library-view";
import { canManageContent, getAuthContext } from "@/lib/modules/authz";
import { listAlbumsForLibrary, listTracksForLibrary } from "@/lib/modules/catalog";
import { createServerAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function LibraryPage() {
  const readerClient = await createServerSupabaseClient();
  const signerClient = createServerAdminSupabaseClient() ?? readerClient;
  const auth = await getAuthContext(readerClient);
  if (!auth) {
    redirect("/login");
  }

  const [tracksWithCoverUrl, albumsWithCoverUrl] = await Promise.all([
    listTracksForLibrary(readerClient, signerClient),
    listAlbumsForLibrary(readerClient, signerClient)
  ]);

  return (
    <LibraryView
      userEmail={auth.email ?? "Signed in user"}
      initialTracks={tracksWithCoverUrl}
      initialAlbums={albumsWithCoverUrl}
      canManage={canManageContent(auth.role)}
    />
  );
}
