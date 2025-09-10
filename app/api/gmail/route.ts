import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

interface EmailRequest {
  emails: Array<{
    to: string;
    subject: string;
    text: string;
  }>;
}

interface EmailResult {
  to: string;
  success: boolean;
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as EmailRequest;
    const { emails } = body;

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

    const transporter = nodemailer.createTransporter({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    const results: EmailResult[] = [];

    for (const email of emails) {
      try {
        await transporter.sendMail({
          from: emailUser,
          to: email.to,
          subject: email.subject,
          text: email.text,
        });

        results.push({
          to: email.to,
          success: true,
        });
      } catch (error) {
        console.error(`Failed to send email to ${email.to}:`, error);
        results.push({
          to: email.to,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    return NextResponse.json({
      message: `Sent ${successCount} emails successfully, ${failureCount} failed`,
      results,
    });
  } catch (error) {
    console.error('Email sending error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}