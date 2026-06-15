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
}
