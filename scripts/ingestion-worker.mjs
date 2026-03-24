import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvFile(path) {
  try {
    const content = readFileSync(path, "utf8");
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) {
        continue;
      }
      const separatorIndex = line.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = line.slice(0, separatorIndex).trim();
      if (!key || process.env[key] !== undefined) {
        continue;
      }

      let value = line.slice(separatorIndex + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // Ignore missing env file. Shell-provided vars can still be used.
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const pollMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 3000);
const runOnce = process.env.WORKER_ONCE === "1";

if (!supabaseUrl || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY for ingestion worker."
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function claimNextJob() {
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

  const candidate = candidates?.[0];
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

  return claimed ?? null;
}

async function markDone(jobId) {
  await supabase
    .from("processing_jobs")
    .update({
      status: "done",
      finished_at: new Date().toISOString()
    })
    .eq("id", jobId);
}

async function markFailed(job, message) {
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

async function handleExtractMetadata(job) {
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

async function processJob(job) {
  if (job.job_type === "extract_metadata") {
    await handleExtractMetadata(job);
    await markDone(job.id);
    return;
  }

  throw new Error(`Unsupported job type: ${job.job_type}`);
}

async function tick() {
  const job = await claimNextJob();
  if (!job) {
    return false;
  }

  try {
    await processJob(job);
    console.log(`[worker] processed job ${job.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[worker] job ${job.id} failed: ${message}`);
    await markFailed(job, message);
  }

  return true;
}

async function main() {
  console.log(`[worker] ingestion worker started (poll=${pollMs}ms)`);
  do {
    const didWork = await tick();
    if (!didWork) {
      await sleep(pollMs);
    }
  } while (!runOnce);
}

main().catch((error) => {
  console.error("[worker] fatal error:", error);
  process.exit(1);
});
