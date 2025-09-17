import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface EmailRequest {
  emails: Array<{
    to: string;
    subject: string;
    text: string;
    participantId?: string;
    currentDay?: number;
    isNoEmailDay?: boolean;
  }>;
  batchId?: string;
}

interface EmailResult {
  to: string;
  success: boolean;
  error?: string;
  timestamp: string;
  participantId?: string;
  previousDay?: number;
  newDay?: number;
}

interface BatchProgress {
  batchId: string;
  total: number;
  sent: number;
  failed: number;
  completed: boolean;
  results: EmailResult[];
  startTime: string;
}

// In-memory storage for batch progress (in production, use Redis or database)
const batchProgress = new Map<string, BatchProgress>();

// Helper function to send emails in batches with concurrency control
async function sendEmailsBatch(emails: Array<{to: string; subject: string; text: string; participantId?: string; currentDay?: number; isNoEmailDay?: boolean}>, transporter: nodemailer.Transporter, batchId: string) {
  const BATCH_SIZE = 5; // Send 5 emails concurrently
  const DELAY_BETWEEN_BATCHES = 1000; // 1 second delay between batches
  
  const progress = batchProgress.get(batchId)!;
  
  for (let i = 0; i < emails.length; i += BATCH_SIZE) {
    const batch = emails.slice(i, i + BATCH_SIZE);
    
    // Send batch concurrently
    const batchPromises = batch.map(async (email) => {
      try {
        // Check if this is a no-email day (days 23-35)
        if (email.isNoEmailDay) {
          // Skip sending email but still increment day
          let newDay = email.currentDay;
          if (email.participantId && email.currentDay !== undefined) {
            newDay = email.currentDay + 1;

            // Update day in database
            try {
              const updateResponse = await fetch('/api/supabase', {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  responseId: email.participantId,
                  day: newDay.toString()
                }),
              });

              if (!updateResponse.ok) {
                console.error(`Failed to update day for participant ${email.participantId}`);
              }
            } catch (updateError) {
              console.error(`Error updating day for participant ${email.participantId}:`, updateError);
            }
          }

          const result: EmailResult = {
            to: email.to,
            success: true,
            timestamp: new Date().toISOString(),
            participantId: email.participantId,
            previousDay: email.currentDay,
            newDay: newDay,
          };

          progress.results.push(result);
          progress.sent++;

          return result;
        }

        // Send actual email for email days
        await transporter.sendMail({
          from: process.env.EMAIL_USER,
          to: email.to,
          subject: email.subject,
          text: email.text,
        });

        // If email was sent successfully and we have participant info, increment day
        let newDay = email.currentDay;
        if (email.participantId && email.currentDay !== undefined) {
          newDay = email.currentDay + 1;

          // Update day in database
          try {
            const updateResponse = await fetch('/api/supabase', {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                responseId: email.participantId,
                day: newDay.toString()
              }),
            });

            if (!updateResponse.ok) {
              console.error(`Failed to update day for participant ${email.participantId}`);
            }
          } catch (updateError) {
            console.error(`Error updating day for participant ${email.participantId}:`, updateError);
          }
        }

        const result: EmailResult = {
          to: email.to,
          success: true,
          timestamp: new Date().toISOString(),
          participantId: email.participantId,
          previousDay: email.currentDay,
          newDay: newDay,
        };

        progress.results.push(result);
        progress.sent++;

        return result;
      } catch (error) {
        console.error(`Failed to send email to ${email.to}:`, error);
        
        const result: EmailResult = {
          to: email.to,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          participantId: email.participantId,
          previousDay: email.currentDay,
        };
        
        progress.results.push(result);
        progress.failed++;
        
        return result;
      }
    });

    await Promise.all(batchPromises);
    
    // Update progress
    batchProgress.set(batchId, progress);
    
    // Add delay between batches to avoid rate limits
    if (i + BATCH_SIZE < emails.length) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
    }
  }
  
  progress.completed = true;
  batchProgress.set(batchId, progress);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EmailRequest;
    const { emails, batchId } = body;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: 'Invalid email data' },
        { status: 400 }
      );
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPassword = process.env.EMAIL_APP_PASSWORD;

    if (!emailUser || !emailPassword) {
      return NextResponse.json(
        { error: 'Email credentials not configured' },
        { status: 500 }
      );
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    // Generate batch ID if not provided
    const finalBatchId = batchId || `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize progress tracking
    const progress: BatchProgress = {
      batchId: finalBatchId,
      total: emails.length,
      sent: 0,
      failed: 0,
      completed: false,
      results: [],
      startTime: new Date().toISOString(),
    };
    
    batchProgress.set(finalBatchId, progress);

    // Start sending emails in background (don't await)
    sendEmailsBatch(emails, transporter, finalBatchId).catch(error => {
      console.error('Background email sending error:', error);
      const currentProgress = batchProgress.get(finalBatchId);
      if (currentProgress) {
        currentProgress.completed = true;
        batchProgress.set(finalBatchId, currentProgress);
      }
    });

    // Return immediately with batch ID for progress tracking
    return NextResponse.json({
      message: 'Email sending started',
      batchId: finalBatchId,
      total: emails.length,
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for checking batch progress
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const batchId = url.searchParams.get('batchId');

  if (!batchId) {
    return NextResponse.json(
      { error: 'Batch ID required' },
      { status: 400 }
    );
  }

  const progress = batchProgress.get(batchId);
  
  if (!progress) {
    return NextResponse.json(
      { error: 'Batch not found' },
      { status: 404 }
    );
  }

  // Clean up completed batches after 1 hour
  if (progress.completed) {
    const startTime = new Date(progress.startTime).getTime();
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    
    if (now - startTime > oneHour) {
      batchProgress.delete(batchId);
      return NextResponse.json(
        { error: 'Batch expired' },
        { status: 404 }
      );
    }
  }

  return NextResponse.json(progress);
}