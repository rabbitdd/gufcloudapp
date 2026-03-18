import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const SONGS_BUCKET = "songs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createServerSupabaseClient();

  const { data: track, error: trackError } = await supabase
    .from("tracks")
    .select("id,storage_path")
    .eq("id", id)
    .single();

  if (trackError || !track) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  const { data, error: signError } = await supabase.storage
    .from(SONGS_BUCKET)
    .createSignedUrl(track.storage_path, 60 * 60);

  if (signError || !data?.signedUrl) {
    return NextResponse.json(
      { error: "Failed to create signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: data.signedUrl });
}
