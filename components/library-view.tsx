"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadSongForm } from "@/components/upload-song-form";
import { TrackList } from "@/components/track-list";
import { PlayerBar } from "@/components/player-bar";
import { DEFAULT_ARTIST } from "@/lib/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Track } from "@/types/track";

type LibraryViewProps = {
  userEmail: string;
  initialTracks: Track[];
  canManage: boolean;
};

export function LibraryView({
  userEmail,
  initialTracks,
  canManage
}: LibraryViewProps) {
  const router = useRouter();
  const supabase = createBrowserSupabaseClient();

  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all">("off");

  const loadTracks = useCallback(async () => {
    setLibraryLoading(true);
    setLibraryError(null);

    const response = await fetch("/api/tracks", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      setLibraryError("Failed to load tracks.");
      setLibraryLoading(false);
      return;
    }

    const payload = (await response.json()) as { tracks: Track[] };
    setTracks(payload.tracks);
    setLibraryLoading(false);
  }, []);

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return tracks;
    }

    return tracks.filter((track) => {
      return (
        track.title.toLowerCase().includes(query) ||
        (track.artist || "").toLowerCase().includes(query)
      );
    });
  }, [search, tracks]);

  const fetchSignedUrl = async (trackId: string) => {
    const response = await fetch(`/api/stream/${trackId}`, {
      method: "GET"
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { signedUrl: string };
    return payload.signedUrl;
  };

  const handlePlay = async (track: Track) => {
    setLoadingTrackId(track.id);
    setLibraryError(null);

    const nextSignedUrl = await fetchSignedUrl(track.id);
    if (!nextSignedUrl) {
      setLibraryError("Could not create playback URL.");
      setLoadingTrackId(null);
      return;
    }

    setCurrentTrack(track);
    setSignedUrl(nextSignedUrl);
    setLoadingTrackId(null);
  };

  const handleDelete = async (track: Track) => {
    const shouldDelete = window.confirm(
      `Delete "${track.title}"? This will remove the song and cover file.`
    );

    if (!shouldDelete) {
      return;
    }

    setDeletingTrackId(track.id);
    setLibraryError(null);

    const response = await fetch(`/api/tracks/${track.id}`, {
      method: "DELETE"
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setLibraryError(payload?.error || "Failed to delete track.");
      setDeletingTrackId(null);
      return;
    }

    if (currentTrack?.id === track.id) {
      setCurrentTrack(null);
      setSignedUrl(null);
    }

    setTracks((prev) => prev.filter((item) => item.id !== track.id));
    setDeletingTrackId(null);
  };

  const activeQueue = filteredTracks.length ? filteredTracks : tracks;
  const currentTrackIndex = activeQueue.findIndex(
    (track) => track.id === currentTrack?.id
  );
  const recentCovers = tracks.filter((track) => Boolean(track.cover_signed_url)).slice(0, 8);
  const upNext = currentTrackIndex >= 0 ? activeQueue.slice(currentTrackIndex + 1, currentTrackIndex + 5) : activeQueue.slice(0, 4);

  const handlePlayNext = async () => {
    if (currentTrackIndex < 0 || currentTrackIndex + 1 >= activeQueue.length) {
      return;
    }
    await handlePlay(activeQueue[currentTrackIndex + 1]);
  };

  const handlePlayPrevious = async () => {
    if (currentTrackIndex <= 0) {
      return;
    }
    await handlePlay(activeQueue[currentTrackIndex - 1]);
  };

  const handleTrackEnded = async (audio: HTMLAudioElement) => {
    if (currentTrackIndex >= 0 && currentTrackIndex + 1 < activeQueue.length) {
      await handlePlay(activeQueue[currentTrackIndex + 1]);
      return;
    }

    if (repeatMode === "all" && activeQueue.length > 0) {
      await handlePlay(activeQueue[0]);
    }
  };

  const handleToggleRepeat = () => {
    setRepeatMode((prev) => (prev === "off" ? "all" : "off"));
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-black p-3 pb-32 lg:p-4 lg:pb-32">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="grid gap-3 lg:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[76px_minmax(0,1fr)_320px]">
          <aside className="hidden h-[calc(100vh-150px)] flex-col rounded-2xl bg-zinc-950 p-3 lg:flex">
            <button
              type="button"
              className="mb-2 rounded-full bg-zinc-800 p-3 text-xs text-white"
            >
              Home
            </button>
            <button
              type="button"
              className="mb-3 rounded-full bg-zinc-900 p-3 text-xs text-zinc-300"
            >
              Lib
            </button>
            <div className="space-y-2 overflow-y-auto">
              {recentCovers.map((track) => (
                <button
                  type="button"
                  key={`cover-${track.id}`}
                  onClick={() => void handlePlay(track)}
                  className="block w-full overflow-hidden rounded-md"
                >
                  {track.cover_signed_url ? (
                    <Image
                      src={track.cover_signed_url}
                      alt={`${track.title} cover`}
                      width={52}
                      height={52}
                      className="h-12 w-12 rounded-md object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-12 w-12 items-center justify-center rounded-md bg-zinc-800 text-zinc-400">
                      *
                    </div>
                  )}
                </button>
              ))}
            </div>
          </aside>

          <section className="h-[calc(100vh-150px)] overflow-y-auto rounded-2xl bg-gradient-to-b from-zinc-900 to-black p-4 md:p-5">
            <header className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-zinc-400">
                  Your music
                </p>
                <h1 className="text-2xl font-bold text-white">Library</h1>
                <p className="text-xs text-zinc-400">{userEmail}</p>
              </div>
              {canManage ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsUploadModalOpen(true)}
                    className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-300"
                  >
                    Upload song
                  </button>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    disabled={isSigningOut}
                    className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSigningOut ? "Signing out..." : "Sign out"}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/login")}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900"
                >
                  Sign in
                </button>
              )}
            </header>

            <div className="mb-4 space-y-3">
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="What do you want to play?"
                className="w-full rounded-full border border-zinc-800 bg-black px-4 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
              />
              <div className="flex gap-2 text-xs">
                <span className="rounded-full bg-white px-3 py-1 text-black">All</span>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">Music</span>
                <span className="rounded-full bg-zinc-800 px-3 py-1 text-zinc-200">Uploaded</span>
              </div>
            </div>

            {libraryLoading ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
                Loading tracks...
              </div>
            ) : (
              <TrackList
                tracks={filteredTracks}
                currentTrackId={currentTrack?.id ?? null}
                loadingTrackId={loadingTrackId}
                deletingTrackId={deletingTrackId}
                canDelete={canManage}
                onPlay={handlePlay}
                onDelete={handleDelete}
              />
            )}

            {libraryError ? (
              <p className="mt-4 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
                {libraryError}
              </p>
            ) : null}
          </section>

          <aside className="hidden h-[calc(100vh-150px)] overflow-y-auto rounded-2xl bg-zinc-950 p-4 xl:block">
            <h2 className="mb-3 text-sm font-semibold text-zinc-200">Now Playing</h2>
            <div className="rounded-xl bg-zinc-900 p-3">
              {currentTrack?.cover_signed_url ? (
                <Image
                  src={currentTrack.cover_signed_url}
                  alt={`${currentTrack.title} cover`}
                  width={280}
                  height={280}
                  className="mb-3 aspect-square w-full rounded-lg object-cover"
                  unoptimized
                />
              ) : (
                <div className="mb-3 flex aspect-square w-full items-center justify-center rounded-lg bg-zinc-800 text-zinc-400">
                  No cover
                </div>
              )}
              <p className="truncate text-lg font-semibold text-white">
                {currentTrack?.title || "No track selected"}
              </p>
              <p className="truncate text-sm text-zinc-400">
                {currentTrack?.artist || DEFAULT_ARTIST}
              </p>
            </div>

            <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Up next
            </h3>
            <div className="space-y-2">
              {upNext.map((track) => (
                <button
                  type="button"
                  key={`next-${track.id}`}
                  onClick={() => void handlePlay(track)}
                  className="flex w-full items-center gap-2 rounded-lg bg-zinc-900 px-2 py-2 text-left hover:bg-zinc-800"
                >
                  <div className="h-8 w-8 overflow-hidden rounded bg-zinc-800">
                    {track.cover_signed_url ? (
                      <Image
                        src={track.cover_signed_url}
                        alt={`${track.title} cover`}
                        width={32}
                        height={32}
                        className="h-8 w-8 object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-100">
                      {track.title}
                    </p>
                    <p className="truncate text-[11px] text-zinc-400">
                      {track.artist || DEFAULT_ARTIST}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>

        {canManage && isUploadModalOpen ? (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-black p-4 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-zinc-100">
                  Upload song
                </h2>
                <button
                  type="button"
                  onClick={() => setIsUploadModalOpen(false)}
                  className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
                >
                  Close
                </button>
              </div>
              <UploadSongForm
                onUploaded={async () => {
                  await loadTracks();
                  setIsUploadModalOpen(false);
                }}
              />
            </div>
          </div>
        ) : null}

        <PlayerBar
          track={currentTrack}
          signedUrl={signedUrl}
          hasPrevious={currentTrackIndex > 0}
          hasNext={
            currentTrackIndex >= 0 && currentTrackIndex + 1 < activeQueue.length
          }
          repeatMode={repeatMode}
          onToggleRepeat={handleToggleRepeat}
          onPrevious={handlePlayPrevious}
          onNext={handlePlayNext}
          onEnded={handleTrackEnded}
        />
      </div>
    </main>
  );
}
