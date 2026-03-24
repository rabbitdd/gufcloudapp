import { NextResponse } from "next/server";
import { listTracksForLibrary } from "@/lib/modules/catalog";
import { createServerAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const readerClient = await createServerSupabaseClient();
    const signerClient = createServerAdminSupabaseClient() ?? readerClient;
    const { searchParams } = new URL(request.url);
    const tracks = await listTracksForLibrary(readerClient, signerClient, {
      query: searchParams.get("q") ?? undefined
    });

    return NextResponse.json({ tracks });
  } catch {
    return NextResponse.json(
      { error: "Failed to load tracks." },
      { status: 500 }
    );
  }
}
