import { requestSession } from "@/lib/session";
import { NextResponse } from "next/server";
import { supabase } from "@/lib/server-db";

const CONFIG_KEY = "global_favorites";

// GET — return current global favorites list
export async function GET() {
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", CONFIG_KEY)
    .maybeSingle();

  if (error && error.code !== "PGRST116") {
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }

  const favorites: string[] = data?.value ?? [];
  return NextResponse.json({ favorites });
}

// POST — replace global favorites list (admin only)
export async function POST(request: Request) {
  if (!requestSession(request, "admin"))
    return NextResponse.json(
      { error: "Admin sign-in required" },
      { status: 401 },
    );
  try {
    const { favorites } = await request.json();

    if (!Array.isArray(favorites)) {
      return NextResponse.json(
        { error: "favorites must be an array" },
        { status: 400 },
      );
    }

    // Upsert into app_config
    const { error } = await supabase
      .from("app_config")
      .upsert({ key: CONFIG_KEY, value: favorites }, { onConflict: "key" });

    if (error) {
      console.error("[admin/favorites]", error);
      return NextResponse.json({ error: "Failed to save" }, { status: 500 });
    }

    return NextResponse.json({ success: true, favorites });
  } catch (err) {
    console.error("[admin/favorites]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
