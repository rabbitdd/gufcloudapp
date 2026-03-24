import { NextResponse } from "next/server";
import { canManageContent, getAuthContext } from "@/lib/modules/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SONGS_BUCKET = "songs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

type UpdateAlbumPayload = {
  name?: string;
  coverStoragePath?: string | null;
  coverThumbStoragePath?: string | null;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthContext(supabase);

  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageContent(auth.role)) {
    return NextResponse.json(
      { error: "Only uploaders/admins can update albums." },
      { status: 403 }
    );
  }

  const { data: album, error: albumError } = await supabase
    .from("albums")
    .select("id,owner_id,cover_storage_path,cover_thumb_storage_path")
    .eq("id", id)
    .single();

  if (albumError || !album) {
    return NextResponse.json({ error: "Album not found." }, { status: 404 });
  }
  if (album.owner_id !== auth.userId) {
    return NextResponse.json(
      { error: "You can only edit your own albums." },
      { status: 403 }
    );
  }

  const payload = (await request.json()) as UpdateAlbumPayload;
  const nextName =
    typeof payload.name === "string" ? payload.name.trim() : undefined;
  if (typeof payload.name === "string" && !nextName) {
    return NextResponse.json(
      { error: "Album name cannot be empty." },
      { status: 400 }
    );
  }

  const hasNameChange =
    typeof nextName === "string" && nextName && nextName !== undefined;
  const hasCoverChange = typeof payload.coverStoragePath === "string";
  const hasThumbChange = typeof payload.coverThumbStoragePath === "string";

  if (!hasNameChange && !hasCoverChange && !hasThumbChange) {
    return NextResponse.json(
      { error: "Provide at least one field to update." },
      { status: 400 }
    );
  }

  const updates: {
    name?: string;
    cover_storage_path?: string | null;
    cover_thumb_storage_path?: string | null;
  } = {};

  if (hasNameChange && nextName) {
    updates.name = nextName;
  }
  if (hasCoverChange) {
    updates.cover_storage_path = payload.coverStoragePath ?? null;
  }
  if (hasThumbChange) {
    updates.cover_thumb_storage_path = payload.coverThumbStoragePath ?? null;
  }

  const { data: updatedAlbum, error: updateError } = await supabase
    .from("albums")
    .update(updates)
    .eq("id", id)
    .eq("owner_id", auth.userId)
    .select(
      "id,name,cover_storage_path,cover_thumb_storage_path,owner_id,created_at"
    )
    .single();

  if (updateError || !updatedAlbum) {
    if (updateError?.code === "42501") {
      return NextResponse.json(
        {
          error:
            "Permission denied to update album. Apply migration 010_album_update_policy.sql and retry."
        },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: updateError?.message || "Failed to update album." },
      { status: 500 }
    );
  }

  const oldPathsToDelete: string[] = [];
  if (
    hasCoverChange &&
    album.cover_storage_path &&
    album.cover_storage_path !== payload.coverStoragePath
  ) {
    oldPathsToDelete.push(album.cover_storage_path);
  }
  if (
    hasThumbChange &&
    album.cover_thumb_storage_path &&
    album.cover_thumb_storage_path !== payload.coverThumbStoragePath
  ) {
    oldPathsToDelete.push(album.cover_thumb_storage_path);
  }
  if (oldPathsToDelete.length) {
    await supabase.storage.from(SONGS_BUCKET).remove(oldPathsToDelete);
  }

  return NextResponse.json({ album: updatedAlbum });
}
