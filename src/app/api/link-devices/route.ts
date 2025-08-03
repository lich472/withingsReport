
'use server';

import { z } from 'zod';
import { NextResponse } from 'next/server';

const linkDevicesSchema = z.object({
  participant_id: z.string().uuid(),
  mac_address_wsa: z.string(),
  mac_address_hub: z.string(),
  override_mac_address_wsa: z.boolean().optional(),
  override_mac_address_hub: z.boolean().optional(),
});

export async function POST(request: Request) {
  const apiKey = process.env.SLEEPSCAN_KEY;
  const apiUrl = 'https://sleepscan.app/api/link-devices';

  if (!apiKey) {
    const message = 'Server is not configured for this operation. Missing API key.';
    return NextResponse.json({ message, details: message }, { status: 500 });
  }

  let body;
  try {
    body = await request.json();
    const validatedBody = linkDevicesSchema.safeParse(body);
    if (!validatedBody.success) {
      return NextResponse.json({ message: validatedBody.error.errors[0].message }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(body),
    });

    const responseData = await response.json();

    if (!response.ok) {
      const errorDetail = responseData?.detail;
      let errorMessage = 'Failed to link devices.';
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail) && errorDetail[0]?.msg) {
        errorMessage = errorDetail[0].msg;
      }
      return NextResponse.json({ message: `API Error: ${errorMessage}`, details: JSON.stringify(responseData, null, 2) }, { status: response.status });
    }
    
    return NextResponse.json({ message: 'Devices linked successfully!', data: responseData }, { status: 200 });

  } catch (error: any) {
    console.error('Error calling external API:', error);
    return NextResponse.json(
      { message: `An unexpected error occurred: ${error.message}`, details: error.stack || JSON.stringify(error, null, 2) },
      { status: 500 }
    );
  }
}

    