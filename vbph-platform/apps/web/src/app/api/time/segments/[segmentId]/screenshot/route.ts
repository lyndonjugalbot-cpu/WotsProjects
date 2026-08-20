import { withApiAuth, requireApiRole, ApiRequestError } from "@/lib/api/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ALLOWED_SCREENSHOT_MIME_TYPES, MAX_SCREENSHOT_BYTES } from "@vbph/schemas";
import { uploadScreenshot } from "@/server/time-tracking/service";

type AllowedMimeType = (typeof ALLOWED_SCREENSHOT_MIME_TYPES)[number];

const EXTENSION_BY_MIME: Record<AllowedMimeType, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * A `Blob`'s `.type` is whatever the caller claims it is — trivially
 * spoofable (any script can construct `new Blob([anyBytes], {type:
 * "image/jpeg"})` regardless of what `anyBytes` actually contains).
 * Checking it against ALLOWED_SCREENSHOT_MIME_TYPES above only rejects an
 * obviously-wrong claimed type; it says nothing about the actual file
 * content. This checks the real magic bytes for each of the three
 * allowed formats, so a mislabeled upload (e.g. an HTML/SVG file claiming
 * to be a JPEG) is rejected before it ever reaches Storage, regardless of
 * what Content-Type the client attached.
 */
function matchesMagicBytes(bytes: Uint8Array, contentType: AllowedMimeType): boolean {
  switch (contentType) {
    case "image/png":
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      );
    case "image/jpeg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
  }
}

/**
 * POST /api/time/segments/:segmentId/screenshot — Upload Screenshot.
 * multipart/form-data with a `file` field. Stored in the private
 * `screenshots` Storage bucket (never public — see the time_tracking_api
 * migration); the response includes a short-lived signed URL, not the
 * raw storage path.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ segmentId: string }> }
) {
  const { segmentId } = await params;
  return withApiAuth(request, async ({ supabase, user }) => {
    requireApiRole(user, "VA");

    const formData = await request.formData().catch(() => null);
    const file = formData?.get("file");
    if (!file || !(file instanceof Blob)) {
      throw new ApiRequestError(422, "Expected multipart/form-data with a 'file' field.");
    }

    const rawContentType = file.type;
    if (!ALLOWED_SCREENSHOT_MIME_TYPES.includes(rawContentType as AllowedMimeType)) {
      throw new ApiRequestError(415, `Unsupported file type: ${rawContentType || "unknown"}.`);
    }
    if (file.size > MAX_SCREENSHOT_BYTES) {
      throw new ApiRequestError(413, "Screenshot exceeds the maximum allowed size.");
    }
    const contentType = rawContentType as AllowedMimeType;

    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!matchesMagicBytes(bytes, contentType)) {
      throw new ApiRequestError(415, "File content doesn't match its declared type.");
    }
    const extension = EXTENSION_BY_MIME[contentType];

    const result = await uploadScreenshot(supabase, createSupabaseAdminClient(), segmentId, {
      bytes,
      contentType,
      extension,
    });

    return Response.json(
      { screenshotId: result.screenshotId, screenshotUrl: result.screenshotUrl },
      { status: 201 }
    );
  });
}
