import { createHmac, createHash } from "node:crypto";
import { NextResponse } from "next/server";

// Serves the whitepaper from the project's Railway bucket (the same private
// bucket the demo video lives in, so it reuses the DEMO_BUCKET_* credentials).
// Bucket egress is free: mint a short-lived SigV4 presigned URL and 302 the
// client to the bucket rather than proxying the bytes through this service.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = process.env.DEMO_BUCKET_ENDPOINT || "https://t3.storageapi.dev";
const BUCKET = process.env.DEMO_BUCKET_NAME || "";
const KEY_ID = process.env.DEMO_BUCKET_KEY_ID || "";
const SECRET = process.env.DEMO_BUCKET_SECRET || "";
const OBJECT = process.env.WHITEPAPER_BUCKET_OBJECT || "whitepaper.pdf";
const REGION = "auto";
const EXPIRES = 3600;

const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();
const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");

function presign(): string {
  const host = `${BUCKET}.${new URL(ENDPOINT).host}`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${REGION}/s3/aws4_request`;

  const params = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${KEY_ID}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(EXPIRES),
    "X-Amz-SignedHeaders": "host",
  });
  params.sort();

  const canonical = [
    "GET",
    `/${OBJECT}`,
    params.toString(),
    `host:${host}\n`,
    "host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");

  const toSign = ["AWS4-HMAC-SHA256", amzDate, scope, sha256(canonical)].join("\n");
  const kDate = hmac("AWS4" + SECRET, date);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, "s3");
  const kSigning = hmac(kService, "aws4_request");
  const signature = hmac(kSigning, toSign).toString("hex");

  return `https://${host}/${OBJECT}?${params.toString()}&X-Amz-Signature=${signature}`;
}

export async function GET() {
  if (!BUCKET || !KEY_ID || !SECRET) {
    return NextResponse.json({ error: "whitepaper_not_configured" }, { status: 404 });
  }
  return NextResponse.redirect(presign(), {
    status: 302,
    headers: { "Cache-Control": "no-store, private" },
  });
}
