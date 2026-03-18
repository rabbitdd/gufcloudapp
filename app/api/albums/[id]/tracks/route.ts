import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type TrackPayload = {
  trackId?: string;
};

async function requireOwnedAlbum(id: string) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id,owner_id")
    .eq("id", id)
    .single();

  if (albumError || !album) {
    return { error: NextResponse.json({ error: "Album not found" }, { status: 404 }) };
  }

  if (album.owner_id !== user.id) {
    return {
      error: NextResponse.json(
        { error: "You can only modify your own albums." },
        { status: 403 }
      )
    };
  }

  return { supabase };
}

export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const base = await requireOwnedAlbum(id);
  if (base.error) {
    return base.error;
  }

  const { trackId } = (await request.json()) as TrackPayload;
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required." }, { status: 400 });
  }

  const { error } = await base.supabase.from("album_tracks").upsert(
    {
      album_id: id,
      track_id: trackId
    },
    {
      onConflict: "album_id,track_id",
      ignoreDuplicates: true
    }
  );

  if (error) {
    return NextResponse.json(
      { error: "Failed to add track to album." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const base = await requireOwnedAlbum(id);
  if (base.error) {
    return base.error;
  }

  const { trackId } = (await request.json()) as TrackPayload;
  if (!trackId) {
    return NextResponse.json({ error: "trackId is required." }, { status: 400 });
  }

  const { error } = await base.supabase
    .from("album_tracks")
    .delete()
    .eq("album_id", id)
    .eq("track_id", trackId);

  if (error) {
    return NextResponse.json(
      { error: "Failed to remove track from album." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
