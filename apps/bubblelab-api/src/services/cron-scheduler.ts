import { db } from '../db/index.js';
import { bubbleFlows } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { AppType } from '../config/clerk-apps.js';
import { runBubbleFlowWithLogging } from './bubble-flow-execution.js';
import {
  parseCronExpression,
  validateCronExpression,
} from '@bubblelab/shared-schemas';
import { transformWebhookPayload } from '../utils/payload-transformer.js';

export type CronSchedulerOptions = {
  maxConcurrency?: number;
  jitterMs?: number;
  tickIntervalMs?: number;
  logger?: Pick<Console, 'log' | 'error' | 'warn' | 'debug'>;
  enabled?: boolean;
};

export class CronScheduler {
  private timer?: ReturnType<typeof setTimeout>;
  private running = new Set<number>();
  private inFlight = 0;
  private stopped = false;
  private readonly maxConcurrency: number;
  private readonly jitterMs: number;
  private readonly tickIntervalMs: number;
  private readonly logger: Pick<Console, 'log' | 'error' | 'warn' | 'debug'>;
  private readonly enabled: boolean;

  constructor(options: CronSchedulerOptions = {}) {
    this.maxConcurrency = options.maxConcurrency ?? 4;
    this.jitterMs = options.jitterMs ?? 0;
    this.tickIntervalMs = options.tickIntervalMs ?? 60000; // Default 1 minute
    this.logger = options.logger ?? console;
    this.enabled = options.enabled ?? true;
  }

  start(): void {
    if (!this.enabled) {
      this.logger.log('[cron] Scheduler disabled (enabled=false)');
      return;
    }
    if (this.timer) return;
    this.stopped = false;
    this.logger.log('[cron] Scheduler starting...');
    this.scheduleNextTick(new Date());
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    this.logger.log('[cron] Scheduler stopped');
  }

  private scheduleNextTick(now: Date): void {
    if (this.stopped) return;
    const msIntoInterval =
      (now.getSeconds() * 1000 + now.getMilliseconds()) % this.tickIntervalMs;
    const baseDelay = this.tickIntervalMs - msIntoInterval;
    const delay = baseDelay + (this.jitterMs || 0);
    const nextAt = new Date(now.getTime() + delay);
    this.logger.debug?.(
      `[cron] Scheduling next tick in ${delay}ms at ${nextAt.toISOString()}`
    );
    this.timer = setTimeout(() => this.tick(), delay);
  }

  private async tick(): Promise<void> {
    const now = new Date();
    this.logger.debug?.(`[cron] Tick at ${now.toISOString()}`);
    try {
      await this.runDueCronFlows(now);
    } catch (e) {
      this.logger.error('[cron] tick error', e);
    } finally {
      this.scheduleNextTick(new Date());
    }
  }

