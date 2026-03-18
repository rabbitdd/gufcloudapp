import Image from "next/image";
import { DEFAULT_ARTIST } from "@/lib/constants";
import { Track } from "@/types/track";

type TrackListProps = {
  tracks: Track[];
  currentTrackId: string | null;
  loadingTrackId: string | null;
  deletingTrackId: string | null;
  onPlay: (track: Track) => Promise<void> | void;
  onDelete: (track: Track) => Promise<void> | void;
};

function formatDate(value: string) {
  const date = new Date(value);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CoverPreview({ coverUrl, title }: { coverUrl: string | null | undefined; title: string }) {
  if (!coverUrl) {
    return (
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-zinc-800 text-xs font-semibold text-zinc-300">
        ♪
      </div>
    );
  }

  return (
    <Image
      src={coverUrl}
      alt={`${title} cover`}
      width={48}
      height={48}
      className="h-12 w-12 shrink-0 rounded-md object-cover"
      unoptimized
    />
  );
}

export function TrackList({
  tracks,
  currentTrackId,
  loadingTrackId,
  deletingTrackId,
  onPlay,
  onDelete
}: TrackListProps) {
  if (!tracks.length) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 text-sm text-zinc-300">
        No songs yet. Upload your first track.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950">
      <ul className="divide-y divide-zinc-900">
        {tracks.map((track) => {
          const isCurrent = currentTrackId === track.id;
          const isLoading = loadingTrackId === track.id;
          const isDeleting = deletingTrackId === track.id;

          return (
            <li
              key={track.id}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <CoverPreview
                  coverUrl={track.cover_signed_url}
                  title={track.title}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {track.title}
                  </p>
                  <p className="truncate text-xs text-zinc-400">
                    {track.artist || DEFAULT_ARTIST} - {formatDate(track.created_at)}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPlay(track)}
                  disabled={isLoading || isDeleting}
                  className="rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-black transition hover:bg-zinc-300 disabled:cursor-not-allowed disabled:bg-zinc-500"
                >
                  {isLoading
                    ? "Loading..."
                    : isCurrent
                      ? "Playing"
                      : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(track)}
                  disabled={isDeleting || isLoading}
                  className="rounded-full border border-zinc-700 p-2 text-zinc-300 transition hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Delete ${track.title}`}
                  title="Delete track"
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-4 w-4 fill-current"
                    aria-hidden="true"
                  >
                    <path d="M9 3h6l1 2h4v2H4V5h4l1-2zm-2 6h2v9H7V9zm4 0h2v9h-2V9zm4 0h2v9h-2V9z" />
                  </svg>
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
