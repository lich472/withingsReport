
'use server';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { WithingsClient } from '@/lib/withings/client';

const requestSchema = z.object({
  userid: z.number().optional(), // Make userid optional
  temp_access_token: z.string().nullable().optional(),
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

  const { userid, temp_access_token } = validatedBody.data;

  try {
    const clientId = process.env.WITHINGS_CLIENT_ID;
    const clientSecret = process.env.WITHINGS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Withings API credentials are not configured on the server.');
    }

    const client = new WithingsClient(clientId, clientSecret);
    
    let token;
    if (temp_access_token) {
        token = temp_access_token;
    } else if (userid) {
        token = await client.getAccessToken(userid);
    } else {
        const error: any = new Error("User needs to grant permission.");
        error.needsOAuth = true;
        throw error;
    }

    const summary = await client.getSleepSummary(token);

    if (summary.status !== 0) {
      const errorMessage = summary.status === 293 
        ? "No sleep data found for this user." 
        : `Could not retrieve sleep summary: ${summary.error || 'Unknown API error'}`;
      const error: any = new Error(errorMessage);
      error.details = JSON.stringify(summary, null, 2);
      throw error;
    }
    
    if (!summary.body || !summary.body.series || summary.body.series.length === 0) {
      const error: any = new Error("No sleep data found for this user.");
      error.details = JSON.stringify(summary, null, 2);
      throw error;
    }
    
    // The userid is always present now, either passed in or from the OAuth flow
    const finalUserId = userid; 

    const dates = summary.body.series.map(s => s.startdate * 1000);
    const minDate = new Date(Math.min(...dates));
    const maxDate = new Date(Math.max(...dates));
    
    maxDate.setHours(23, 59, 59, 999);

    const previewData = summary.body.series
        .slice(0, 3)
        .map(s => ({ enddate: s.enddate, timezone: s.timezone }));

    return NextResponse.json({
      userid: finalUserId,
      minDate: minDate.toISOString(),
      maxDate: maxDate.toISOString(),
      previewData: previewData,
    });

  } catch (e: any) {
    console.error('An unexpected error occurred in get-summary-dates:', e);
    // Check for the specific OAuth error or our custom thrown error
    if (e.needsOAuth || (e.message && e.message.includes("status 380"))) {
        return NextResponse.json({ message: "User needs to grant permission.", needsOAuth: true, details: e.stack }, { status: 403 });
    }
    return NextResponse.json(
      { 
        message: `An error occurred: ${e.message || 'An unknown error occurred.'}`,
        details: e.details || e.stack || JSON.stringify(e, null, 2)
      },
      { status: 500 }
    );
  }
}
