import { createHmac, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { parseNetworkId, type NetworkId } from "@/lib/chain";
import { getNetworkId } from "@/lib/chain-server";

// Streams the demo video from the project's Railway bucket. Buckets are
// private, but bucket egress is free, so instead of proxying ~25 MB through
// this service we mint a short-lived SigV4 presigned URL and 302 the browser
// to the bucket, which serves Range requests itself.
//
// There is one film per network, rendered from the same source in video/, so the
// run a visitor watches matches the network they picked: the settlement films
// show a payment landing in that chain's asset, and the Midnight one shows
// Nightpass proving entitlement without disclosing a buyer. Switching switches
// the film.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ENDPOINT = process.env.DEMO_BUCKET_ENDPOINT || "https://t3.storageapi.dev";
const BUCKET = process.env.DEMO_BUCKET_NAME || "";
const KEY_ID = process.env.DEMO_BUCKET_KEY_ID || "";
const SECRET = process.env.DEMO_BUCKET_SECRET || "";
/** The pre-chain-picker film, and the fallback if a chain has no film uploaded. */
const FALLBACK_OBJECT = process.env.DEMO_BUCKET_OBJECT || "agentifyos-demo.mp4";
const OBJECTS: Record<NetworkId, string> = {
  algorand: process.env.DEMO_BUCKET_OBJECT_ALGORAND || FALLBACK_OBJECT,
  casper: process.env.DEMO_BUCKET_OBJECT_CASPER || FALLBACK_OBJECT,
  midnight: process.env.DEMO_BUCKET_OBJECT_MIDNIGHT || FALLBACK_OBJECT,
};
const REGION = "auto";
const EXPIRES = 3600;

const hmac = (key: Buffer | string, data: string) =>
  createHmac("sha256", key).update(data).digest();
const sha256 = (data: string) => createHash("sha256").update(data).digest("hex");

function presign(object: string): string {
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
    `/${object}`,
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

  return `https://${host}/${object}?${params.toString()}&X-Amz-Signature=${signature}`;
}

export async function GET(req: Request) {
  if (!BUCKET || !KEY_ID || !SECRET) {
    return NextResponse.json({ error: "demo_video_not_configured" }, { status: 404 });
  }
  // The query param exists so the <video> element's src changes when a visitor
  // switches networks, which is what makes the browser fetch the other film
  // instead of reusing the one it already has. It is visitor-supplied, so it is
  // narrowed to a known id; anything else falls back to the request's cookie.
  const asked = parseNetworkId(new URL(req.url).searchParams.get("chain"));
  const network = asked ?? (await getNetworkId());
  return NextResponse.redirect(presign(OBJECTS[network]), {
    status: 302,
    headers: { "Cache-Control": "no-store, private" },
  });
}
