export type EmailDeliveryStatus = 'pending' | 'sent' | 'failed';

export interface GmailMemberDraft {
  memberId: string;
  memberName: string;
  recipientEmail: string;
  responsibility: string;
  presentationDurationLabel: string;
  materialLinks: Array<{ label: string; url: string }>;
  subject: string;
  bodyText: string;
}

export interface EmailDispatchLog {
  id: string;
  projectId: string;
  memberId: string;
  memberName: string;
  recipientEmail: string;
  subject: string;
  bodyText: string;
  status: 'sent' | 'failed';
  gmailMessageId: string | null;
  gmailThreadId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  lastAttemptAt: string;
  sentAt: string | null;
}

export interface RehearsalReminderConfig {
  method: 'email' | 'popup';
  minutes: number;
}

export interface CreateCalendarRehearsalInput {
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  date: string;
  time: string;
  durationMinutes: number;
  modality: 'Presencial' | 'Online';
  location: string;
  meetingLink: string;
  generateGoogleMeet: boolean;
  attendeeEmails: string[];
  reminders: RehearsalReminderConfig[];
  timeZone: string;
}

export interface GoogleCalendarCreateResult {
  googleCalendarEventId: string;
  googleCalendarHtmlLink: string;
  googleMeetLink: string | null;
  syncedAt: string;
}

export interface GoogleSessionStatus {
  connected: boolean;
  email: string | null;
  displayName: string | null;
  expiresAt: string | null;
  isExpired: boolean;
  scopes: string[];
}
