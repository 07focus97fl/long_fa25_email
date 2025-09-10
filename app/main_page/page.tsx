'use client';

import { useState, useEffect } from 'react';

interface SurveyResponse {
  startDate: string;
  endDate: string;
  recordedDate: string;
  responseId: string;
  email: string;
  gender: string;
  tier1Person1: string;
  tier2Person1: string;
  tier3Person1: string;
}

export default function MainPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResponses = async () => {
      try {
        const response = await fetch('/api/qualtrics');
        if (!response.ok) {
          throw new Error('Failed to fetch survey responses');
        }
        const data = await response.json();
        setResponses(data.responses);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchResponses();
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
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Recorded Date</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => (
              <tr key={response.responseId} className="hover:bg-gray-50">
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.responseId}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.email}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.gender}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier1Person1}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier2Person1}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier3Person1}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">
                  {new Date(response.recordedDate).toLocaleString()}
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