  private async runDueCronFlows(now: Date): Promise<void> {
    this.logger.debug?.('[cron] Scanning active cron flows...');
    // Fetch active cron flows (filter null cron in JS for portability)
    const flows = await db.query.bubbleFlows.findMany({
      where: eq(bubbleFlows.cronActive, true),
      columns: {
        id: true,
        userId: true,
        cron: true,
        defaultInputs: true,
        name: true,
      },
    });
    this.logger.debug?.(`[cron] Active cron flows: ${flows.length}`);

    for (const f of flows) {
      this.logger.debug?.(
        `[cron] Evaluating flow ${f.id} with name ${f.name} cron='${f.cron ?? ''}'`
      );
      if (!f.cron) {
        this.logger.debug?.(`[cron] Flow ${f.id} skipped: cron is null`);
        continue;
      }
      if (!validateCronExpression(f.cron).valid) {
        this.logger.debug?.(`[cron] Flow ${f.id} skipped: invalid cron`);
        continue;
      }
      const due = this.isCronDue(f.cron, now);
      this.logger.debug?.(`[cron] Flow ${f.id} due now? ${due}`);
      if (!due) continue;
      if (this.running.has(f.id)) {
        this.logger.debug?.(`[cron] Flow ${f.id} skipped: already running`);
        continue; // avoid overlap per flow
      }
      if (this.maxConcurrency && this.inFlight >= this.maxConcurrency) {
        // Respect concurrency; leave remaining for next tick
        this.logger.debug?.(
          `[cron] Max concurrency reached (${this.inFlight}/${this.maxConcurrency}), deferring remaining flows`
        );
        break;
      }

      this.running.add(f.id);
      this.inFlight++;
      this.logger.debug?.(
        `[cron] Executing flow ${f.id} (inFlight=${this.inFlight}/${this.maxConcurrency})`
      );
      // Transform the payload using the same logic as webhooks
      const transformedPayload = transformWebhookPayload(
        'schedule/cron',
        {
          cron: f.cron,
          body: f.defaultInputs as Record<string, unknown>,
        },
        'runDueCronFlows',
        'POST',
        {}
      );

      this.logger.debug?.(`[cron] transformedPayload`, transformedPayload);
      runBubbleFlowWithLogging(f.id, transformedPayload, {
        userId: f.userId,
        appType: AppType.BUBBLE_LAB,
      })
        .catch((err) => this.logger.error('[cron] exec error', f.id, err))
        .finally(() => {
          this.running.delete(f.id);
          this.inFlight--;
          this.logger.debug?.(`[cron] Finished flow ${f.id}`);
        });
    }
  }

  private isCronDue(expr: string, now: Date): boolean {
    // Round to nearest minute to prevent double execution
    // If tick happens at XX:XX:59.995, treat it as XX:XX+1:00.000
    const rounded = new Date(now);
    const seconds = rounded.getUTCSeconds();

    // If >= 30 seconds into the minute, round up to next minute
    if (seconds >= 30) {
      rounded.setUTCMinutes(rounded.getUTCMinutes() + 1);
    }

    // Set seconds and milliseconds to 0 for clean minute boundary
    rounded.setUTCSeconds(0, 0);

    this.logger.debug?.(`[cron] rounded`, rounded.toISOString());
    const { minute, hour, dayOfMonth, month, dayOfWeek } =
      parseCronExpression(expr);
    // Use UTC methods to ensure cron expressions are evaluated in UTC timezone
    return (
      this.matchesField(minute, rounded.getUTCMinutes(), 0, 59) &&
      this.matchesField(hour, rounded.getUTCHours(), 0, 23) &&
      this.matchesField(dayOfMonth, rounded.getUTCDate(), 1, 31) &&
      this.matchesField(month, rounded.getUTCMonth() + 1, 1, 12) &&
      this.matchesField(dayOfWeek, rounded.getUTCDay(), 0, 6)
    );
  }

  private matchesField(
    field: string,
    value: number,
    min: number,
    max: number
  ): boolean {
    if (field === '*') return true;
    if (field.startsWith('*/')) {
      const step = parseInt(field.slice(2), 10);
      return step > 0 && value % step === 0;
    }
    if (field.includes(',')) {
      const list = field.split(',').map((v) => parseInt(v.trim(), 10));
      return list.includes(value);
    }
    if (field.includes('-')) {
      const [a, b] = field.split('-').map((v) => parseInt(v.trim(), 10));
      return !Number.isNaN(a) && !Number.isNaN(b) && value >= a && value <= b;
    }
    const n = parseInt(field, 10);
    return !Number.isNaN(n) && n >= min && n <= max && value === n;
  }
}

export function startCronScheduler() {
  const enabled = (process.env.CRON_SCHEDULER_ENABLED ?? 'true') === 'true';
  const maxConcurrency = Number(process.env.CRON_MAX_CONCURRENCY ?? 4);
  const jitterMs = Number(process.env.CRON_JITTER_MS ?? 0);
  const scheduler = new CronScheduler({
    enabled,
    maxConcurrency,
    jitterMs,
    logger: console,
  });
  scheduler.start();
  return scheduler;
}
