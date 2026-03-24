import { SupabaseClient } from "@supabase/supabase-js";

const SONGS_BUCKET = "songs";
const URL_TTL_SECONDS = 60 * 60;
const PLAYBACK_URL_CACHE_SAFETY_BUFFER_MS = 45 * 1000;

type CachedPlaybackUrl = {
  signedUrl: string;
  expiresAtMs: number;
};

const playbackSignedUrlCache = new Map<string, CachedPlaybackUrl>();

async function resolvePlayableStoragePath(readerClient: SupabaseClient, trackId: string) {
  const { data: asset } = await readerClient
    .from("track_assets")
    .select("storage_path")
    .eq("track_id", trackId)
    .eq("is_playable", true)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (asset?.storage_path) {
    return asset.storage_path;
  }

  const { data: track, error: trackError } = await readerClient
    .from("tracks")
    .select("storage_path")
    .eq("id", trackId)
    .single();

  if (trackError || !track?.storage_path) {
    return null;
  }

  return track.storage_path;
}

export async function issueSignedPlaybackUrl(
  readerClient: SupabaseClient,
  signerClient: SupabaseClient,
  trackId: string
) {
  const storagePath = await resolvePlayableStoragePath(readerClient, trackId);
  if (!storagePath) {
    return null;
  }

  const cached = playbackSignedUrlCache.get(storagePath);
  if (cached && Date.now() < cached.expiresAtMs - PLAYBACK_URL_CACHE_SAFETY_BUFFER_MS) {
    return {
      signedUrl: cached.signedUrl,
      expiresAt: new Date(cached.expiresAtMs).toISOString()
    };
  }

  const { data, error } = await signerClient.storage
    .from(SONGS_BUCKET)
    .createSignedUrl(storagePath, URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    return null;
  }

  const expiresAtMs = Date.now() + URL_TTL_SECONDS * 1000;
  playbackSignedUrlCache.set(storagePath, {
    signedUrl: data.signedUrl,
    expiresAtMs
  });

  return {
    signedUrl: data.signedUrl,
    expiresAt: new Date(expiresAtMs).toISOString()
  };
}
