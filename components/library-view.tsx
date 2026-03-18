"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AddTracksToAlbumModal } from "@/components/add-tracks-to-album-modal";
import { CreateAlbumModal } from "@/components/create-album-modal";
import { UploadSongForm } from "@/components/upload-song-form";
import { TrackList } from "@/components/track-list";
import { PlayerBar } from "@/components/player-bar";
import { DEFAULT_ARTIST } from "@/lib/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Album } from "@/types/album";
import { Track } from "@/types/track";

type DeleteChoiceMode = "album" | "all";

type LibraryViewProps = {
  userEmail: string;
  initialTracks: Track[];
  initialAlbums: Album[];
  canManage: boolean;
};

export function LibraryView({
  userEmail,
  initialTracks,
  initialAlbums,
  canManage
}: LibraryViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = createBrowserSupabaseClient();

  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [albums, setAlbums] = useState<Album[]>(initialAlbums);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);
  const [isAddTracksModalOpen, setIsAddTracksModalOpen] = useState(false);
  const [pendingDeleteChoiceTrack, setPendingDeleteChoiceTrack] =
    useState<Track | null>(null);
  const [repeatMode, setRepeatMode] = useState<"off" | "all">("off");
  const selectedAlbumId = searchParams.get("album");

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

  const loadAlbums = useCallback(async () => {
    const response = await fetch("/api/albums", {
      method: "GET",
      cache: "no-store"
    });

    if (!response.ok) {
      setLibraryError("Failed to load albums.");
      return;
    }

    const payload = (await response.json()) as { albums: Album[] };
    setAlbums(payload.albums);
  }, []);

  const selectedAlbumTrackIds = useMemo(() => {
    if (!selectedAlbumId) {
      return [];
    }
    return albums.find((album) => album.id === selectedAlbumId)?.track_ids ?? [];
  }, [albums, selectedAlbumId]);

  const filteredTracks = useMemo(() => {
    const selectedTrackSet = selectedAlbumId
      ? new Set(selectedAlbumTrackIds)
      : null;

    const query = search.trim().toLowerCase();
    return tracks.filter((track) => {
      const inSelectedAlbum =
        !selectedTrackSet || selectedTrackSet.has(track.id);
      const inSearch =
        !query ||
        track.title.toLowerCase().includes(query) ||
        (track.artist || "").toLowerCase().includes(query);

      return inSelectedAlbum && inSearch;
    });
  }, [search, selectedAlbumId, selectedAlbumTrackIds, tracks]);

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

  const deleteEverywhere = async (track: Track, skipConfirm = false) => {
    if (!skipConfirm) {
      const shouldDelete = window.confirm(
        `Delete "${track.title}"? This will remove the song and cover file.`
      );
      if (!shouldDelete) {
        return;
      }
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
    setAlbums((prev) =>
      prev.map((album) => ({
        ...album,
        track_ids: album.track_ids.filter((id) => id !== track.id)
      }))
    );
    setDeletingTrackId(null);
  };

  const removeFromSelectedAlbum = async (track: Track) => {
    if (!selectedAlbumId) {
      return;
    }

    setDeletingTrackId(track.id);
    setLibraryError(null);

    const response = await fetch(`/api/albums/${selectedAlbumId}/tracks`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ trackId: track.id })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setLibraryError(payload?.error || "Failed to remove track from album.");
      setDeletingTrackId(null);
      return;
    }

    setAlbums((prev) =>
      prev.map((album) =>
        album.id === selectedAlbumId
          ? {
              ...album,
              track_ids: album.track_ids.filter((id) => id !== track.id)
            }
          : album
      )
    );
    setDeletingTrackId(null);
  };

  const handleDelete = async (track: Track) => {
    if (selectedAlbumId && selectedAlbumTrackIds.includes(track.id)) {
      setPendingDeleteChoiceTrack(track);
      return;
    }

    await deleteEverywhere(track);
  };

  const handleDeleteChoice = async (mode: DeleteChoiceMode) => {
    if (!pendingDeleteChoiceTrack) {
      return;
    }

    const track = pendingDeleteChoiceTrack;
    setPendingDeleteChoiceTrack(null);

    if (mode === "album") {
      await removeFromSelectedAlbum(track);
      return;
    }

    await deleteEverywhere(track, true);
  };

  const activeQueue = filteredTracks.length ? filteredTracks : tracks;
  const currentTrackIndex = activeQueue.findIndex(
    (track) => track.id === currentTrack?.id
  );
  const selectedAlbumName = selectedAlbumId
    ? albums.find((album) => album.id === selectedAlbumId)?.name ?? "Album"
    : "All tracks";
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

  const handleSelectAlbum = (albumId: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (albumId) {
      params.set("album", albumId);
    } else {
      params.delete("album");
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <main className="min-h-screen bg-black p-3 pb-32 lg:p-4 lg:pb-32">
      <div className="mx-auto w-full max-w-[1400px]">
        <div className="grid gap-3 lg:grid-cols-[76px_minmax(0,1fr)] xl:grid-cols-[76px_minmax(0,1fr)_320px]">
          <aside className="hidden h-[calc(100vh-150px)] flex-col rounded-2xl bg-zinc-950 p-3 lg:flex">
            <div className="mb-2">
              {canManage ? (
                <button
                  type="button"
                  onClick={() => setIsAlbumModalOpen(true)}
                  className="w-full rounded-lg bg-zinc-900 px-2 py-2 text-center text-xs font-semibold text-zinc-200 transition hover:bg-zinc-800"
                  aria-label="Create album"
                  title="Create album"
                >
                  +
                </button>
              ) : null}
            </div>

            <div className="space-y-2 overflow-y-auto">
              <button
                type="button"
                onClick={() => handleSelectAlbum(null)}
                className={`w-full rounded-lg px-2 py-2 text-left text-xs transition ${
                  selectedAlbumId === null
                    ? "bg-zinc-800 text-white"
                    : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                }`}
              >
                All tracks
              </button>

              {albums.map((album) => (
                <button
                  type="button"
                  key={album.id}
                  onClick={() => handleSelectAlbum(album.id)}
                  className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition ${
                    selectedAlbumId === album.id
                      ? "bg-zinc-800"
                      : "bg-zinc-900 hover:bg-zinc-800"
                  }`}
                >
                  {album.cover_signed_url ? (
                    <Image
                      src={album.cover_signed_url}
                      alt={`${album.name} cover`}
                      width={36}
                      height={36}
                      className="h-9 w-9 rounded object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-9 w-9 items-center justify-center rounded bg-zinc-700 text-[10px] text-zinc-300">
                      ♪
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-zinc-100">
                      {album.name}
                    </p>
                    <p className="truncate text-[10px] text-zinc-400">
                      {album.track_ids.length} tracks
                    </p>
                  </div>
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
                <p className="text-xs text-zinc-400">
                  {userEmail} - {selectedAlbumName}
                </p>
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

            {canManage && selectedAlbumId ? (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setIsAddTracksModalOpen(true)}
                  className="rounded-full border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-100 hover:bg-zinc-900"
                >
                  Add songs to album
                </button>
              </div>
            ) : null}

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

        {canManage && isAlbumModalOpen ? (
          <CreateAlbumModal
            tracks={tracks}
            onClose={() => setIsAlbumModalOpen(false)}
            onCreated={async () => {
              await loadAlbums();
            }}
          />
        ) : null}

        {canManage && selectedAlbumId && isAddTracksModalOpen ? (
          <AddTracksToAlbumModal
            albumId={selectedAlbumId}
            tracks={tracks}
            existingTrackIds={selectedAlbumTrackIds}
            onClose={() => setIsAddTracksModalOpen(false)}
            onAdded={(trackIds) => {
              setAlbums((prev) =>
                prev.map((album) =>
                  album.id === selectedAlbumId
                    ? {
                        ...album,
                        track_ids: [...new Set([...album.track_ids, ...trackIds])]
                      }
                    : album
                )
              );
            }}
          />
        ) : null}

        {pendingDeleteChoiceTrack ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
            <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-black p-4 shadow-2xl">
              <h3 className="text-base font-semibold text-zinc-100">
                Delete track
              </h3>
              <p className="mt-2 text-sm text-zinc-300">
                &quot;{pendingDeleteChoiceTrack.title}&quot; is in this album. Choose what to do:
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleDeleteChoice("album")}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs font-medium text-zinc-100 hover:bg-zinc-900"
                >
                  Remove from album
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteChoice("all")}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-black hover:bg-zinc-300"
                >
                  Delete everywhere
                </button>
                <button
                  type="button"
                  onClick={() => setPendingDeleteChoiceTrack(null)}
                  className="rounded-full border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-900"
                >
                  Cancel
                </button>
              </div>
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
