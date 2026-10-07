import { NextResponse } from "next/server";
import { UnconfiguredNotificationProvider } from "@/lib/alerts/trusted-contact";

// Reports capability only. Provider credentials and configuration stay server-side.
export async function GET() {
  const provider = new UnconfiguredNotificationProvider();
  return NextResponse.json({ configured: provider.isConfigured() });
}

export async function POST() {
  return NextResponse.json({ error: "Use GET to check trusted-contact alert availability." }, { status: 405, headers: { Allow: "GET" } });
}
