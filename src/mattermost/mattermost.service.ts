import { Injectable } from '@nestjs/common';

// Thin client for the Mattermost REST API, authenticated as the "pop-os" bot
// account (one bot token covers channel posts AND direct messages — no
// per-channel webhook URLs to store).
//
// Needs three env vars: MATTERMOST_URL, MATTERMOST_BOT_TOKEN, MATTERMOST_TEAM.
// If any is missing the service reports "not configured" and every send is a
// harmless no-op, so dev machines without Mattermost keep working.
//
// Unlike WhatsappService.send(), the send methods here THROW on failure —
// callers (the rule runner) record the error text on the rule so the admin
// can see it in the UI. Fire-and-forget callers should add their own .catch().

// Mattermost rejects posts over 16383 characters — stay safely under it.
const MAX_POST_CHARS = 15_000;
const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class MattermostService {
  // Small in-memory caches. Channel and user IDs never change, so looking each
  // up once per server run saves an HTTP round trip on every scheduled send.
  private channelIds = new Map<string, string>();
  private userIds    = new Map<string, string>();
  private usernames  = new Map<string, string>(); // email -> Mattermost username
  private botUserId: string | null = null;

  private get baseUrl() { return (process.env.MATTERMOST_URL || '').replace(/\/+$/, ''); }
  private get token()   { return process.env.MATTERMOST_BOT_TOKEN || ''; }
  private get team()    { return process.env.MATTERMOST_TEAM || ''; }

  isConfigured(): boolean {
    return !!(this.baseUrl && this.token && this.team);
  }

  // One place for auth header, timeout and error handling.
  private async api<T = any>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}/api/v4${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      // Mattermost errors are JSON: { message: "...", ... } — surface that text.
      const detail = await res.json().then((j: any) => j?.message).catch(() => null);
      throw new Error(`Mattermost ${method} ${path} → ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    return res.json() as Promise<T>;
  }

  private async getBotUserId(): Promise<string> {
    if (!this.botUserId) this.botUserId = (await this.api('GET', '/users/me')).id;
    return this.botUserId!;
  }

  // Channel "name" is the slug in the channel URL (…/team/channels/capacity),
  // not the display name. A leading # is tolerated because people type it.
  private async resolveChannelId(channel: string): Promise<string> {
    const name = channel.trim().replace(/^#/, '').toLowerCase();
    const cached = this.channelIds.get(name);
    if (cached) return cached;
    try {
      const ch = await this.api('GET', `/teams/name/${encodeURIComponent(this.team)}/channels/name/${encodeURIComponent(name)}`);
      this.channelIds.set(name, ch.id);
      return ch.id;
    } catch (err) {
      throw new Error(
        `Channel "${name}" not found — check the URL name, and that the pop-os bot is a member of it. (${err.message})`,
      );
    }
  }

  // Find a Mattermost user by username (preferred) or by email.
  private async resolveUserId(opts: { username?: string | null; email?: string | null }): Promise<string> {
    const username = opts.username?.trim().replace(/^@/, '');
    const key = username ? `u:${username.toLowerCase()}` : `e:${(opts.email || '').toLowerCase()}`;
    const cached = this.userIds.get(key);
    if (cached) return cached;

    let user: any;
    if (username) {
      user = await this.api('GET', `/users/username/${encodeURIComponent(username)}`);
    } else if (opts.email) {
      // Mattermost only lets non-admin accounts search by email when
      // "Show Email Address" is on — if this fails, set the username override.
      user = await this.api('GET', `/users/email/${encodeURIComponent(opts.email)}`);
    } else {
      throw new Error('No Mattermost username or email to look up.');
    }
    this.userIds.set(key, user.id);
    return user.id;
  }

  // Best-effort: the Mattermost @username for an email, or null. Used to @mention
  // people in a message, where "couldn't find them" must never be an error —
  // the caller just falls back to printing their plain name.
  async findUsernameByEmail(email: string): Promise<string | null> {
    if (!this.isConfigured() || !email) return null;
    const cached = this.usernames.get(email.toLowerCase());
    if (cached) return cached;
    try {
      const user = await this.api('GET', `/users/email/${encodeURIComponent(email)}`);
      if (!user?.username) return null;
      this.usernames.set(email.toLowerCase(), user.username);
      return user.username;
    } catch {
      return null;
    }
  }

  // Break long text on line boundaries so each post stays under Mattermost's limit.
  private splitMessage(text: string): string[] {
    if (text.length <= MAX_POST_CHARS) return [text];
    const chunks: string[] = [];
    let current = '';
    for (const line of text.split('\n')) {
      if (current.length + line.length + 1 > MAX_POST_CHARS && current) {
        chunks.push(current);
        current = '';
      }
      current += (current ? '\n' : '') + line;
    }
    if (current) chunks.push(current);
    return chunks;
  }

  private async post(channelId: string, text: string): Promise<void> {
    for (const chunk of this.splitMessage(text)) {
      await this.api('POST', '/posts', { channel_id: channelId, message: chunk });
    }
  }

  async sendToChannel(channel: string, text: string): Promise<void> {
    this.assertConfigured();
    await this.post(await this.resolveChannelId(channel), text);
  }

  // A direct message is a private 2-person channel (bot + user). The API call
  // that "creates" it is idempotent — it returns the existing one if present.
  async sendDirect(user: { username?: string | null; email?: string | null }, text: string): Promise<void> {
    this.assertConfigured();
    const [botId, userId] = await Promise.all([this.getBotUserId(), this.resolveUserId(user)]);
    const dm = await this.api('POST', '/channels/direct', [botId, userId]);
    await this.post(dm.id, text);
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error('Mattermost is not configured — set MATTERMOST_URL, MATTERMOST_BOT_TOKEN and MATTERMOST_TEAM in .env.');
    }
  }
}
