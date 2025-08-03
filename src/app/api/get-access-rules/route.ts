
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import rules from '@/lib/access-rules.json';

type AccessRules = {
  [requesterEmail: string]: {
    role?: 'admin';
    allowed_patterns?: string[];
  };
};

const requestSchema = z.object({
  requesterEmail: z.string().email(),
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
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const { requesterEmail } = validatedBody.data;
  const typedRules = rules as AccessRules;
  const userRules = typedRules[requesterEmail];

  if (userRules) {
    return NextResponse.json(userRules);
  } else {
    return NextResponse.json(
      { message: `No access rules found for user: ${requesterEmail}` },
      { status: 404 }
    );
  }
}
