import { NextResponse } from "next/server";
import { issueSignedPlaybackUrl } from "@/lib/modules/playback";
import { createServerAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const readerClient = await createServerSupabaseClient();
  const signerClient = createServerAdminSupabaseClient() ?? readerClient;
  const signedUrl = await issueSignedPlaybackUrl(readerClient, signerClient, id);

  if (!signedUrl) {
    return NextResponse.json({ error: "Track not found" }, { status: 404 });
  }

  return NextResponse.json(signedUrl);
}
