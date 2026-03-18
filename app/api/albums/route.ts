import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CreateAlbumPayload = {
  name: string;
  coverStoragePath?: string | null;
  trackIds?: string[];
};

export async function GET() {
  const supabase = await createServerSupabaseClient();

  const { data, error } = await supabase
    .from("albums")
    .select(
      "id,name,cover_storage_path,owner_id,created_at,album_tracks(track_id)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load albums." },
      { status: 500 }
    );
  }

  const albums = await Promise.all(
    (data ?? []).map(async (album) => {
      const trackIds = (album.album_tracks ?? []).map((row) => row.track_id);

      if (!album.cover_storage_path) {
        return {
          ...album,
          cover_signed_url: null,
          track_ids: trackIds
        };
      }

      const { data: signedData } = await supabase.storage
        .from("songs")
        .createSignedUrl(album.cover_storage_path, 60 * 60);

      return {
        ...album,
        cover_signed_url: signedData?.signedUrl ?? null,
        track_ids: trackIds
      };
    })
  );

  return NextResponse.json({ albums });
}

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
      owner_id: user.id
    })
    .select("id,name,cover_storage_path,owner_id,created_at")
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
