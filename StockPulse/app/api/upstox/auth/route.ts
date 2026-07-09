import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/upstox/auth
 * This endpoint checks if Upstox credentials are configured and attempts
 * to retrieve/generate the live WebSocket redirection URL.
 * If credentials are not present, it gracefully returns a status telling the
 * clients to run in Simulation/Dev Mode.
 */
export async function GET() {
  const clientId = process.env.UPSTOX_CLIENT_ID;
  const clientSecret = process.env.UPSTOX_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    return NextResponse.json({
      mode: 'simulation',
      message: 'Upstox credentials not configured in .env. Running in Mock/Simulation Feed mode.',
      fallbackUrl: 'ws://localhost:3000/api/upstox/mock-ws'
    });
  }

  try {
    // 1. Get the access token stored in Supabase app_config
    const { data: config } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'upstox_access_token')
      .maybeSingle();

    const accessToken = config?.value?.access_token;

    if (!accessToken) {
      return NextResponse.json({
        mode: 'need_auth',
        message: 'Upstox account not linked. Please login via admin panel.',
        loginUrl: `https://api.upstox.com/v2/login/authorization/dialog?client_id=${clientId}&redirect_uri=${encodeURIComponent(process.env.UPSTOX_REDIRECT_URI || '')}`
      });
    }

    // 2. Request Upstox market data feed authorisation
    const response = await fetch('https://api.upstox.com/v2/feed/market-data-feed/authorise', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Upstox returned HTTP status ${response.status}`);
    }

    const resData = await response.json();
    
    return NextResponse.json({
      mode: 'live',
      authorizedUrl: resData.data.authorizedRedirectUri
    });
  } catch (err: any) {
    return NextResponse.json({
      mode: 'simulation',
      error: err.message || 'Failed to authenticate with Upstox. Running in Simulation mode.',
      fallbackUrl: 'ws://localhost:3000/api/upstox/mock-ws'
    });
  }
}
