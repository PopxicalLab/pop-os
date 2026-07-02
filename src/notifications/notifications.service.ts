import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private prisma: PrismaService) {}

  // Build a nodemailer transporter from .env vars.
  // Returns null if SMTP is not configured — callers should handle this gracefully.
  private makeTransporter() {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS } = process.env;
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: parseInt(SMTP_PORT || '587', 10),
      secure: parseInt(SMTP_PORT || '587', 10) === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      tls: { rejectUnauthorized: false },
    });
  }

  // Send payment alert emails for invoices that are overdue or due within
  // ALERT_DAYS days (default 10). Returns a summary of what was sent.
  async sendPaymentAlerts(): Promise<{ sent: number; skipped: number; details: string[]; smtpConfigured: boolean }> {
    const alertDays = parseInt(process.env.ALERT_DAYS || '10', 10);
    const to        = process.env.ALERT_EMAIL_TO;
    const from      = process.env.SMTP_FROM || process.env.SMTP_USER;
    const transporter = this.makeTransporter();

    if (!transporter || !to) {
      return { sent: 0, skipped: 0, details: [], smtpConfigured: false };
    }

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + alertDays);

    const docs = await this.prisma.accountingDocument.findMany({
      where: {
        status:  'ACTIVE',
        dueDate: { lte: cutoff },
      },
      include: { project: { select: { name: true } } },
      orderBy: { dueDate: 'asc' },
    });

    if (!docs.length) {
      return { sent: 0, skipped: 0, details: ['No invoices due within alert window.'], smtpConfigured: true };
    }

    const now = new Date();
    const rows = docs.map(d => {
      const due   = d.dueDate ? new Date(d.dueDate) : null;
      const days  = due ? Math.round((due.getTime() - now.getTime()) / 86_400_000) : null;
      const label = days === null    ? 'No due date'
                  : days < 0        ? `OVERDUE by ${Math.abs(days)}d`
                  : days === 0      ? 'Due TODAY'
                  : `Due in ${days}d`;
      return `  • ${d.docNo} | ${d.debtorName || d.project?.name || '—'} | RM ${d.amount?.toLocaleString() ?? '—'} | ${label}`;
    }).join('\n');

    const subject = `[Pop OS] ${docs.length} invoice${docs.length !== 1 ? 's' : ''} need attention`;
    const text = `Payment alert from Pop OS\n\n${rows}\n\nLog in to Pop OS → Financial to take action.`;

    const details: string[] = [];
    let sent = 0;

    try {
      await transporter.sendMail({ from, to, subject, text });
      sent = 1;
      details.push(`Email sent to ${to} covering ${docs.length} invoice(s).`);
      this.logger.log(`Payment alert email sent to ${to}`);
    } catch (err) {
      details.push(`Failed to send email: ${err.message}`);
      this.logger.error('Payment alert email failed', err);
    }

    return { sent, skipped: 0, details, smtpConfigured: true };
  }

  // Send a welcome email to a new joiner with their login credentials.
  // company drives branding: LPS = Lorrypop Studio (amber), PXL = Popxical Lab (teal), default = Pop Group (indigo).
  async sendWelcomeEmail(params: {
    name:      string;
    email:     string;
    password:  string;
    role:      string;
    company?:  string | null;
  }): Promise<void> {
    const transporter = this.makeTransporter();
    if (!transporter) {
      this.logger.warn('Welcome email skipped — SMTP not configured');
      return;
    }

    const appUrl = process.env.APP_URL || 'http://192.168.1.40:3000';
    const from   = process.env.SMTP_FROM || process.env.SMTP_USER;

    const BRANDING: Record<string, { name: string; color: string; bg: string }> = {
      LPS:   { name: 'Lorrypop Studio',  color: '#f59e0b', bg: '#fffbeb' },
      PXL:   { name: 'Popxical Lab',     color: '#14b8a6', bg: '#f0fdfa' },
      GROUP: { name: 'Pop Group',        color: '#6366f1', bg: '#eef2ff' },
    };
    const brand = BRANDING[params.company ?? ''] ?? { name: 'Pop Group', color: '#6366f1', bg: '#eef2ff' };
    const roleLabel = params.role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">

        <!-- Header -->
        <tr><td style="background:${brand.color};padding:32px 40px;">
          <p style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">${brand.name}</p>
          <p style="margin:6px 0 0;font-size:14px;color:rgba(255,255,255,0.85);">Welcome to Pop OS</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:36px 40px;">
          <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#111827;">Hi ${params.name} 👋</p>
          <p style="margin:0 0 28px;font-size:15px;color:#6b7280;line-height:1.6;">
            Your Pop OS account has been set up. Use the credentials below to log in and get started.
          </p>

          <!-- Credentials box -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${brand.bg};border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
            <tr><td style="padding:20px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:4px;">Email</td>
                </tr>
                <tr>
                  <td style="font-size:15px;color:#111827;font-family:monospace;padding-bottom:16px;">${params.email}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:4px;">Temporary Password</td>
                </tr>
                <tr>
                  <td style="font-size:15px;color:#111827;font-family:monospace;padding-bottom:16px;">${params.password}</td>
                </tr>
                <tr>
                  <td style="font-size:12px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;padding-bottom:4px;">Role</td>
                </tr>
                <tr>
                  <td style="font-size:15px;color:#111827;">${roleLabel}</td>
                </tr>
              </table>
            </td></tr>
          </table>

          <!-- CTA -->
          <table cellpadding="0" cellspacing="0"><tr><td>
            <a href="${appUrl}/login.html"
               style="display:inline-block;background:${brand.color};color:#ffffff;text-decoration:none;
                      font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;">
              Log in to Pop OS →
            </a>
          </td></tr></table>

          <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;line-height:1.6;">
            Please change your password after your first login.<br>
            If you have any issues, contact your admin.
          </p>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 40px;">
          <p style="margin:0;font-size:12px;color:#9ca3af;">
            ${brand.name} · Pop OS · <a href="${appUrl}" style="color:${brand.color};text-decoration:none;">${appUrl}</a>
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await transporter.sendMail({
        from,
        to:      params.email,
        subject: `Welcome to Pop OS — ${brand.name}`,
        html,
      });
      this.logger.log(`Welcome email sent to ${params.email}`);
    } catch (err) {
      this.logger.error(`Welcome email failed for ${params.email}: ${err.message}`);
    }
  }
}
