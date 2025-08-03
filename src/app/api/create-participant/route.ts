
'use server';

import { z } from 'zod';
import { NextResponse } from 'next/server';
import type { AccessRules } from '@/lib/access-control';
import rules from '@/lib/access-rules.json';

const createParticipantSchema = z.object({
  email: z.string().email(),
  first_name: z.string(),
  last_name: z.string(),
  short_name: z.string(),
  study_code: z.string(),
  requesterEmail: z.string().email(),
});

function checkStudyAccess(requesterEmail: string, studyCode: string): boolean {
  const allRules = rules as AccessRules;
  const userRules = allRules[requesterEmail];

  if (!userRules) {
    return false;
  }
  if (userRules.role === 'admin') {
    return true;
  }
  const allowedStudies = userRules.allowed_studies || [];
  return allowedStudies.includes(studyCode);
}


export async function POST(request: Request) {
  const apiKey = process.env.SLEEPSCAN_KEY;
  const sleepscanApiUrl = 'https://sleepscan.app/api';

  if (!apiKey) {
    const message = 'Server is not configured for this operation. Missing API key.';
    return NextResponse.json({ message, details: message }, { status: 500 });
  }

  let validatedBody;
  try {
    const body = await request.json();
    validatedBody = createParticipantSchema.safeParse(body);
    if (!validatedBody.success) {
      return NextResponse.json({ message: validatedBody.error.errors[0].message }, { status: 400 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Invalid JSON body.' }, { status: 400 });
  }

  const { email, first_name, last_name, short_name, study_code, requesterEmail } = validatedBody.data;
  
  // Step 1: Check for permission before doing anything else
  const hasAccess = checkStudyAccess(requesterEmail, study_code);
  if (!hasAccess) {
      return NextResponse.json({ message: `You do not have permission to create participants for the study '${study_code}'.` }, { status: 403 });
  }

  try {
    // Step 2: Get Study ID from Study Code
    const studyResponse = await fetch(`${sleepscanApiUrl}/studies/by-code/${study_code}`, {
      headers: { 'X-API-Key': apiKey },
    });
    
    const studyData = await studyResponse.json();

    if (!studyResponse.ok) {
        let errorMessage = `Failed to find study with code '${study_code}'.`;
        if (studyData?.detail) {
            errorMessage = typeof studyData.detail === 'string' ? studyData.detail : JSON.stringify(studyData.detail);
        }
      return NextResponse.json({ message: `API Error: ${errorMessage}`, details: JSON.stringify(studyData, null, 2) }, { status: studyResponse.status });
    }

    const study_id = studyData.id;

    if (!study_id) {
        return NextResponse.json({ message: `Could not retrieve a valid ID for study code '${study_code}'.`}, { status: 400 });
    }

    // Step 3: Create Participant with the retrieved Study ID
    const participantPayload = {
        email,
        first_name,
        last_name,
        short_name,
        study: { id: study_id }
    };
    
    const participantResponse = await fetch(`${sleepscanApiUrl}/participants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
      body: JSON.stringify(participantPayload),
    });

    const participantResponseData = await participantResponse.json();

    if (!participantResponse.ok) {
      const errorDetail = participantResponseData?.detail;
      let errorMessage = 'Failed to create participant.';
      if (typeof errorDetail === 'string') {
        errorMessage = errorDetail;
      } else if (Array.isArray(errorDetail) && errorDetail[0]?.msg) {
        errorMessage = errorDetail[0].msg;
      }
      return NextResponse.json({ message: `API Error: ${errorMessage}`, details: JSON.stringify(participantResponseData, null, 2) }, { status: participantResponse.status });
    }
    
    return NextResponse.json({ message: 'Participant created successfully!', data: participantResponseData }, { status: 201 });

  } catch (error: any) {
    console.error('Error calling external API:', error);
    return NextResponse.json(
      { message: `An unexpected error occurred: ${error.message}`, details: error.stack || JSON.stringify(error, null, 2) },
      { status: 500 }
    );
  }
}
