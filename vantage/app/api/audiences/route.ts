import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const segments = await query<{
    id: number;
    name: string;
    channel: string;
    estimated_size: number;
    updated_at: string;
  }>(`
    SELECT id, name, channel, estimated_size, updated_at
    FROM audience_segments
    ORDER BY estimated_size DESC
  `);
  return NextResponse.json({ segments });
}
