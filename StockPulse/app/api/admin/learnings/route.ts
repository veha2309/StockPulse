import { requestSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";

const CONFIG_KEY = "global_learnings";

// GET — return current global learnings list
export async function GET() {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  const learnings = data?.value ?? [];
  return NextResponse.json({ learnings });
}

// POST — replace global learnings list (admin only)
export async function POST(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  try {
    const { learnings } = await request.json();

    if (!Array.isArray(learnings)) {
      return NextResponse.json(
        { error: "learnings must be an array" },
        { status: 400 },
      );
    }

    // Upsert into app_config
    const { error } = await supabase
      .from("app_config")
      .upsert({ key: CONFIG_KEY, value: learnings }, { onConflict: "key" });

    if (error) {
      console.error("[admin/learnings]", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ success: true, learnings });
  } catch (err) {
    console.error("[admin/learnings]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
