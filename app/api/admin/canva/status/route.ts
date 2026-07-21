import { NextResponse } from "next/server";
import { isCanvaConfigured, isCanvaConnected } from "@/lib/canva";

export async function GET() {
  return NextResponse.json({
    configured: isCanvaConfigured(),
    connected: isCanvaConfigured() ? await isCanvaConnected() : false,
  });
}
