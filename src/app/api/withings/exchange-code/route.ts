
'use server';

import { z } from 'zod';
import { NextResponse } from 'next/server';

const requestSchema = z.object({
  code: z.string(),
  redirect_uri: z.string().url(),
});

export async function POST(request: Request) {
  let validatedBody;
  try {
    const body = await request.json();
    validatedBody = requestSchema.safeParse(body);
    if (!validatedBody.success) {
      return NextResponse.json({ message: validatedBody.error.errors[0].message }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Invalid request body.' }, { status: 400 });
  }

  const { code, redirect_uri } = validatedBody.data;

  const clientId = process.env.WITHINGS_OAUTH_CLIENT_ID;
  const clientSecret = process.env.WITHINGS_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const message = 'OAuth credentials are not configured on the server.';
    return NextResponse.json({ message, details: message }, { status: 500 });
  }

  const params = new URLSearchParams({
    action: 'requesttoken',
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri,
  });

  try {
    const response = await fetch('https://wbsapi.withings.net/v2/oauth2', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params,
    });
    const tokenData = await response.json();

    if (tokenData.status !== 0 || !tokenData.body?.access_token || !tokenData.body?.userid) {
      const errorDetails = `API returned status ${tokenData.status} with error: '${tokenData.error || 'Unknown error'}'`;
      throw new Error(`Could not get access token. ${errorDetails}`);
    }

    return NextResponse.json({
      access_token: tokenData.body.access_token,
      userid: tokenData.body.userid,
    });

  } catch (e: any) {
    console.error('Error exchanging code for token:', e);
    return NextResponse.json(
      { message: `An error occurred: ${e.message}`, details: e.stack || JSON.stringify(e, null, 2) },
      { status: 500 }
    );
  }
}
