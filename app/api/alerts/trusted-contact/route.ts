import { NextResponse } from "next/server";
import { trustedContactAlertRequestSchema, sendTrustedContactAlert, UnconfiguredNotificationProvider } from "@/lib/alerts/trusted-contact";

const provider = new UnconfiguredNotificationProvider();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = trustedContactAlertRequestSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ status: "invalid_request", error: "Check the incident details, destination, and location consent." }, { status: 400 });
  const result = await sendTrustedContactAlert(parsed.data, provider);
  return NextResponse.json(result, { status: result.status === "provider_rejected" ? 502 : 200 });
}

function methodNotAllowed() {
  return NextResponse.json({ status: "method_not_allowed", error: "Use POST for trusted-contact alerts." }, { status: 405, headers: { Allow: "POST" } });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
