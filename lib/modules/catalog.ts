import { SupabaseClient } from "@supabase/supabase-js";
import { Album } from "@/types/album";
import { Track } from "@/types/track";

const SONGS_BUCKET = "songs";
const URL_TTL_SECONDS = 60 * 60;
const COVER_URL_CACHE_SAFETY_BUFFER_MS = 45 * 1000;

type CachedSignedUrl = {
  signedUrl: string;
  expiresAtMs: number;
};

const coverSignedUrlCache = new Map<string, CachedSignedUrl>();

type ListTracksOptions = {
  query?: string;
};

function withSignedUrl(path: string, signedUrl: string | null) {
  return signedUrl ? signedUrl : null;
}

function getCachedCoverSignedUrl(path: string) {
  const cached = coverSignedUrlCache.get(path);
  if (!cached) {
    return null;
  }
  if (Date.now() >= cached.expiresAtMs - COVER_URL_CACHE_SAFETY_BUFFER_MS) {
    coverSignedUrlCache.delete(path);
    return null;
  }
  return cached.signedUrl;
}

async function signCoverPath(signerClient: SupabaseClient, path: string) {
  const cached = getCachedCoverSignedUrl(path);
  if (cached) {
    return cached;
  }

  const { data: signedData } = await signerClient.storage
    .from(SONGS_BUCKET)
    .createSignedUrl(path, URL_TTL_SECONDS);
  const signedUrl = signedData?.signedUrl ?? null;

  if (signedUrl) {
    coverSignedUrlCache.set(path, {
      signedUrl,
      expiresAtMs: Date.now() + URL_TTL_SECONDS * 1000
    });
  }

  return signedUrl;
}

async function signCoverPathsBatch(
  signerClient: SupabaseClient,
  paths: string[]
): Promise<Map<string, string>> {
  const pathToSignedUrl = new Map<string, string>();
  const uncachedPaths: string[] = [];

  for (const path of paths) {
    const cached = getCachedCoverSignedUrl(path);
    if (cached) {
      pathToSignedUrl.set(path, cached);
      continue;
    }
    uncachedPaths.push(path);
  }

  if (!uncachedPaths.length) {
    return pathToSignedUrl;
  }

  const { data, error } = await signerClient.storage
    .from(SONGS_BUCKET)
    .createSignedUrls(uncachedPaths, URL_TTL_SECONDS);

  if (error || !data) {
    await Promise.all(
      uncachedPaths.map(async (path) => {
        const signedUrl = await signCoverPath(signerClient, path);
        if (signedUrl) {
          pathToSignedUrl.set(path, signedUrl);
        }
      })
    );
    return pathToSignedUrl;
  }

  for (const item of data as Array<{ path?: string; signedUrl?: string; signedURL?: string }>) {
    const path = item.path;
    const signedUrl = item.signedUrl ?? item.signedURL ?? null;
    if (!path || !signedUrl) {
      continue;
    }
    coverSignedUrlCache.set(path, {
      signedUrl,
      expiresAtMs: Date.now() + URL_TTL_SECONDS * 1000
    });
    pathToSignedUrl.set(path, signedUrl);
  }

  return pathToSignedUrl;
}

export async function listTracksForLibrary(
  readerClient: SupabaseClient,
  signerClient: SupabaseClient,
  options: ListTracksOptions = {}
): Promise<Track[]> {
  let builder = readerClient
    .from("tracks")
    .select(
      "id,title,artist,album,duration_sec,cover_storage_path,cover_thumb_storage_path,uploaded_by,created_at"
    )
    .order("created_at", { ascending: false });

  const query = options.query?.trim();
  if (query) {
    builder = builder.or(`title.ilike.%${query}%,artist.ilike.%${query}%`);
  }

  const { data, error } = await builder;
  if (error) {
    throw new Error("Failed to load tracks.");
  }

  const tracks = data ?? [];
  const coverPaths = Array.from(
    new Set(
      tracks
        .map(
          (track) =>
            track.cover_thumb_storage_path ?? track.cover_storage_path ?? null
        )
        .filter((value): value is string => Boolean(value))
    )
  );
  const signedPathMap = await signCoverPathsBatch(signerClient, coverPaths);

  return tracks.map((track) => {
    const coverPath =
      track.cover_thumb_storage_path ?? track.cover_storage_path ?? null;

    if (!coverPath) {
      return { ...track, cover_signed_url: null };
    }

    return {
      ...track,
      cover_signed_url: withSignedUrl(coverPath, signedPathMap.get(coverPath) ?? null)
    };
  });
}

export async function listAlbumsForLibrary(
  readerClient: SupabaseClient,
  signerClient: SupabaseClient
): Promise<Album[]> {
  const { data, error } = await readerClient
    .from("albums")
    .select(
      "id,name,cover_storage_path,cover_thumb_storage_path,owner_id,created_at,album_tracks(track_id)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error("Failed to load albums.");
  }

  const albums = data ?? [];
  const coverPaths = Array.from(
    new Set(
      albums
        .map(
          (album) =>
            album.cover_thumb_storage_path ?? album.cover_storage_path ?? null
        )
        .filter((value): value is string => Boolean(value))
    )
  );
  const signedPathMap = await signCoverPathsBatch(signerClient, coverPaths);

  return albums.map((album) => {
    const trackIds = (album.album_tracks ?? []).map((row) => row.track_id);
    const coverPath =
      album.cover_thumb_storage_path ?? album.cover_storage_path ?? null;

    if (!coverPath) {
      return {
        ...album,
        cover_signed_url: null,
        track_ids: trackIds
      };
    }

    return {
      ...album,
      cover_signed_url: withSignedUrl(coverPath, signedPathMap.get(coverPath) ?? null),
      track_ids: trackIds
    };
  });
}
