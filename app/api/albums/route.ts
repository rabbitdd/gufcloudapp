import { NextResponse } from "next/server";
import { canManageContent, getAuthContext } from "@/lib/modules/authz";
import { listAlbumsForLibrary } from "@/lib/modules/catalog";
import { createServerAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CreateAlbumPayload = {
  name: string;
  coverStoragePath?: string | null;
  coverThumbStoragePath?: string | null;
  trackIds?: string[];
};

export async function GET() {
  try {
    const readerClient = await createServerSupabaseClient();
    const signerClient = createServerAdminSupabaseClient() ?? readerClient;
    const albums = await listAlbumsForLibrary(readerClient, signerClient);
    return NextResponse.json({ albums });
  } catch {
    return NextResponse.json(
      { error: "Failed to load albums." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthContext(supabase);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageContent(auth.role)) {
    return NextResponse.json(
      { error: "Only uploaders/admins can create albums." },
      { status: 403 }
    );
  }

  const payload = (await request.json()) as CreateAlbumPayload;
  const name = payload.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Album name is required." },
      { status: 400 }
    );
  }

  const { data: album, error: insertAlbumError } = await supabase
    .from("albums")
    .insert({
      name,
      cover_storage_path: payload.coverStoragePath ?? null,
      cover_thumb_storage_path: payload.coverThumbStoragePath ?? null,
      owner_id: auth.userId
    })
    .select("id,name,cover_storage_path,cover_thumb_storage_path,owner_id,created_at")
    .single();

  if (insertAlbumError || !album) {
    return NextResponse.json(
      { error: "Failed to create album." },
      { status: 500 }
    );
  }

  const uniqueTrackIds = Array.from(new Set(payload.trackIds ?? []));
  if (uniqueTrackIds.length) {
    const rows = uniqueTrackIds.map((trackId) => ({
      album_id: album.id,
      track_id: trackId
    }));

    const { error: insertTracksError } = await supabase
      .from("album_tracks")
      .insert(rows);

    if (insertTracksError) {
      return NextResponse.json(
        { error: "Album created but failed to attach tracks." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({
    album: { ...album, track_ids: uniqueTrackIds, cover_signed_url: null }
  });
}
