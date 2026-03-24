import { NextResponse } from "next/server";
import { createServerAdminSupabaseClient } from "@/lib/supabase/admin";

type ProcessingJob = {
  id: string;
  job_type: string;
  track_id: string;
  asset_id: string | null;
  attempts: number;
  max_attempts: number;
};

const DEFAULT_BATCH_SIZE = 5;

function getBatchSize() {
  const parsed = Number(process.env.INGESTION_TICK_BATCH_SIZE ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_BATCH_SIZE;
  }
  return Math.min(Math.floor(parsed), 25);
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Allow local/manual testing when secret is not configured.
    return process.env.NODE_ENV !== "production";
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

async function claimNextJob(supabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>) {
  const { data: candidates, error } = await supabase
    .from("processing_jobs")
    .select("id,job_type,track_id,asset_id,attempts,max_attempts")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw new Error(`Failed to read jobs: ${error.message}`);
  }

  const candidate = candidates?.[0] as ProcessingJob | undefined;
  if (!candidate) {
    return null;
  }

  const nextAttempts = Number(candidate.attempts ?? 0) + 1;
  const { data: claimed, error: claimError } = await supabase
    .from("processing_jobs")
    .update({
      status: "running",
      attempts: nextAttempts,
      started_at: new Date().toISOString(),
      last_error: null
    })
    .eq("id", candidate.id)
    .eq("status", "pending")
    .select("id,job_type,track_id,asset_id,attempts,max_attempts")
    .maybeSingle();

  if (claimError) {
    throw new Error(`Failed to claim job: ${claimError.message}`);
  }

  return (claimed as ProcessingJob | null) ?? null;
}

async function markDone(
  supabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>,
  jobId: string
) {
  await supabase
    .from("processing_jobs")
    .update({
      status: "done",
      finished_at: new Date().toISOString()
    })
    .eq("id", jobId);
}

async function markFailed(
  supabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>,
  job: ProcessingJob,
  message: string
) {
  const attempts = Number(job.attempts ?? 0);
  const maxAttempts = Number(job.max_attempts ?? 5);
  const shouldRetry = attempts < maxAttempts;

  await supabase
    .from("processing_jobs")
    .update({
      status: shouldRetry ? "pending" : "failed",
      scheduled_at: shouldRetry
        ? new Date(Date.now() + 30_000).toISOString()
        : new Date().toISOString(),
      finished_at: shouldRetry ? null : new Date().toISOString(),
      last_error: message
    })
    .eq("id", job.id);

  await supabase
    .from("tracks")
    .update({
      processing_status: shouldRetry ? "pending" : "failed"
    })
    .eq("id", job.track_id);
}

async function handleExtractMetadata(
  supabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>,
  job: ProcessingJob
) {
  const { data: asset, error: assetError } = await supabase
    .from("track_assets")
    .select("id,track_id,storage_path")
    .eq("id", job.asset_id)
    .maybeSingle();

  if (assetError) {
    throw new Error(assetError.message);
  }
  if (!asset?.storage_path) {
    throw new Error("Original asset not found for job.");
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("songs")
    .createSignedUrl(asset.storage_path, 60);

  if (signError || !signed?.signedUrl) {
    throw new Error(signError?.message || "Failed to create signed url.");
  }

  const response = await fetch(signed.signedUrl, { method: "HEAD" });
  const mimeType = response.headers.get("content-type");

  const { error: updateAssetError } = await supabase
    .from("track_assets")
    .update({
      mime_type: mimeType,
      is_playable: true,
      is_primary: true
    })
    .eq("id", asset.id);

  if (updateAssetError) {
    throw new Error(updateAssetError.message);
  }

  const { error: trackUpdateError } = await supabase
    .from("tracks")
    .update({ processing_status: "ready" })
    .eq("id", job.track_id);

  if (trackUpdateError) {
    throw new Error(trackUpdateError.message);
  }
}

async function processJob(
  supabase: NonNullable<ReturnType<typeof createServerAdminSupabaseClient>>,
  job: ProcessingJob
) {
  if (job.job_type === "extract_metadata") {
    await handleExtractMetadata(supabase, job);
    await markDone(supabase, job.id);
    return;
  }

  throw new Error(`Unsupported job type: ${job.job_type}`);
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServerAdminSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "Missing SUPABASE_SERVICE_ROLE_KEY." },
      { status: 500 }
    );
  }

  const batchSize = getBatchSize();
  let processed = 0;
  const failures: Array<{ jobId: string; error: string }> = [];

  for (let i = 0; i < batchSize; i += 1) {
    const job = await claimNextJob(supabase);
    if (!job) {
      break;
    }

    try {
      await processJob(supabase, job);
      processed += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ jobId: job.id, error: message });
      await markFailed(supabase, job, message);
    }
  }

  return NextResponse.json({
    processed,
    failed: failures.length,
    failures
  });
}
