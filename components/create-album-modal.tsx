"use client";

import { FormEvent, useMemo, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Track } from "@/types/track";

const SONGS_BUCKET = "songs";

type CreateAlbumModalProps = {
  tracks: Track[];
  onCreated: () => Promise<void> | void;
  onClose: () => void;
};

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export function CreateAlbumModal({
  tracks,
  onCreated,
  onClose
}: CreateAlbumModalProps) {
  const supabase = createBrowserSupabaseClient();
  const [name, setName] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedTracks = useMemo(
    () =>
      [...tracks].sort((a, b) =>
        a.title.toLowerCase().localeCompare(b.title.toLowerCase())
      ),
    [tracks]
  );

  const toggleTrack = (trackId: string) => {
    setSelectedTrackIds((prev) => {
      if (prev.includes(trackId)) {
        return prev.filter((id) => id !== trackId);
      }
      return [...prev, trackId];
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    let coverStoragePath: string | null = null;

    if (coverFile) {
      const safeCoverFilename = sanitizeFilename(coverFile.name);
      coverStoragePath = `albums/${crypto.randomUUID()}-${safeCoverFilename}`;

      const { error: uploadCoverError } = await supabase.storage
        .from(SONGS_BUCKET)
        .upload(coverStoragePath, coverFile, {
          cacheControl: "3600",
          upsert: false
        });

      if (uploadCoverError) {
        setError(uploadCoverError.message);
        setLoading(false);
        return;
      }
    }

    const response = await fetch("/api/albums", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        coverStoragePath,
        trackIds: selectedTrackIds
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Failed to create album.");
      setLoading(false);
      return;
    }

    setLoading(false);
    await onCreated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-800 bg-black p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Create album</h2>
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
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Album name"
            required
            className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
          />

          <input
            type="file"
            accept="image/*"
            onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
            className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-100"
          />

          <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 p-3">
            {sortedTracks.length ? (
              sortedTracks.map((track) => {
                const checked = selectedTrackIds.includes(track.id);
                return (
                  <label
                    key={track.id}
                    className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-900"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleTrack(track.id)}
                      className="accent-zinc-200"
                    />
                    <span className="truncate text-sm text-zinc-200">
                      {track.title}
                    </span>
                  </label>
                );
              })
            ) : (
              <p className="text-sm text-zinc-400">No tracks to add yet.</p>
            )}
          </div>

          {error ? (
            <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-black hover:bg-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-500"
          >
            {loading ? "Creating..." : "Create album"}
          </button>
        </form>
      </div>
    </div>
  );
}
