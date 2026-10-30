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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #090d16; color: #f9fafb; border-radius: 8px;">
          <h2 style="color: #3b82f6; margin-bottom: 16px;">DevPulse Account Verification</h2>
          <p style="color: #94a3b8; font-size: 14px;">Thank you for registering. Use the verification code below to activate your account:</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #101726; border: 1px solid #1e293b; border-radius: 6px; text-align: center;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #60a5fa;">${otpCode}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">This code expires in 5 minutes. If you did not create a DevPulse account, please disregard this email.</p>
        </div>
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
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #090d16; color: #f9fafb; border-radius: 8px;">
          <h2 style="color: #3b82f6; margin-bottom: 16px;">DevPulse Security Verification</h2>
          <p style="color: #94a3b8; font-size: 14px;">We received a request to reset your password. Use the verification code below to proceed:</p>
          <div style="margin: 24px 0; padding: 16px; background-color: #101726; border: 1px solid #1e293b; border-radius: 6px; text-align: center;">
            <span style="font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #60a5fa;">${otpCode}</span>
          </div>
          <p style="color: #64748b; font-size: 12px;">This code expires in 5 minutes. If you did not request this code, please ignore this email.</p>
        </div>
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
