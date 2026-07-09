import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/upstox/callback
 * Receives the auth code from Upstox, exchanges it for access token,
 * and saves it into Supabase database config.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.json({ error: 'Auth code missing from Upstox redirect' }, { status: 400 });
  }

  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  const redirectUri = process.env.UPSTOX_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    return NextResponse.json({ error: 'Upstox environmental variables not configured' }, { status: 500 });
  }

  try {
    const response = await fetch('https://api.upstox.com/v2/login/authorization/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      throw new Error(`Failed to exchange code: ${errBody}`);
    }

    const tokenData = await response.json();

    // Store in Supabase app_config so both Web and Mobile apps can fetch it
    await supabase.from('app_config').upsert({
      key: 'upstox_access_token',
      value: {
        access_token: tokenData.access_token,
        user_name: tokenData.user_name,
        email: tokenData.email,
        updated_at: new Date().toISOString()
      }
    });

    // Redirect to home dashboard with success query param
    return NextResponse.redirect(new URL('/?upstox_linked=true', request.url));
  } catch (err: any) {
    console.error('Upstox callback exchange error:', err);
    return NextResponse.json({ error: err.message || 'OAuth exchange failed' }, { status: 500 });
  }
}
