import nodemailer, { Transporter } from 'nodemailer';
import async from 'async';
import { env } from '../config/env.js';

interface EmailTask {
  to: string;
  subject: string;
  text: string;
  html: string;
  retries: number;
}

// Format ISO timestamp into clean, human-readable UTC timestamp for emails (e.g. "Nov 8, 2026, 07:06:53 UTC")
function formatEmailTimestamp(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return (
      new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        timeZone: 'UTC',
        hour12: false,
      }).format(date) + ' UTC'
    );
  } catch {
    return dateStr;
  }
}

// In-Memory Task Queue service using async.queue with concurrency limit = 2 and retry policy
export class EmailService {
  private transporter: Transporter | null = null;
  private readonly queue: async.QueueObject<EmailTask>;

  constructor() {
    this.initTransporter();

    // Initialize async.queue which auto-picks and executes pushed tasks immediately up to concurrency limit
    this.queue = async.queue<EmailTask>(async (task) => {
      await this.processWithRetry(task);
    }, 2);

    this.queue.error((err, task) => {
      console.error(`[Email Queue] Unhandled task error for recipient ${task.to}:`, err);
    });
  }

  // Initialize Nodemailer SMTP transporter if host credentials exist
  private initTransporter(): void {
    if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT || 587,
        secure: env.SMTP_PORT === 465,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASS,
        },
      });
    }
  }

  // Push registration verification OTP email task into in-memory queue
  sendRegistrationOtpEmail(email: string, otpCode: string): void {
    const task: EmailTask = {
      to: email,
      subject: 'DevPulse - Verify Your Email Address',
      text: `Your DevPulse registration verification code is: ${otpCode}. This code will expire in 5 minutes.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email Address</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5efe3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5efe3; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 2px solid #18181b; box-shadow: 6px 6px 0px #18181b; border-radius: 8px; overflow: hidden;">
                  <!-- Retro Window Header Bar -->
                  <tr>
                    <td style="background-color: #79a7d3; border-bottom: 2px solid #18181b; padding: 10px 16px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width: 70px; min-width: 70px; white-space: nowrap; line-height: 1; vertical-align: middle;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ff6b6b; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #fde047; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #78d8c5; border: 1.5px solid #18181b; vertical-align: middle;"></span>
                          </td>
                          <td align="center" style="font-size: 10px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: #18181b; white-space: nowrap;">
                            DEVPULSE // ACCOUNT VERIFICATION
                          </td>
                          <td style="width: 70px; min-width: 70px;"></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Content Body -->
                  <tr>
                    <td style="padding: 28px 24px;">
                      <div style="font-size: 16px; font-weight: 900; letter-spacing: -0.02em; color: #18181b; margin-bottom: 20px;">
                        DevPulse
                      </div>
                      <h1 style="font-size: 24px; font-weight: 900; color: #18181b; margin: 0 0 10px 0; letter-spacing: -0.03em;">
                        Verify your email address
                      </h1>
                      <p style="font-size: 14px; color: #52525b; line-height: 1.5; margin: 0 0 20px 0;">
                        Thank you for registering. Use the one-time verification code below to activate your account and workspace monitoring:
                      </p>
                      <!-- Retro OTP Box -->
                      <div style="background-color: #fef08a; border: 2px solid #18181b; box-shadow: 4px 4px 0px #18181b; border-radius: 6px; padding: 22px; text-align: center; margin: 24px 0;">
                        <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.16em; color: #854d0e; margin-bottom: 8px;">
                          One-Time Verification Code
                        </div>
                        <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #18181b;">
                          ${otpCode}
                        </div>
                      </div>
                      <p style="font-size: 12px; color: #71717a; line-height: 1.5; margin: 0;">
                        This code expires in <strong>5 minutes</strong>. If you did not create a DevPulse account, you can safely ignore this email.
                      </p>
                    </td>
                  </tr>
                  <!-- Retro Window Footer -->
                  <tr>
                    <td style="border-top: 2px solid #18181b; background-color: #f5efe3; padding: 14px 24px; text-align: center; font-size: 11px; color: #71717a; font-weight: bold;">
                      DevPulse Real-time Telemetry &bull; Automated Security Delivery
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      retries: 0,
    };

    this.queue.push(task);
  }

  // Push password reset OTP verification email task into in-memory queue
  sendPasswordResetOtpEmail(email: string, otpCode: string): void {
    const task: EmailTask = {
      to: email,
      subject: 'DevPulse - Password Reset Verification Code',
      text: `Your DevPulse password reset code is: ${otpCode}. This code will expire in 5 minutes.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Password Reset Request</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5efe3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5efe3; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 2px solid #18181b; box-shadow: 6px 6px 0px #18181b; border-radius: 8px; overflow: hidden;">
                  <!-- Retro Window Header Bar -->
                  <tr>
                    <td style="background-color: #b8a1d9; border-bottom: 2px solid #18181b; padding: 10px 16px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width: 70px; min-width: 70px; white-space: nowrap; line-height: 1; vertical-align: middle;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ff6b6b; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #fde047; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #78d8c5; border: 1.5px solid #18181b; vertical-align: middle;"></span>
                          </td>
                          <td align="center" style="font-size: 10px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: #18181b; white-space: nowrap;">
                            DEVPULSE // SECURITY AUTHENTICATION
                          </td>
                          <td style="width: 70px; min-width: 70px;"></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Content Body -->
                  <tr>
                    <td style="padding: 28px 24px;">
                      <div style="font-size: 16px; font-weight: 900; letter-spacing: -0.02em; color: #18181b; margin-bottom: 20px;">
                        DevPulse
                      </div>
                      <h1 style="font-size: 24px; font-weight: 900; color: #18181b; margin: 0 0 10px 0; letter-spacing: -0.03em;">
                        Password reset verification
                      </h1>
                      <p style="font-size: 14px; color: #52525b; line-height: 1.5; margin: 0 0 20px 0;">
                        We received an authorization request to reset the password for your account. Use the verification code below to proceed:
                      </p>
                      <!-- Retro OTP Box -->
                      <div style="background-color: #fef08a; border: 2px solid #18181b; box-shadow: 4px 4px 0px #18181b; border-radius: 6px; padding: 22px; text-align: center; margin: 24px 0;">
                        <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.16em; color: #854d0e; margin-bottom: 8px;">
                          Password Reset Code
                        </div>
                        <div style="font-family: 'Courier New', Courier, monospace; font-size: 34px; font-weight: 900; letter-spacing: 8px; color: #18181b;">
                          ${otpCode}
                        </div>
                      </div>
                      <p style="font-size: 12px; color: #71717a; line-height: 1.5; margin: 0;">
                        This code expires in <strong>5 minutes</strong>. If you did not make this request, please change your credentials immediately.
                      </p>
                    </td>
                  </tr>
                  <!-- Retro Window Footer -->
                  <tr>
                    <td style="border-top: 2px solid #18181b; background-color: #f5efe3; padding: 14px 24px; text-align: center; font-size: 11px; color: #71717a; font-weight: bold;">
                      DevPulse Real-time Telemetry &bull; Automated Security Delivery
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      retries: 0,
    };

    this.queue.push(task);
  }

  // Push downtime incident alert email task into in-memory queue
  sendIncidentAlertEmail(
    email: string,
    monitorName: string,
    monitorUrl: string,
    startedAt: string,
    errorDetails: { statusCode: number; errorMessage: string },
    aiSummary?: string
  ): void {
    const formattedStartedAt = formatEmailTimestamp(startedAt);

    const summarySection = aiSummary
      ? `
        <div style="background-color: #f3e8ff; border: 2px solid #18181b; box-shadow: 3px 3px 0px #18181b; border-radius: 6px; padding: 16px; margin: 20px 0;">
          <div style="font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.14em; color: #6b21a8; margin-bottom: 6px;">
            AI Post-Mortem Diagnosis
          </div>
          <div style="font-size: 13px; color: #3b0764; line-height: 1.5;">
            ${aiSummary}
          </div>
        </div>
      `
      : '';

    const task: EmailTask = {
      to: email,
      subject: `[CRITICAL ALERT] Monitor ${monitorName} is DOWN`,
      text: `Monitor "${monitorName}" (${monitorUrl}) is DOWN starting at ${formattedStartedAt}. Status code: ${errorDetails.statusCode}. Error: ${errorDetails.errorMessage}.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Service Outage Alert</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5efe3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5efe3; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 2px solid #18181b; box-shadow: 6px 6px 0px #18181b; border-radius: 8px; overflow: hidden;">
                  <!-- Retro Window Header Bar -->
                  <tr>
                    <td style="background-color: #ff6b6b; border-bottom: 2px solid #18181b; padding: 10px 16px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width: 70px; min-width: 70px; white-space: nowrap; line-height: 1; vertical-align: middle;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ff6b6b; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #fde047; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #78d8c5; border: 1.5px solid #18181b; vertical-align: middle;"></span>
                          </td>
                          <td align="center" style="font-size: 10px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: #18181b; white-space: nowrap;">
                            DEVPULSE // CRITICAL OUTAGE ALERT
                          </td>
                          <td style="width: 70px; min-width: 70px;"></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Content Body -->
                  <tr>
                    <td style="padding: 28px 24px;">
                      <!-- Outage Badge Banner -->
                      <div style="background-color: #ffc5c2; border: 2px solid #18181b; box-shadow: 4px 4px 0px #18181b; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                        <span style="display: inline-block; background-color: #ff6b6b; color: #18181b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; padding: 3px 8px; border: 1.5px solid #18181b; border-radius: 4px; margin-bottom: 8px;">
                          CRITICAL OUTAGE
                        </span>
                        <h1 style="font-size: 20px; font-weight: 900; color: #7f1d1d; margin: 0 0 4px 0;">
                          ${monitorName} is DOWN
                        </h1>
                        <p style="font-size: 12px; color: #991b1b; margin: 0;">
                          Service health checks are failing as of ${formattedStartedAt}
                        </p>
                      </div>

                      <!-- Telemetry Breakdown Table -->
                      <div style="border: 2px solid #18181b; border-radius: 6px; background-color: #fafafa; overflow: hidden; margin-bottom: 20px;">
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; width: 120px; border-bottom: 1px solid #e4e4e7;">Target Name</td>
                            <td style="padding: 10px 14px; font-weight: 900; color: #18181b; border-bottom: 1px solid #e4e4e7;">${monitorName}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Endpoint URL</td>
                            <td style="padding: 10px 14px; font-family: 'Courier New', monospace; font-size: 12px; color: #18181b; word-break: break-all; border-bottom: 1px solid #e4e4e7;">${monitorUrl}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Status Code</td>
                            <td style="padding: 10px 14px; font-family: 'Courier New', monospace; font-weight: 900; color: #dc2626; border-bottom: 1px solid #e4e4e7;">HTTP ${errorDetails.statusCode || 'ERROR'}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Error Reason</td>
                            <td style="padding: 10px 14px; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; color: #dc2626; border-bottom: 1px solid #e4e4e7;">${errorDetails.errorMessage || 'Target unreachable'}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a;">Detected At</td>
                            <td style="padding: 10px 14px; font-size: 12px; color: #52525b;">${formattedStartedAt}</td>
                          </tr>
                        </table>
                      </div>

                      ${summarySection}

                      <p style="font-size: 12px; color: #71717a; line-height: 1.5; margin: 0;">
                        DevPulse automated monitoring will notify you as soon as the target recovers.
                      </p>
                    </td>
                  </tr>
                  <!-- Retro Window Footer -->
                  <tr>
                    <td style="border-top: 2px solid #18181b; background-color: #f5efe3; padding: 14px 24px; text-align: center; font-size: 11px; color: #71717a; font-weight: bold;">
                      DevPulse Real-time Telemetry &bull; Automated Incident Engine
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      retries: 0,
    };

    this.queue.push(task);
  }

  // Push service recovery notification email task into in-memory queue
  sendIncidentResolvedEmail(
    email: string,
    monitorName: string,
    monitorUrl: string,
    startedAt: string,
    resolvedAt: string,
    downtimeDuration: string
  ): void {
    const formattedStartedAt = formatEmailTimestamp(startedAt);
    const formattedResolvedAt = formatEmailTimestamp(resolvedAt);

    const task: EmailTask = {
      to: email,
      subject: `[RESOLVED] Monitor ${monitorName} is BACK UP`,
      text: `Monitor "${monitorName}" (${monitorUrl}) has recovered at ${formattedResolvedAt}. Total downtime duration: ${downtimeDuration}.`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Service Recovered</title>
        </head>
        <body style="margin: 0; padding: 0; background-color: #f5efe3; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #18181b;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f5efe3; padding: 32px 16px;">
            <tr>
              <td align="center">
                <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #ffffff; border: 2px solid #18181b; box-shadow: 6px 6px 0px #18181b; border-radius: 8px; overflow: hidden;">
                  <!-- Retro Window Header Bar -->
                  <tr>
                    <td style="background-color: #78d8c5; border-bottom: 2px solid #18181b; padding: 10px 16px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                        <tr>
                          <td style="width: 70px; min-width: 70px; white-space: nowrap; line-height: 1; vertical-align: middle;">
                            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #ff6b6b; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #fde047; border: 1.5px solid #18181b; margin-right: 4px; vertical-align: middle;"></span><span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background-color: #78d8c5; border: 1.5px solid #18181b; vertical-align: middle;"></span>
                          </td>
                          <td align="center" style="font-size: 10px; font-weight: 900; letter-spacing: 0.16em; text-transform: uppercase; color: #18181b; white-space: nowrap;">
                            DEVPULSE // SERVICE RECOVERY
                          </td>
                          <td style="width: 70px; min-width: 70px;"></td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <!-- Content Body -->
                  <tr>
                    <td style="padding: 28px 24px;">
                      <!-- Recovery Badge Banner -->
                      <div style="background-color: #78d8c5; border: 2px solid #18181b; box-shadow: 4px 4px 0px #18181b; border-radius: 6px; padding: 16px; margin-bottom: 20px;">
                        <span style="display: inline-block; background-color: #d9ef9f; color: #18181b; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.12em; padding: 3px 8px; border: 1.5px solid #18181b; border-radius: 4px; margin-bottom: 8px;">
                          UP
                        </span>
                        <h1 style="font-size: 20px; font-weight: 900; color: #064e3b; margin: 0 0 4px 0;">
                          ${monitorName} is BACK UP
                        </h1>
                        <p style="font-size: 12px; color: #065f46; margin: 0;">
                          Service recovered and health restored at ${formattedResolvedAt}
                        </p>
                      </div>

                      <!-- Telemetry Breakdown Table -->
                      <div style="border: 2px solid #18181b; border-radius: 6px; background-color: #fafafa; overflow: hidden; margin-bottom: 20px;">
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="font-size: 13px;">
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; width: 120px; border-bottom: 1px solid #e4e4e7;">Target Name</td>
                            <td style="padding: 10px 14px; font-weight: 900; color: #18181b; border-bottom: 1px solid #e4e4e7;">${monitorName}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Endpoint URL</td>
                            <td style="padding: 10px 14px; font-family: 'Courier New', monospace; font-size: 12px; color: #18181b; word-break: break-all; border-bottom: 1px solid #e4e4e7;">${monitorUrl}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Status</td>
                            <td style="padding: 10px 14px; font-family: 'Courier New', monospace; font-weight: 900; color: #059669; border-bottom: 1px solid #e4e4e7;">UP</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Total Downtime</td>
                            <td style="padding: 10px 14px; font-weight: 900; color: #e89b55; border-bottom: 1px solid #e4e4e7;">${downtimeDuration}</td>
                          </tr>
                          <tr style="border-bottom: 1px solid #e4e4e7;">
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a; border-bottom: 1px solid #e4e4e7;">Outage Began</td>
                            <td style="padding: 10px 14px; font-size: 12px; color: #52525b; border-bottom: 1px solid #e4e4e7;">${formattedStartedAt}</td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 14px; font-weight: bold; color: #71717a;">Resolved At</td>
                            <td style="padding: 10px 14px; font-size: 12px; color: #52525b;">${formattedResolvedAt}</td>
                          </tr>
                        </table>
                      </div>

                      <p style="font-size: 12px; color: #71717a; line-height: 1.5; margin: 0;">
                        DevPulse continuous automated ping engine is active and monitoring all endpoints.
                      </p>
                    </td>
                  </tr>
                  <!-- Retro Window Footer -->
                  <tr>
                    <td style="border-top: 2px solid #18181b; background-color: #f5efe3; padding: 14px 24px; text-align: center; font-size: 11px; color: #71717a; font-weight: bold;">
                      DevPulse Real-time Telemetry &bull; Automated Recovery Engine
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </body>
        </html>
      `,
      retries: 0,
    };

    this.queue.push(task);
  }

  // Process email task with up to 3 retry attempts and exponential backoff
  private async processWithRetry(task: EmailTask): Promise<void> {
    const maxRetries = 3;

    while (task.retries < maxRetries) {
      try {
        if (!this.transporter) {
          console.log(`[Email Mock] Destination: ${task.to} | Subject: ${task.subject}`);
          return;
        }

        await this.transporter.sendMail({
          from: env.SMTP_FROM,
          to: task.to,
          subject: task.subject,
          text: task.text,
          html: task.html,
        });

        console.log(`[Email Service] Sent email successfully to ${task.to}`);
        return;
      } catch (error) {
        task.retries++;
        console.error(`[Email Service] Failure (attempt ${task.retries}/${maxRetries}) to ${task.to}:`, error);

        if (task.retries >= maxRetries) {
          console.error(`[Email Service] Task failed permanently for ${task.to} after ${maxRetries} retries.`);
          return;
        }

        // Exponential backoff retry
        const delayMs = Math.pow(2, task.retries) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }
}

export const emailService = new EmailService();
