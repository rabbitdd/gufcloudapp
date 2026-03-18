import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const supabase = await createServerSupabaseClient();

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();

  let builder = supabase
    .from("tracks")
    .select(
      "id,title,artist,album,duration_sec,storage_path,cover_storage_path,uploaded_by,created_at"
    )
    .order("created_at", { ascending: false });

  if (query) {
    builder = builder.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
  }

  const { data, error } = await builder;

  if (error) {
    return NextResponse.json(
      { error: "Failed to load tracks." },
      { status: 500 }
    );
  }

  const tracks = await Promise.all(
    (data ?? []).map(async (track) => {
      if (!track.cover_storage_path) {
        return { ...track, cover_signed_url: null };
      }

      const { data: signedData } = await supabase.storage
        .from("songs")
        .createSignedUrl(track.cover_storage_path, 60 * 60);

      return {
        ...track,
        cover_signed_url: signedData?.signedUrl ?? null
      };
    })
  );

  return NextResponse.json({ tracks });
}
