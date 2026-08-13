import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

// Sends automated notifications into a WhatsApp group via whatsapp-web.js —
// an unofficial client that drives WhatsApp Web through a real, linked phone
// number (not Meta's paid Business API). Only starts if WHATSAPP_ENABLED=true,
// so dev machines that don't need it never pay the Puppeteer/Chromium cost.
// WHATSAPP_ENABLED must be on for the first-run QR scan too — the group ID
// isn't known yet at that point, so the client can't be gated on it.
const MAX_INIT_RETRIES = 5;

@Injectable()
export class WhatsappService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WhatsappService.name);
  private client: Client | null = null;
  private ready = false;
  private initAttempts = 0;
  private stopped = false;

  onModuleInit() {
    if (process.env.WHATSAPP_ENABLED !== 'true') {
      this.logger.warn('WHATSAPP_ENABLED not set to "true" — WhatsApp notifications disabled.');
      return;
    }
    this.connect();
  }

  // whatsapp-web.js occasionally throws during startup (e.g. "Execution
  // context was destroyed" when WhatsApp Web navigates mid-injection) — this
  // is a known race in the library, usually transient. Left unhandled, that
  // rejection crashes the entire Node process, not just this feature. So
  // initialize() is always awaited with a catch, and a failed attempt tears
  // down the client and retries with backoff instead of taking the app down.
  private connect() {
    this.client = new Client({
      // Session persisted to disk so the linked device survives server restarts
      // without re-scanning the QR code every time.
      authStrategy: new LocalAuth({ dataPath: 'whatsapp-session' }),
      puppeteer: {
        headless: true,
        executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      },
    });

    this.client.on('qr', (qr) => {
      this.logger.warn('Scan this QR code with WhatsApp → Linked Devices → Link a Device:');
      qrcode.generate(qr, { small: true });
    });

    this.client.on('ready', async () => {
      this.ready = true;
      this.initAttempts = 0;
      this.logger.log('WhatsApp bot connected.');
      // One-time setup helper — log every group the linked number belongs to
      // so the right ID can be copied into WHATSAPP_GROUP_ID. getChats() is
      // known to break against some WhatsApp Web versions (throws inside the
      // injected browser context) — never let that crash the server.
      try {
        const chats = await this.client!.getChats();
        const groups = chats.filter((c) => c.isGroup);
        this.logger.log(`Joined WhatsApp groups (${groups.length}):`);
        groups.forEach((g) => this.logger.log(`  "${g.name}" → ${g.id._serialized}`));
      } catch (err) {
        this.logger.error(`Could not list groups (getChats failed): ${err.message}`);
        this.logger.warn(
          'Fallback: send any message in the target group now — its ID will be logged below.',
        );
      }
    });

    // Fallback group-ID discovery — works even when getChats() is broken.
    // Have anyone send a message in the target group; log its name + ID from here.
    this.client.on('message', async (msg) => {
      if (!this.ready || !msg.from.endsWith('@g.us')) return;
      try {
        const chat = await msg.getChat();
        this.logger.log(`Message seen in group "${chat.name}" → ${msg.from} (copy into WHATSAPP_GROUP_ID)`);
      } catch {
        this.logger.log(`Message seen from group "${msg.from}" (chat id to copy into WHATSAPP_GROUP_ID)`);
      }
    });

    this.client.on('disconnected', (reason) => {
      this.ready = false;
      this.logger.error(`WhatsApp disconnected: ${reason}`);
    });

    this.client.on('auth_failure', (msg) => {
      this.logger.error(`WhatsApp auth failure: ${msg}`);
    });

    this.client.initialize().catch((err) => this.handleInitFailure(err));
  }

  private async handleInitFailure(err: Error) {
    this.ready = false;
    this.initAttempts += 1;
    this.logger.error(`WhatsApp initialize() failed (attempt ${this.initAttempts}): ${err.message}`);

    // Tear down the half-started client — reusing it after a failed
    // initialize() is unreliable, a fresh Client is safer to retry with.
    try {
      await this.client?.destroy();
    } catch {
      /* already broken — nothing to clean up */
    }
    this.client = null;

    if (this.stopped) return;

    if (this.initAttempts >= MAX_INIT_RETRIES) {
      this.logger.error(
        `WhatsApp bot gave up after ${MAX_INIT_RETRIES} failed attempts. ` +
          'Fix the underlying issue and restart the server to try again.',
      );
      return;
    }

    const delayMs = Math.min(5_000 * this.initAttempts, 30_000);
    this.logger.warn(`Retrying WhatsApp connect in ${delayMs / 1000}s...`);
    setTimeout(() => this.connect(), delayMs);
  }

  async onModuleDestroy() {
    this.stopped = true;
    await this.client?.destroy();
  }

  // Fire-and-forget send — never let a WhatsApp failure break the caller's request.
  private async send(text: string): Promise<void> {
    const groupId = process.env.WHATSAPP_GROUP_ID;
    if (!this.client || !this.ready || !groupId) {
      this.logger.warn('WhatsApp not ready — message not sent.');
      return;
    }
    try {
      await this.client.sendMessage(groupId, text);
    } catch (err) {
      this.logger.error(`WhatsApp send failed: ${err.message}`);
    }
  }

  async notifyLeadStatusChange(
    lead: {
      name: string;
      account?: { name: string } | null;
      estimatedValue?: number | null;
      closedBy?: { name: string } | null;
    },
    from: string,
    to: string,
  ): Promise<void> {
    const account = lead.account?.name ? ` (${lead.account.name})` : '';
    const value = lead.estimatedValue ? `\nEst. value: RM ${lead.estimatedValue.toLocaleString()}` : '';
    const closedBy = lead.closedBy?.name ? `\nClosed by: ${lead.closedBy.name}` : '';
    const text = `📊 *Lead status changed*\n${lead.name}${account}\n${from} → ${to}${value}${closedBy}`;
    await this.send(text);
  }
}
