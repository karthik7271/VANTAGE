import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const CHANNELS = ["Meta", "Google Ads", "LinkedIn", "TikTok", "Email"];

const COMPANY_SIZE_BASE: Record<string, number> = {
  Any: 50000,
  "1–50": 5000,
  "50–200": 15000,
  "200–1000": 40000,
  "1000+": 80000,
};

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

export async function POST(request: Request) {
  const { name, channel, behaviorFilter, companySize } = await request.json();
  if (!name || typeof name !== "string" || !CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const base = COMPANY_SIZE_BASE[companySize] ?? COMPANY_SIZE_BASE.Any;
  const estimatedSize = Math.round(base * (0.7 + Math.random() * 0.6));
  const criteria = { behaviorFilter, companySize };

  const [segment] = await query<{
    id: number;
    name: string;
    channel: string;
    estimated_size: number;
    updated_at: string;
  }>(
    `INSERT INTO audience_segments (name, channel, criteria_json, estimated_size)
     VALUES ($1, $2, $3::jsonb, $4)
     RETURNING id, name, channel, estimated_size, updated_at`,
    [name, channel, JSON.stringify(criteria), estimatedSize],
  );
  return NextResponse.json({ segment }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { id, name, channel } = await request.json();
  if (!id || !name || typeof name !== "string" || !CHANNELS.includes(channel)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  const [segment] = await query<{
    id: number;
    name: string;
    channel: string;
    estimated_size: number;
    updated_at: string;
  }>(
    `UPDATE audience_segments
     SET name = $1, channel = $2, updated_at = NOW()
     WHERE id = $3
     RETURNING id, name, channel, estimated_size, updated_at`,
    [name, channel, id],
  );
  if (!segment) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 });
  }
  return NextResponse.json({ segment });
}

export async function DELETE(request: Request) {
  const { id } = await request.json();
  if (!id) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await query(`DELETE FROM audience_segments WHERE id = $1`, [id]);
  return NextResponse.json({ ok: true });
}
