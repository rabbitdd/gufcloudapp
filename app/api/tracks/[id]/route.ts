import { NextResponse } from "next/server";
import { canManageContent, getAuthContext } from "@/lib/modules/authz";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();
  const auth = await getAuthContext(supabase);
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canManageContent(auth.role)) {
    return NextResponse.json(
      { error: "Only uploaders/admins can delete tracks." },
      { status: 403 }
    );
  }

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("id,uploaded_by,storage_path,cover_storage_path")
    .eq("id", id)
    .single();

  if (trackError || !track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  if (track.uploaded_by !== auth.userId) {
    return NextResponse.json(
      { error: "You can only delete tracks you uploaded." },
      { status: 403 }
    );
  }

  const filePaths = [track.storage_path, track.cover_storage_path].filter(
    (value): value is string => Boolean(value)
  );

  if (filePaths.length) {
    const { error: storageError } = await supabase.storage
      .from("songs")
      .remove(filePaths);

    if (storageError) {
      return NextResponse.json(
        { error: "Failed to delete files from storage." },
        { status: 500 }
      );
    }
  }

  const { error: deleteError } = await supabase
    .from("tracks")
    .delete()
    .eq("id", id)
    .eq("uploaded_by", auth.userId);

  if (deleteError) {
    return NextResponse.json(
      { error: "Failed to delete track row." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
