interface Participant {
  email: string;
  tier1_person?: string | null;
  tier2_person?: string | null;
  tier3_person?: string | null;
  gender?: string | null;
  passkey_three_1?: string | null;
}

export function generateDailySurveyEmail(participant: Participant, day: number): { subject: string; text: string } {
  const surveyLink = `https://fsu.qualtrics.com/jfe/form/SV_54iR2R2FGOVLyx8?email=${encodeURIComponent(participant.email || '')}&tier1=${encodeURIComponent(participant.tier1_person || '')}&tier2=${encodeURIComponent(participant.tier2_person || '')}&tier3=${encodeURIComponent(participant.tier3_person || '')}&QID61_1=${encodeURIComponent(participant.passkey_three_1 || 'optimisticduck')}`;
  
  const chatLink = participant.gender === '1' 
    ? 'https://long-sp25-chatbot.vercel.app/seb/'
    : 'https://long-sp25-chatbot.vercel.app/';
  
  const passkey = participant.passkey_three_1 || 'optimisticduck';

  const subject = `Experiences with AI - Day ${day}`;
  
  const text = `Dear Participant,

Thank you for your continued participation in the study "Experiences with AI." Here is your link for today's survey.

Survey Link: ${surveyLink}

In addition, here is a link to the AI chat:
AI Chat Link: ${chatLink}
Your Passkey to log in to the AI: ${passkey}

Best regards,
Research Team`;

  return { subject, text };
}

export function generateCheckInSurveyEmail(): { subject: string; text: string } {
  const subject = "Experiences with AI - Check-in Survey";
  
  const text = `Dear Participant,

You have completed the 21 daily survey portion of our study - we ask that you please complete this brief check-in survey, which will account for 0.5 of your earned credits. 

Survey Link: https://fsu.qualtrics.com/jfe/form/SV_1LLkzdjWipIS6bQ

A final survey will be sent to you in two weeks, accounting for the remaining 0.5 credits for this study! 

Best regards,
Research Team`;

  return { subject, text };
}

export function generateFinalSurveyEmail(): { subject: string; text: string } {
  const subject = "Experiences with AI - Final Survey";
  
  const text = `Dear Participant,

Thank you for your continued participation in our study. Here is the link to your final survey:

Survey Link: https://fsu.qualtrics.com/jfe/form/SV_1LLkzdjWipIS6bQ

We greatly appreciate your time and effort throughout this study!

Best regards,
Research Team`;

  return { subject, text };
}

export type EmailType = 'daily' | 'checkin' | 'final';

export function generateEmail(type: EmailType, participant: Participant, day?: number): { subject: string; text: string } {
  switch (type) {
    case 'daily':
      if (!day || day < 1 || day > 21) {
        throw new Error('Day must be between 1 and 21 for daily emails');
      }
      return generateDailySurveyEmail(participant, day);
    case 'checkin':
      return generateCheckInSurveyEmail();
    case 'final':
      return generateFinalSurveyEmail();
    default:
      throw new Error('Invalid email type');
  }
}

export function generateEmailByDay(participant: Participant): { subject: string; text: string } | null {
  const day = parseInt(participant.day as string);
  
  if (!day || day < 1) {
    return null; // No email if day is not set or invalid
  }
  
  if (day >= 1 && day <= 21) {
    // Daily survey emails (Days 1-21)
    return generateDailySurveyEmail(participant, day);
  } else if (day === 22) {
    // Check-in survey (Day 22)
    return generateCheckInSurveyEmail();
  } else if (day === 36) {
    // Final survey (Day 36)
    return generateFinalSurveyEmail();
  }
  
  // No email for other days (23-35, 37+)
  return null;
}