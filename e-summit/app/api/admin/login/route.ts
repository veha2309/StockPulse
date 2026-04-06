import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const { password } = await request.json();
  const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: "Invalid admin password" }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
