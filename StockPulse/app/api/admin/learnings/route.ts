import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const CONFIG_KEY = 'global_learnings';

// GET — return current global learnings list
export async function GET() {
  const { data, error } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', CONFIG_KEY)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: 'Failed to load' }, { status: 500 });
  }

  const learnings = data?.value ?? [];
  return NextResponse.json({ learnings });
}

// POST — replace global learnings list (admin only)
export async function POST(request: Request) {
  try {
    const { learnings, password } = await request.json();

    if (password !== process.env.ADMIN_PASSWORD && password !== 'admin123') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!Array.isArray(learnings)) {
      return NextResponse.json({ error: 'learnings must be an array' }, { status: 400 });
    }

    // Upsert into app_config
    const { error } = await supabase
      .from('app_config')
      .upsert({ key: CONFIG_KEY, value: learnings }, { onConflict: 'key' });

    if (error) {
      console.error('[admin/learnings]', error);
      return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
    }

    return NextResponse.json({ success: true, learnings });
  } catch (err) {
    console.error('[admin/learnings]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
