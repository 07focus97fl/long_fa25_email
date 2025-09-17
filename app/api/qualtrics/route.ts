import { NextRequest, NextResponse } from 'next/server';

interface QualtricsResponse {
  responseId: string;
  values?: {
    startDate?: string;
    endDate?: string;
    recordedDate?: string;
    QID5_TEXT?: string;
    QID10?: number;
    QID29_1?: string;
    QID30_1?: string;
    QID31_1?: string;
    QID61_1?: string;
  };
}

export async function GET() {
  try {
    const apiToken = process.env.QUALTRICS_API_TOKEN;
    const dataCenter = process.env.QUALTRICS_DATA_CENTER;
    const surveyId = process.env.QUALTRICS_SURVEY_ID;

    if (!apiToken || !dataCenter || !surveyId) {
      return NextResponse.json(
        { error: 'Missing required environment variables' },
        { status: 500 }
      );
    }

    const baseUrl = `https://${dataCenter}.qualtrics.com/API/v3`;
    
    // Step 1: Create export
    const exportUrl = `${baseUrl}/surveys/${surveyId}/export-responses`;
    const exportBody = {
      format: 'json',
      compress: false
    };

    console.log('Creating export for survey:', surveyId);

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
      console.error('Export creation error:', errorText);
      throw new Error(`Failed to create export: ${exportResponse.status} - ${errorText}`);
    }

    const exportData = await exportResponse.json();
    const progressId = exportData.result.progressId;

    // Step 2: Check export progress
    let exportComplete = false;
    let fileId = '';
    let attempts = 0;
    const maxAttempts = 30;

    while (!exportComplete && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
      
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
      throw new Error('Export timeout - please try again');
    }

    // Step 3: Download the file
    const downloadUrl = `${baseUrl}/surveys/${surveyId}/export-responses/${fileId}/file`;
    const downloadResponse = await fetch(downloadUrl, {
      headers: {
        'X-API-TOKEN': apiToken,
      },
    });

    if (!downloadResponse.ok) {
      throw new Error(`Failed to download export: ${downloadResponse.status}`);
    }

    const data = await downloadResponse.json();
    
    // Debug: Log the entire data structure
    console.log('Full API response structure:', JSON.stringify(data, null, 2));
    
    if (data.responses && data.responses.length > 0) {
      console.log('First response structure:', JSON.stringify(data.responses[0], null, 2));
      console.log('First response values:', JSON.stringify(data.responses[0].values, null, 2));
      console.log('Available keys in values:', Object.keys(data.responses[0].values || {}));
    }
    
    // Extract and format the responses using the actual field names
    const responses = data.responses?.map((response: QualtricsResponse) => ({
      startDate: response.values?.startDate || '',
      endDate: response.values?.endDate || '',
      recordedDate: response.values?.recordedDate || '',
      responseId: response.responseId || '',
      email: response.values?.QID5_TEXT || '',
      gender: response.values?.QID10 === 1 ? 'Male' : response.values?.QID10 === 2 ? 'Female' : 'Other',
      tier1Person1: response.values?.QID29_1 || '',
      tier2Person1: response.values?.QID30_1 || '',
      tier3Person1: response.values?.QID31_1 || '',
      passkeyThree1: response.values?.QID61_1 || '',
    })) || [];

    return NextResponse.json({ responses });
  } catch (error) {
    console.error('Error fetching Qualtrics data:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch survey data' },
      { status: 500 }
    );
  }
}