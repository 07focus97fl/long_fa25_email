import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

interface SurveyResponse {
  id?: number;
  response_id: string;
  day?: string | null;
  email?: string | null;
  blacklisted?: boolean;
  tier1_person?: string | null;
  tier2_person?: string | null;
  tier3_person?: string | null;
  gender?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  recorded_date?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { responses } = body;

    if (!responses || !Array.isArray(responses)) {
      return NextResponse.json(
        { error: 'Invalid responses data' },
        { status: 400 }
      );
    }

    const syncResults = [];

    for (const response of responses) {
      // Check if participant already exists
      const { data: existingParticipant, error: checkError } = await supabase
        .from('long_fa25_survey_responses')
        .select('response_id')
        .eq('response_id', response.responseId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        console.error('Error checking participant:', checkError);
        continue;
      }

      // If participant doesn't exist, insert them
      if (!existingParticipant) {
        const newParticipant: Omit<SurveyResponse, 'id'> = {
          response_id: response.responseId,
          email: response.email,
          gender: response.gender,
          tier1_person: response.tier1Person1,
          tier2_person: response.tier2Person1,
          tier3_person: response.tier3Person1,
          start_date: response.startDate,
          end_date: response.endDate,
          recorded_date: response.recordedDate,
          day: null,
          blacklisted: false,
        };

        const { data, error } = await supabase
          .from('long_fa25_survey_responses')
          .insert([newParticipant])
          .select();

        if (error) {
          console.error('Error inserting participant:', error);
          syncResults.push({ responseId: response.responseId, status: 'error', error: error.message });
        } else {
          syncResults.push({ responseId: response.responseId, status: 'inserted' });
        }
      } else {
        syncResults.push({ responseId: response.responseId, status: 'exists' });
      }
    }

    return NextResponse.json({ syncResults });
  } catch (error) {
    console.error('Error syncing to Supabase:', error);
    return NextResponse.json(
      { error: 'Failed to sync data to Supabase' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const { data: participants, error } = await supabase
      .from('long_fa25_survey_responses')
      .select('*')
      .order('recorded_date', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ participants });
  } catch (error) {
    console.error('Error fetching participants:', error);
    return NextResponse.json(
      { error: 'Failed to fetch participants' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { responseId, day } = body;

    if (!responseId) {
      return NextResponse.json(
        { error: 'Response ID is required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('long_fa25_survey_responses')
      .update({ day })
      .eq('response_id', responseId)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json({ participant: data[0] });
  } catch (error) {
    console.error('Error updating participant day:', error);
    return NextResponse.json(
      { error: 'Failed to update participant day' },
      { status: 500 }
    );
  }
}