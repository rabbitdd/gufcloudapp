"use client";

import { FormEvent, useState } from "react";
import { createImageThumbnailFile } from "@/lib/client/image-thumbnail";
import { DEFAULT_ARTIST } from "@/lib/constants";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const SONGS_BUCKET = "songs";

type UploadSongFormProps = {
  onUploaded: () => Promise<void> | void;
};

function inferTitle(filename: string) {
  return filename.replace(/\.[^/.]+$/, "").replace(/[_-]+/g, " ").trim();
}

function sanitizeFilename(filename: string) {
  return filename
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-");
}

export function UploadSongForm({ onUploaded }: UploadSongFormProps) {
  const supabase = createBrowserSupabaseClient();
  const [file, setFile] = useState<File | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverThumbFile, setCoverThumbFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    if (selectedFile && !title) {
      setTitle(inferTitle(selectedFile.name));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) {
      setError("Please choose an audio file.");
      return;
    }

    setUploading(true);
    setError(null);

    const {
      data: { user },
      error: userError
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError("Session expired. Please sign in again.");
      setUploading(false);
      return;
    }

    const safeFilename = sanitizeFilename(file.name);
    const storagePath = `tracks/${crypto.randomUUID()}-${safeFilename}`;
    let coverStoragePath: string | null = null;
    let coverThumbStoragePath: string | null = null;

    const { error: uploadError } = await supabase.storage
      .from(SONGS_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false
      });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(false);
      return;
    }

    if (coverFile) {
      const safeCoverFilename = sanitizeFilename(coverFile.name);
      coverStoragePath = `covers/${crypto.randomUUID()}-${safeCoverFilename}`;

      const { error: coverUploadError } = await supabase.storage
        .from(SONGS_BUCKET)
        .upload(coverStoragePath, coverFile, {
          cacheControl: "3600",
          upsert: false
        });

      if (coverUploadError) {
        setError(coverUploadError.message);
        setUploading(false);
        return;
      }

      if (coverThumbFile) {
        const safeThumbFilename = sanitizeFilename(coverThumbFile.name);
        coverThumbStoragePath = `cover-thumbs/${crypto.randomUUID()}-${safeThumbFilename}`;

        const { error: thumbUploadError } = await supabase.storage
          .from(SONGS_BUCKET)
          .upload(coverThumbStoragePath, coverThumbFile, {
            cacheControl: "31536000",
            upsert: false
          });

        if (thumbUploadError) {
          setError(thumbUploadError.message);
          setUploading(false);
          return;
        }
      }
    }

    const trackTitle = title.trim() || inferTitle(file.name);
    const artistValue = artist.trim() || DEFAULT_ARTIST;

    const { error: insertError } = await supabase.from("tracks").insert({
      title: trackTitle,
      artist: artistValue,
      storage_path: storagePath,
      cover_storage_path: coverStoragePath,
      cover_thumb_storage_path: coverThumbStoragePath,
      uploaded_by: user.id
    });

    if (insertError) {
      setError(insertError.message);
      setUploading(false);
      return;
    }

    setFile(null);
    setCoverFile(null);
    setCoverThumbFile(null);
    setTitle("");
    setArtist("");
    setUploading(false);
    await onUploaded();
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950 p-4"
    >
      <h2 className="text-sm font-semibold text-white">Upload song</h2>

      <input
        type="file"
        accept="audio/*"
        required
        onChange={(event) => handleFileChange(event.target.files?.[0] ?? null)}
        className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-black"
      />

      <input
        type="file"
        accept="image/*"
        onChange={async (event) => {
          const nextCoverFile = event.target.files?.[0] ?? null;
          setCoverFile(nextCoverFile);
          if (!nextCoverFile) {
            setCoverThumbFile(null);
            return;
          }
          const thumb = await createImageThumbnailFile(nextCoverFile);
          setCoverThumbFile(thumb);
        }}
        className="w-full text-sm text-zinc-300 file:mr-3 file:rounded-md file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-100"
      />

      <input
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Title"
        className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
      />

      <input
        type="text"
        value={artist}
        onChange={(event) => setArtist(event.target.value)}
        placeholder="Artist (optional)"
        className="w-full rounded-lg border border-zinc-800 bg-black px-3 py-2 text-sm text-zinc-100 outline-none ring-zinc-500 focus:ring-2"
      />

      {error ? (
        <p className="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-zinc-200">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={uploading}
        className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-black transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-500"
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </form>
  );
}
