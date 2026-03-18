"use client";

import Image from "next/image";
import { FormEvent, useMemo, useState } from "react";
import { DEFAULT_ARTIST } from "@/lib/constants";
import { Track } from "@/types/track";

type AddTracksToAlbumModalProps = {
  albumId: string;
  tracks: Track[];
  existingTrackIds: string[];
  onClose: () => void;
  onAdded: (trackIds: string[]) => void;
};

export function AddTracksToAlbumModal({
  albumId,
  tracks,
  existingTrackIds,
  onClose,
  onAdded
}: AddTracksToAlbumModalProps) {
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tracks.filter((track) => {
      if (existingTrackIds.includes(track.id)) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        track.title.toLowerCase().includes(query) ||
        (track.artist || "").toLowerCase().includes(query)
      );
    });
  }, [existingTrackIds, search, tracks]);

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTrackIds.length) {
      setError("Select at least one track.");
      return;
    }

    setLoading(true);
    setError(null);

    for (const trackId of selectedTrackIds) {
      const response = await fetch(`/api/albums/${albumId}/tracks`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ trackId })
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        setError(payload?.error || "Failed to add tracks.");
        setLoading(false);
        return;
      }
    }

    onAdded(selectedTrackIds);
    setLoading(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-800 bg-black p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">
            Add songs to album
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-900"
          >
            Close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tracks"
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />

          <div className="max-h-72 overflow-y-auto rounded-lg border border-zinc-800">
            {availableTracks.length ? (
              <ul className="divide-y divide-zinc-900">
                {availableTracks.map((track) => {
                  const checked = selectedTrackIds.includes(track.id);

                  return (
                    <li key={track.id}>
                      <button
                        type="button"
                        onClick={() => toggleTrack(track.id)}
                        className={`flex w-full items-center gap-3 px-3 py-2 text-left transition ${
                          checked
                            ? "bg-zinc-800/80 ring-1 ring-zinc-600"
                            : "hover:bg-zinc-900"
                        }`}
                        aria-pressed={checked}
                      >
                        {track.cover_signed_url ? (
                          <Image
                            src={track.cover_signed_url}
                            alt={`${track.title} cover`}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-300">
                            ♪
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-zinc-100">
                            {track.title}
                          </p>
                          <p className="truncate text-xs text-zinc-400">
                            {track.artist || DEFAULT_ARTIST}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="p-3 text-sm text-zinc-400">
                All available songs are already in this album.
              </p>
            )}
          </div>

          {error ? (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading || !availableTracks.length}
            className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {loading
              ? "Adding..."
              : `Add selected songs (${selectedTrackIds.length})`}
          </button>
        </form>
      </div>
    </div>
  );
}
