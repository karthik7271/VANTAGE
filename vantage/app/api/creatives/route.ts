import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const creatives = await query<{
    id: number;
    name: string;
    channel: string;
    status: string;
    submitted_at: string;
    reviewed_at: string | null;
  }>(`
    SELECT id, name, channel, status, submitted_at, reviewed_at
    FROM creatives
    ORDER BY submitted_at DESC
  `);
  return NextResponse.json({ creatives });
}

export async function PATCH(request: Request) {
  const { id, status } = await request.json();
  const valid = ["pending", "approved", "live", "rejected"];
  if (!id || !valid.includes(status)) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }
  await query(
    `UPDATE creatives
     SET status = $1, reviewed_at = CASE WHEN $1 != 'pending' THEN NOW() ELSE reviewed_at END
     WHERE id = $2`,
    [status, id],
  );
  return NextResponse.json({ ok: true });
}
