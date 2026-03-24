"use client";

import { FormEvent, useState } from "react";
import { createImageThumbnailFile } from "@/lib/client/image-thumbnail";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { Album } from "@/types/album";

const SONGS_BUCKET = "songs";

type EditAlbumModalProps = {
  album: Album;
  onClose: () => void;
  onUpdated: () => Promise<void> | void;
};

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export function EditAlbumModal({ album, onClose, onUpdated }: EditAlbumModalProps) {
  const supabase = createBrowserSupabaseClient();
  const [name, setName] = useState(album.name);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverThumbFile, setCoverThumbFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    let coverStoragePath: string | undefined;
    let coverThumbStoragePath: string | undefined;

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

      if (coverThumbFile) {
        const safeThumbFilename = sanitizeFilename(coverThumbFile.name);
        coverThumbStoragePath = `cover-thumbs/${crypto.randomUUID()}-${safeThumbFilename}`;

        const { error: uploadThumbError } = await supabase.storage
          .from(SONGS_BUCKET)
          .upload(coverThumbStoragePath, coverThumbFile, {
            cacheControl: "31536000",
            upsert: false
          });

        if (uploadThumbError) {
          setError(uploadThumbError.message);
          setLoading(false);
          return;
        }
      }
    }

    const response = await fetch(`/api/albums/${album.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name,
        ...(coverStoragePath ? { coverStoragePath } : {}),
        ...(coverThumbStoragePath ? { coverThumbStoragePath } : {})
      })
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      setError(payload?.error || "Failed to update album.");
      setLoading(false);
      return;
    }

    setLoading(false);
    await onUpdated();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-zinc-800 bg-black p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-zinc-100">Edit album</h2>
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
            onChange={async (event) => {
              const nextCover = event.target.files?.[0] ?? null;
              setCoverFile(nextCover);
              if (!nextCover) {
                setCoverThumbFile(null);
                return;
              }
              const thumb = await createImageThumbnailFile(nextCover);
              setCoverThumbFile(thumb);
            }}
            className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-100"
          />

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
            {loading ? "Saving..." : "Save album"}
          </button>
        </form>
      </div>
    </div>
  );
}
