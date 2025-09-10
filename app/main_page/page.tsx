'use client';

import { useState, useEffect } from 'react';
import { generateEmailByDay } from '../../lib/emailTemplates';

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
  passkey_three_1?: string | null;
}

export default function MainPage() {
  const [responses, setResponses] = useState<SurveyResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedParticipants, setSelectedParticipants] = useState<Set<string>>(new Set());
  const [showEmailPreview, setShowEmailPreview] = useState(false);
  const [previewEmails, setPreviewEmails] = useState<Array<{to: string; subject: string; text: string; participantDay: number}>>([]);
  const [sendingEmails, setSendingEmails] = useState(false);

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

  const toggleParticipantSelection = (responseId: string) => {
    setSelectedParticipants(prev => {
      const newSet = new Set(prev);
      if (newSet.has(responseId)) {
        newSet.delete(responseId);
      } else {
        newSet.add(responseId);
      }
      return newSet;
    });
  };

  const selectAllParticipants = () => {
    const eligibleParticipants = responses.filter(r => r.email && !r.blacklisted && canReceiveEmail(r));
    setSelectedParticipants(new Set(eligibleParticipants.map(r => r.response_id)));
  };

  const canReceiveEmail = (participant: SurveyResponse): boolean => {
    const day = parseInt(participant.day as string);
    return day >= 1 && (day <= 21 || day === 22 || day === 36);
  };

  const clearSelection = () => {
    setSelectedParticipants(new Set());
  };

  const generateEmailPreviews = () => {
    const selectedResponses = responses.filter(r => selectedParticipants.has(r.response_id));
    const emails: Array<{to: string; subject: string; text: string; participantDay: number}> = [];
    
    selectedResponses
      .filter(participant => participant.email && !participant.blacklisted)
      .forEach(participant => {
        const emailData = generateEmailByDay(participant);
        if (emailData) {
          emails.push({
            to: participant.email!,
            subject: emailData.subject,
            text: emailData.text,
            participantDay: parseInt(participant.day as string) || 0,
          });
        }
      });
    
    setPreviewEmails(emails);
    setShowEmailPreview(true);
  };

  const sendEmails = async () => {
    setSendingEmails(true);
    try {
      const response = await fetch('/api/gmail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ emails: previewEmails }),
      });

      if (!response.ok) {
        throw new Error('Failed to send emails');
      }

      const result = await response.json();
      alert(result.message);
      setShowEmailPreview(false);
    } catch (error) {
      console.error('Error sending emails:', error);
      alert('Failed to send emails. Please try again.');
    } finally {
      setSendingEmails(false);
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
      
      {/* Email Controls */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold mb-4">Email System</h2>
        <p className="text-sm text-gray-600 mb-4">
          Select participants to email. Each participant will receive the appropriate email based on their current study day:
          <br />• Days 1-21: Daily survey emails
          <br />• Day 22: Check-in survey email
          <br />• Day 36: Final survey email
        </p>
        
        <div className="flex gap-2 mb-4">
          <button
            onClick={selectAllParticipants}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Select All
          </button>
          <button
            onClick={clearSelection}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Selection
          </button>
          <button
            onClick={generateEmailPreviews}
            disabled={selectedParticipants.size === 0}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-400"
          >
            Preview Emails ({selectedParticipants.size})
          </button>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-300">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Select</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Response ID</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Email</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Gender</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Tier 1 Person</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Tier 2 Person</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Tier 3 Person</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Passkey</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Study Day</th>
              <th className="px-4 py-2 border-b text-left text-sm font-medium text-gray-700">Recorded Date</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((response) => {
              const canEmail = canReceiveEmail(response);
              const isDisabled = !response.email || response.blacklisted || !canEmail;
              
              return (
              <tr key={response.response_id} className={`hover:bg-gray-50 ${response.blacklisted ? 'bg-red-50' : ''} ${!canEmail && response.day ? 'bg-yellow-50' : ''}`}>
                <td className="px-4 py-2 border-b text-sm text-gray-900">
                  <input
                    type="checkbox"
                    checked={selectedParticipants.has(response.response_id)}
                    onChange={() => toggleParticipantSelection(response.response_id)}
                    disabled={isDisabled}
                    className="w-4 h-4"
                  />
                </td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.response_id}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.email}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.gender}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier1_person}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier2_person}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.tier3_person}</td>
                <td className="px-4 py-2 border-b text-sm text-gray-900">{response.passkey_three_1 || 'optimisticduck'}</td>
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
              );
            })}
          </tbody>
        </table>
      </div>
      
      {responses.length === 0 && (
        <div className="text-center text-gray-500 mt-4">
          No survey responses found.
        </div>
      )}

      {/* Email Preview Modal */}
      {showEmailPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Email Preview ({previewEmails.length} emails)</h2>
            
            <div className="space-y-4 mb-6">
              {previewEmails.slice(0, 3).map((email, index) => (
                <div key={index} className="border p-4 rounded-lg">
                  <div className="mb-2">
                    <strong>To:</strong> {email.to} <span className="text-gray-500">(Day {email.participantDay})</span>
                  </div>
                  <div className="mb-2">
                    <strong>Subject:</strong> {email.subject}
                  </div>
                  <div className="mb-2">
                    <strong>Message:</strong>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded">
                    {email.text}
                  </pre>
                </div>
              ))}
              
              {previewEmails.length > 3 && (
                <div className="text-center text-gray-500">
                  ... and {previewEmails.length - 3} more emails
                </div>
              )}
            </div>
            
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowEmailPreview(false)}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={sendEmails}
                disabled={sendingEmails}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:bg-gray-400"
              >
                {sendingEmails ? 'Sending...' : `Send All ${previewEmails.length} Emails`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}