import { NextResponse } from "next/server";
import { isCanvaConfigured, isCanvaConnected } from "@/lib/canva";

export async function GET() {
  const configured = await isCanvaConfigured();
  return NextResponse.json({
    configured,
    connected: configured ? await isCanvaConnected() : false,
  });
}
