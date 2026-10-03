import { NextResponse } from "next/server";
import { polarAuthUrl, polarConfigured } from "@/lib/polar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  if (!polarConfigured()) {
    return NextResponse.redirect(new URL("/settings?polar=missing", "http://127.0.0.1:3000"));
  }
  return NextResponse.redirect(polarAuthUrl());
}
