
'use server';

import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { AccessRules } from '@/lib/access-control';
import rules from '@/lib/access-rules.json';

const requestSchema = z.object({
  requesterEmail: z.string().email(),
  studyCode: z.string(),
});

/**
 * Checks if a requester has permission to access a specific study code.
 * @param requesterEmail The email of the user making the request.
 * @param studyCode The code of the study being accessed.
 * @returns {boolean} True if access is granted, false otherwise.
 */
function checkStudyAccess(requesterEmail: string, studyCode: string): boolean {
  const allRules = rules as AccessRules;
  const userRules = allRules[requesterEmail];

  if (!userRules) {
    console.log(`No access rules found for requester: ${requesterEmail}`);
    return false;
  }

  // Admins have access to all studies.
  if (userRules.role === 'admin') {
    console.log(`Access GRANTED for '${requesterEmail}' to study '${studyCode}' as admin.`);
    return true;
  }

  // Check if the study is in the user's allowed list.
  const allowedStudies = userRules.allowed_studies || [];
  if (allowedStudies.includes(studyCode)) {
    console.log(`Access GRANTED for '${requesterEmail}' to study '${studyCode}' based on allowed_studies.`);
    return true;
  }

  console.log(`Access DENIED for '${requesterEmail}' to study '${studyCode}'.`);
  return false;
}


export async function POST(request: Request) {
  let validatedBody;
  try {
    const body = await request.json();
    validatedBody = requestSchema.safeParse(body);
    if (!validatedBody.success) {
      return NextResponse.json({ message: validatedBody.error.errors[0].message, hasAccess: false }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Invalid JSON body.', hasAccess: false }, { status: 400 });
  }

  const { requesterEmail, studyCode } = validatedBody.data;

  const hasAccess = checkStudyAccess(requesterEmail, studyCode);

  if (hasAccess) {
    return NextResponse.json({ hasAccess: true });
  } else {
    return NextResponse.json(
      { message: `You do not have permission to create participants for the study '${studyCode}'.`, hasAccess: false },
      { status: 403 }
    );
  }
}
