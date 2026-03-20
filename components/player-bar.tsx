"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ARTIST } from "@/lib/constants";
import { Track } from "@/types/track";

type PlayerBarProps = {
  track: Track | null;
  signedUrl: string | null;
  hasPrevious: boolean;
  hasNext: boolean;
  repeatMode: "off" | "one";
  onToggleRepeat: () => void;
  onPrevious: () => Promise<void> | void;
  onNext: () => Promise<void> | void;
  onEnded: (audio: HTMLAudioElement) => Promise<void> | void;
};

function formatTime(value: number) {
  if (!Number.isFinite(value) || value < 0) {
    return "0:00";
  }

  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function PreviousIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M6 5h2v14H6V5zm12.5 1.2L9.8 12l8.7 5.8V6.2z" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M16 5h2v14h-2V5zM5.5 6.2v11.6l8.7-5.8-8.7-5.8z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true">
      <path d="M8 5.5v13l10-6.5-10-6.5z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true">
      <path d="M7 5h4v14H7V5zm6 0h4v14h-4V5z" />
    </svg>
  );
}

function VolumeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M3 10v4h4l5 4V6L7 10H3zm12.5 2a4.5 4.5 0 00-2.5-4.03v8.06A4.5 4.5 0 0015.5 12zm0-8.5v2.06a8 8 0 010 12.88v2.06a10 10 0 000-16.99z" />
    </svg>
  );
}

export function PlayerBar({
  track,
  signedUrl,
  hasPrevious,
  hasNext,
  repeatMode,
  onToggleRepeat,
  onPrevious,
  onNext,
  onEnded
}: PlayerBarProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [lastVolume, setLastVolume] = useState(80);
  const isReplayActive = repeatMode === "one";
  const volumeDisplay = isMuted ? 0 : volume;

  useEffect(() => {
    if (!audioRef.current || !signedUrl) {
      return;
    }

    const audio = audioRef.current;
    let cancelled = false;

    const startPlayback = async () => {
      try {
        audio.load();
        await audio.play();
      } catch (error) {
        // Rapid track switching can interrupt a pending play() with AbortError.
        if (cancelled) {
          return;
        }

        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
    };
  }, [signedUrl]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    const audio = audioRef.current;
    audio.volume = Math.max(0, Math.min(1, volume / 100));
    audio.muted = isMuted;
  }, [isMuted, volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) {
      return;
    }

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration || 0);
    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTrackEnded = () => {
      setIsPlaying(false);
      void onEnded(audio);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onTrackEnded);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onTrackEnded);
    };
  }, [onEnded]);

  const progressPercent = useMemo(() => {
    if (!duration) {
      return 0;
    }
    return (currentTime / duration) * 100;
  }, [currentTime, duration]);

  const togglePlayPause = async () => {
    if (!audioRef.current || !signedUrl) {
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      return;
    }

    await audioRef.current.play();
  };

  const handleSeek = (value: number) => {
    if (!audioRef.current || !duration) {
      return;
    }

    const nextTime = (value / 100) * duration;
    audioRef.current.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handleVolumeChange = (nextVolume: number) => {
    const clamped = Math.max(0, Math.min(100, nextVolume));
    setVolume(clamped);
    setIsMuted(clamped === 0);
    if (clamped > 0) {
      setLastVolume(clamped);
    }
  };

  const toggleMute = () => {
    if (isMuted || volume === 0) {
      const restore = lastVolume > 0 ? lastVolume : 80;
      setVolume(restore);
      setIsMuted(false);
      return;
    }

    setLastVolume(volume);
    setIsMuted(true);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-zinc-800 bg-black/95 px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 backdrop-blur">
      <div className="mx-auto grid w-full max-w-[1400px] gap-2 md:grid-cols-[1fr_1.4fr_1fr] md:items-center">
        <div className="flex items-center gap-3 md:min-w-0">
          {track?.cover_signed_url ? (
            <Image
              src={track.cover_signed_url}
              alt={`${track.title} cover`}
              width={44}
              height={44}
              className="h-11 w-11 rounded-md object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-md bg-zinc-800 text-zinc-300">
              ♪
            </div>
          )}

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-100">
              {track ? track.title : "No track selected"}
            </p>
            <p className="truncate text-xs text-zinc-400">
              {track?.artist || DEFAULT_ARTIST}
            </p>
          </div>

        </div>

        <div className="space-y-1 md:space-y-1">
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onToggleRepeat}
              className={`relative rounded-full p-2 transition ${
                isReplayActive
                  ? "text-emerald-400 hover:text-emerald-300"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
              aria-label={`Replay mode: ${repeatMode}`}
              title={`Replay: ${repeatMode}`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 fill-current"
                aria-hidden="true"
              >
                <path d="M17 1l4 4-4 4V6H7a3 3 0 00-3 3v1H2V9a5 5 0 015-5h10V1zM7 23l-4-4 4-4v3h10a3 3 0 003-3v-1h2v1a5 5 0 01-5 5H7v3z" />
              </svg>
              {isReplayActive ? (
                <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />
              ) : null}
            </button>
            <button
              type="button"
              onClick={() => void onPrevious()}
              disabled={!hasPrevious}
              className="rounded-full p-2 text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous track"
            >
              <PreviousIcon />
            </button>
            <button
              type="button"
              onClick={() => void togglePlayPause()}
              disabled={!signedUrl}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100 text-black transition hover:scale-105 hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-500 disabled:text-zinc-700"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              type="button"
              onClick={() => void onNext()}
              disabled={!hasNext}
              className="rounded-full p-2 text-zinc-300 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next track"
            >
              <NextIcon />
            </button>

            <div className="ml-2 hidden items-center gap-2 md:flex">
              <button
                type="button"
                onClick={toggleMute}
                className="text-zinc-300 transition hover:text-white"
                aria-label={isMuted ? "Unmute" : "Mute"}
                title={isMuted ? "Unmute" : "Mute"}
              >
                <VolumeIcon />
              </button>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={volumeDisplay}
                onChange={(event) => handleVolumeChange(Number(event.target.value))}
                className="volume-slider h-1 w-20 cursor-pointer appearance-none rounded-lg"
                style={{
                  background: `linear-gradient(to right, #a1a1aa 0%, #a1a1aa ${volumeDisplay}%, #3f3f46 ${volumeDisplay}%, #3f3f46 100%)`
                }}
                aria-label="Volume"
              />
            </div>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progressPercent}
            onChange={(event) => handleSeek(Number(event.target.value))}
            className="w-full accent-zinc-200"
            disabled={!signedUrl}
            aria-label="Seek"
          />
          <div className="flex justify-between text-[11px] text-zinc-400">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        <div className="hidden md:block" />

        <audio ref={audioRef} className="hidden">
          {signedUrl ? <source src={signedUrl} /> : null}
        </audio>
      </div>
    </div>
  );
}
