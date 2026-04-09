import { NextResponse } from 'next/server';
import { supabase, safeUser } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email');
  
  if (!email) return NextResponse.json({ error: 'Missing email' }, { status: 400 });

  const [userRes, favsRes] = await Promise.all([
    supabase.from('users').select('*').eq('email', email).single(),
    supabase.from('app_config').select('value').eq('key', 'global_favorites').maybeSingle(),
  ]);

  if (userRes.error || !userRes.data) {
    return NextResponse.json({ error: "User not found", loggedOut: true }, { status: 200 });
  }

  const globalFavorites: string[] = favsRes.data?.value ?? [];
  return NextResponse.json({ user: safeUser(userRes.data), globalFavorites });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'register') {
      const { name, email, password, branch, enrollment } = body;
      const { data: existing } = await supabase.from('users').select('email').eq('email', email).maybeSingle();
      if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 400 });

      const hashed = await bcrypt.hash(password, 10);
      const newUser = {
        name,
        email,
        password: hashed,
        branch,
        enrollment,
        etokens: 10000,
        e_tokens: 10000,
        portfolio: [],
        options: []
      };

      const { data: user, error } = await supabase.from('users').insert(newUser).select().single();
      if (error) {
        console.error(error);
        return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
      }

      return NextResponse.json({ success: true, user: safeUser(user) });
    }

    if (action === 'login') {
      const { email, password } = body;
      const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();
      
      if (error || !user || !(await bcrypt.compare(password, user.password))) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }

      return NextResponse.json({ success: true, user: safeUser(user) });
    }

    if (action === 'update') {
      const { email, name, branch, enrollment, currentPassword, newPassword } = body;
      const { data: user, error } = await supabase.from('users').select('*').eq('email', email).maybeSingle();

      if (error || !user) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (!(await bcrypt.compare(currentPassword, user.password))) {
        return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }

      const updates: any = {};
      if (name) updates.name = name;
      if (branch) updates.branch = branch;
      if (enrollment) updates.enrollment = enrollment;
      if (newPassword) updates.password = await bcrypt.hash(newPassword, 10);

      const { data: updatedUser, error: updateError } = await supabase
        .from('users')
        .update(updates)
        .eq('email', email)
        .select()
        .single();
        
      if (updateError) throw updateError;

      return NextResponse.json({ success: true, user: safeUser(updatedUser) });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });

  } catch (error) {
    console.error("[auth api]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
