import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type EmailQueueItem = {
  id: string;
  tenant_id: string;
  customer_notification_id: string | null;
  customer_profile_id: string | null;
  user_id: string | null;
  to_email: string;
  subject: string;
  body_text: string;
  body_html: string | null;
  type: string;
  priority: string;
  status: string;
  attempts: number;
  max_attempts: number;
  metadata: Record<string, unknown> | null;
};

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL?.startsWith("http")
      ? process.env.VERCEL_URL
      : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000"
  );
}

function absolutizeUrls(html: string | null) {
  if (!html) return null;

  const baseUrl = getBaseUrl();

  return html.replaceAll('href="/', `href="${baseUrl}/`);
}

function normalizeResendError(error: unknown) {
  if (!error) return "Unknown email error.";

  if (typeof error === "string") return error;

  if (error instanceof Error) return error.message;

  try {
    return JSON.stringify(error);
  } catch {
    return "Unknown email error.";
  }
}

export async function POST(request: Request) {
  try {
    const secret = request.headers.get("x-email-worker-secret");

    if (!process.env.EMAIL_WORKER_SECRET) {
      return NextResponse.json(
        { error: "EMAIL_WORKER_SECRET is not configured." },
        { status: 500 }
      );
    }

    if (secret !== process.env.EMAIL_WORKER_SECRET) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { error: "RESEND_API_KEY is not configured." },
        { status: 500 }
      );
    }

    if (!process.env.RESEND_FROM_EMAIL) {
      return NextResponse.json(
        { error: "RESEND_FROM_EMAIL is not configured." },
        { status: 500 }
      );
    }

    const supabase = createClient();
    const resend = new Resend(process.env.RESEND_API_KEY);

    const body = await request.json().catch(() => ({}));

    const limit = Math.min(Number(body.limit || 10), 50);

    const { data: queueItems, error: queueError } = await supabase
      .from("notification_email_queue")
      .select(
        `
        id,
        tenant_id,
        customer_notification_id,
        customer_profile_id,
        user_id,
        to_email,
        subject,
        body_text,
        body_html,
        type,
        priority,
        status,
        attempts,
        max_attempts,
        metadata
      `
      )
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .lt("attempts", 3)
      .order("priority", { ascending: false })
      .order("scheduled_at", { ascending: true })
      .limit(limit);

    if (queueError) {
      return NextResponse.json(
        { error: queueError.message },
        { status: 500 }
      );
    }

    const items = (queueItems || []) as EmailQueueItem[];

    const results: Array<{
      id: string;
      status: "sent" | "failed" | "skipped";
      providerMessageId?: string | null;
      error?: string;
    }> = [];

    for (const item of items) {
      const currentAttempts = Number(item.attempts || 0);
      const maxAttempts = Number(item.max_attempts || 3);

      if (currentAttempts >= maxAttempts) {
        await supabase
          .from("notification_email_queue")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error_message: "Max attempts reached.",
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: "skipped",
          error: "Max attempts reached.",
        });

        continue;
      }

      const { error: claimError } = await supabase
        .from("notification_email_queue")
        .update({
          status: "processing",
          attempts: currentAttempts + 1,
          error_message: null,
        })
        .eq("id", item.id)
        .eq("status", "pending");

      if (claimError) {
        results.push({
          id: item.id,
          status: "failed",
          error: claimError.message,
        });

        continue;
      }

      try {
        const { data, error } = await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL,
          to: item.to_email,
          subject: item.subject,
          text: item.body_text,
          html: absolutizeUrls(item.body_html) || undefined,
          tags: [
            {
              name: "type",
              value: item.type,
            },
            {
              name: "queue_id",
              value: item.id,
            },
          ],
        });

        if (error) {
          throw new Error(normalizeResendError(error));
        }

        await supabase
          .from("notification_email_queue")
          .update({
            status: "sent",
            provider: "resend",
            provider_message_id: data?.id || null,
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: "sent",
          providerMessageId: data?.id || null,
        });
      } catch (error) {
        const errorMessage = normalizeResendError(error);
        const nextAttempts = currentAttempts + 1;
        const nextStatus = nextAttempts >= maxAttempts ? "failed" : "pending";

        await supabase
          .from("notification_email_queue")
          .update({
            status: nextStatus,
            failed_at:
              nextStatus === "failed" ? new Date().toISOString() : null,
            error_message: errorMessage,
          })
          .eq("id", item.id);

        results.push({
          id: item.id,
          status: "failed",
          error: errorMessage,
        });
      }
    }

    return NextResponse.json({
      processed: results.length,
      sent: results.filter((item) => item.status === "sent").length,
      failed: results.filter((item) => item.status === "failed").length,
      skipped: results.filter((item) => item.status === "skipped").length,
      results,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Email queue processing failed." },
      { status: 500 }
    );
  }
}