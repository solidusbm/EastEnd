import { NextResponse } from "next/server";
import { disconnectCanva } from "@/lib/canva";

export async function POST() {
  await disconnectCanva();
  return NextResponse.json({ ok: true });
}
