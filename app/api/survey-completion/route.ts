import { NextResponse } from 'next/server';

interface QualtricsResponse {
  responseId: string;
  values?: {
    mail?: string;
    [key: string]: any;
  };
}

// Reusable function to fetch survey responses from Qualtrics
async function fetchQualtricsResponses(surveyId: string): Promise<string[]> {
  const apiToken = process.env.QUALTRICS_API_TOKEN;
  const dataCenter = process.env.QUALTRICS_DATA_CENTER;

  if (!apiToken || !dataCenter) {
    throw new Error('Missing Qualtrics credentials');
  }

  const baseUrl = `https://${dataCenter}.qualtrics.com/API/v3`;

  // Step 1: Create export
  const exportUrl = `${baseUrl}/surveys/${surveyId}/export-responses`;
  const exportBody = {
    format: 'json',
    compress: false
  };

  const exportResponse = await fetch(exportUrl, {
    method: 'POST',
    headers: {
      'X-API-TOKEN': apiToken,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(exportBody),
  });

  if (!exportResponse.ok) {
    const errorText = await exportResponse.text();
    throw new Error(`Failed to create export for survey ${surveyId}: ${exportResponse.status} - ${errorText}`);
  }

  const exportData = await exportResponse.json();
  const progressId = exportData.result.progressId;

  // Step 2: Check export progress
  let exportComplete = false;
  let fileId = '';
  let attempts = 0;
  const maxAttempts = 30;

  while (!exportComplete && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const progressUrl = `${baseUrl}/surveys/${surveyId}/export-responses/${progressId}`;
    const progressResponse = await fetch(progressUrl, {
      headers: {
        'X-API-TOKEN': apiToken,
      },
    });

    if (progressResponse.ok) {
      const progressData = await progressResponse.json();
      if (progressData.result.status === 'complete') {
        exportComplete = true;
        fileId = progressData.result.fileId;
      }
    }
    attempts++;
  }

  if (!exportComplete) {
    throw new Error(`Export timeout for survey ${surveyId}`);
  }

  // Step 3: Download the file
  const downloadUrl = `${baseUrl}/surveys/${surveyId}/export-responses/${fileId}/file`;
  const downloadResponse = await fetch(downloadUrl, {
    headers: {
      'X-API-TOKEN': apiToken,
    },
  });

  if (!downloadResponse.ok) {
    throw new Error(`Failed to download export for survey ${surveyId}: ${downloadResponse.status}`);
  }

  const data = await downloadResponse.json();

  // Extract emails from the 'mail' embedded data field
  const emails: string[] = [];
  if (data.responses && Array.isArray(data.responses)) {
    for (const response of data.responses as QualtricsResponse[]) {
      const email = response.values?.mail;
      if (email && typeof email === 'string') {
        emails.push(email.toLowerCase().trim()); // Normalize for matching
      }
    }
  }

  return emails;
}

export async function GET() {
  try {
    const checkinSurveyId = process.env.CHECKIN_SURVEY_ID;
    const finalSurveyId = process.env.FINAL_SURVEY_ID;

    if (!checkinSurveyId || !finalSurveyId) {
      return NextResponse.json(
        { error: 'Missing survey IDs in environment variables' },
        { status: 500 }
      );
    }

    // Fetch both surveys in parallel for better performance
    const [checkinEmails, finalEmails] = await Promise.all([
      fetchQualtricsResponses(checkinSurveyId).catch(err => {
        console.error('Error fetching check-in survey:', err);
        return []; // Return empty array if check-in survey fails
      }),
      fetchQualtricsResponses(finalSurveyId).catch(err => {
        console.error('Error fetching final survey:', err);
        return []; // Return empty array if final survey fails
      })
    ]);

    return NextResponse.json({
      checkinEmails,
      finalEmails
    });
  } catch (error) {
    console.error('Error fetching survey completions:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch survey completions' },
      { status: 500 }
    );
  }
}
