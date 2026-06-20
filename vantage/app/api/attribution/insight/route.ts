import { NextResponse } from "next/server";
import { getAttributionComparison } from "@/lib/attribution/comparison";
import { generateAttributionInsight } from "@/lib/bedrock";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = parseInt(searchParams.get("period") ?? "30");
  const validPeriod = [30, 60, 90].includes(period) ? period : 30;

  const comparison = await getAttributionComparison(validPeriod);
  const insight = await generateAttributionInsight(comparison, validPeriod);

  return NextResponse.json({ ...insight, period: validPeriod });
}
