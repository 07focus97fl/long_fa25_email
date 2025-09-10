'use client';

import { useState, useEffect } from 'react';

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

export default function MainPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const updateDay = async (responseId: string, day: string) => {
    try {
      const response = await fetch('/api/supabase', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ responseId, day: day || null }),
      });

      if (!response.ok) {
        throw new Error('Failed to update day');
      }

      // Update local state
      setResponses(prev => 
        prev.map(r => 
          r.response_id === responseId 
            ? { ...r, day: day || null }
            : r
        )
      );
    } catch (error) {
      console.error('Error updating day:', error);
    }
  };

  useEffect(() => {
    const fetchAndSyncResponses = async () => {
      try {
        // Step 1: Fetch latest data from Qualtrics
        const qualtricsResponse = await fetch('/api/qualtrics');
        if (!qualtricsResponse.ok) {
          throw new Error('Failed to fetch Qualtrics data');
        }
        const qualtricsData = await qualtricsResponse.json();

        // Step 2: Sync to Supabase
        const syncResponse = await fetch('/api/supabase', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ responses: qualtricsData.responses }),
        });

        if (!syncResponse.ok) {
          throw new Error('Failed to sync to database');
        }

        // Step 3: Fetch participants from Supabase (includes day tracking)
        const participantsResponse = await fetch('/api/supabase');
        if (!participantsResponse.ok) {
          throw new Error('Failed to fetch participants');
        }
        const participantsData = await participantsResponse.json();
        setResponses(participantsData.participants);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchAndSyncResponses();
  }, []);

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-center">Loading survey responses...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-4">
        <div className="text-red-600 text-center">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Survey Responses</h1>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Response ID</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Email</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Gender</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Tier 1 Person</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Tier 2 Person</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Tier 3 Person</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Study Day</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Recorded Date</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr key={response.response_id} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.response_id}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.email}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.gender}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier1_person}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier2_person}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier3_person}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={response.day || ''}
                    onChange={(e) => updateDay(response.response_id, e.target.value)}
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-center"
                    placeholder="Day"
                  />
                </td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">
                  {response.recorded_date ? new Date(response.recorded_date).toLocaleString() : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {responses.length === 0 && (
        <div className="text-center text-gray-500 mt-4">
          No survey responses found.
        </div>
      )}
    </div>
  );
}