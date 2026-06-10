import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data, error } = await supabase.rpc("request_publish_my_store");

    if (error) {
      return NextResponse.json(
        { error: error.message || "Failed to publish store." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      tenant: data,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Failed to publish store." },
      { status: 500 }
    );
  }
}