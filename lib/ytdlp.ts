import { spawn } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const UPLOADS_DIR = process.env.UPLOADS_DIR || "./uploads";
const MAX_MB = Number(process.env.VIDEO_MAX_SIZE_MB || 500);

export type VideoMetadata = {
  title?: string;
  thumbnail?: string;
  duration?: number;
  extractor?: string;
  id?: string;
};

export async function hasYtDlp(): Promise<boolean> {
  return new Promise((resolve) => {
    const p = spawn("yt-dlp", ["--version"], { shell: true });
    p.on("error", () => resolve(false));
    p.on("exit", (code) => resolve(code === 0));
  });
}

export async function fetchMetadata(url: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const p = spawn(
      "yt-dlp",
      ["--dump-json", "--no-warnings", "--skip-download", url],
      { shell: true }
    );
    p.stdout.on("data", (c) => chunks.push(c));
    p.stderr.on("data", (c) => errChunks.push(c));
    p.on("error", reject);
    p.on("exit", (code) => {
      if (code !== 0) {
        return reject(new Error(Buffer.concat(errChunks).toString().slice(0, 500) || "yt-dlp נכשל"));
      }
      try {
        const j = JSON.parse(Buffer.concat(chunks).toString());
        resolve({
          title: j.title,
          thumbnail: j.thumbnail,
          duration: j.duration,
          extractor: j.extractor_key,
          id: j.id,
        });
      } catch (e) {
        reject(new Error("yt-dlp metadata parse failed"));
      }
    });
  });
}

export async function downloadVideo(url: string, sourceId: string): Promise<{ localPath: string; size: number }> {
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  const outPath = path.resolve(UPLOADS_DIR, `${sourceId}.mp4`);

  return new Promise((resolve, reject) => {
    const errChunks: Buffer[] = [];
    const p = spawn(
      "yt-dlp",
      [
        url,
        "--format",
        "bestvideo[height<=720]+bestaudio/best[height<=720]",
        "--merge-output-format",
        "mp4",
        "--max-filesize",
        `${MAX_MB}m`,
        "--no-warnings",
        "--no-playlist",
        "-o",
        outPath,
      ],
      { shell: true }
    );
    p.stderr.on("data", (c) => errChunks.push(c));
    p.on("error", reject);
    p.on("exit", async (code) => {
      if (code !== 0) {
        return reject(new Error(Buffer.concat(errChunks).toString().slice(0, 500) || "yt-dlp download failed"));
      }
      try {
        const stat = await fs.stat(outPath);
        resolve({ localPath: outPath, size: stat.size });
      } catch (e) {
        reject(new Error("downloaded file not found"));
      }
    });
  });
}
