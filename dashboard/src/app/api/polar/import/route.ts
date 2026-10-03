import { preflight, withCors } from "@/lib/cors";
import { getDb } from "@/lib/db";
import { getRequestUser } from "@/lib/auth";
import { importPolarZip } from "@/lib/polar-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export function OPTIONS(request: Request) {
  return preflight(request);
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return withCors(request, { ok: false, error: "Choose a ZIP file." }, 400);
    }
    if (!file.name.toLowerCase().endsWith(".zip")) {
      return withCors(request, { ok: false, error: "Upload a .zip export, not a single JSON file." }, 400);
    }

    getDb();
    const user = await getRequestUser();
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importPolarZip(buffer, user.id);
    return withCors(request, { ok: true, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    return withCors(request, { ok: false, error: message }, 400);
  }
}
