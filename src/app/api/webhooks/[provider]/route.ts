import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/payments/service";

// Server-to-server payment notifications. Excluded from the auth proxy (see src/proxy.ts).
export async function POST(request: Request, ctx: RouteContext<"/api/webhooks/[provider]">) {
  const { provider } = await ctx.params;
  try {
    const status = await handleWebhook(provider, request);
    return NextResponse.json({ ok: status < 400 }, { status });
  } catch (e) {
    console.error("[webhook]", provider, e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
