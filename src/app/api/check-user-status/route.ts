
'use server';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import { WithingsClient } from '@/lib/withings/client';

const requestSchema = z.object({
  email: z.string().email({ message: 'Please enter a valid email address.' }),
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

  const { email } = validatedBody.data;

  try {
    const clientId = process.env.WITHINGS_CLIENT_ID;
    const clientSecret = process.env.WITHINGS_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      const message = 'Withings API credentials are not configured on the server.';
      return NextResponse.json({ message, details: message }, { status: 500 });
    }

    const client = new WithingsClient(clientId, clientSecret);
    const users = await client.findUserByEmail(email);

    // This case should not be hit if findUserByEmail throws on not found, but is here for safety.
    if (users.length === 0) {
        return NextResponse.json({ needsOAuth: true, users: [] });
    }

    return NextResponse.json({
      users: users.map(u => ({ 
        userid: u.userid, 
        fully_owned: u.fully_owned,
        email: u.email 
      })),
    });

  } catch (e: any) {
    console.error('Error in check-user-status:', e);
    
    // Check if the error indicates user not found, and return the needsOAuth flag.
    if (e.message && e.message.toLowerCase().includes('could not find user')) {
        return NextResponse.json({ needsOAuth: true, users: [] });
    }

    const message = e.message || 'An unknown error occurred.';
    return NextResponse.json(
      { message: `An error occurred: ${message}`, details: e.stack || JSON.stringify(e, null, 2) },
      { status: 500 }
    );
  }
}
