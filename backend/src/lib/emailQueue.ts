import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { sendOtpEmail } from './email.js';
import { logger } from './logger.js';

// BullMQ requires maxRetriesPerRequest: null — separate from the shared redis client
function makeBullConnection() {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  return new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false, lazyConnect: true });
}

interface EmailJob {
  to: string;
  otp: string;
  type: 'EMAIL_VERIFY' | 'PASSWORD_RESET';
}

let emailQueue: Queue<EmailJob> | null = null;

export function startEmailWorker() {
  try {
    emailQueue = new Queue<EmailJob>('emails', {
      connection: makeBullConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 3000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });

    const worker = new Worker<EmailJob>(
      'emails',
      async (job) => {
        await sendOtpEmail(job.data.to, job.data.otp, job.data.type);
        logger.info({ to: job.data.to, type: job.data.type }, 'OTP email sent');
      },
      { connection: makeBullConnection(), concurrency: 5 }
    );

    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, err }, 'Email job failed');
    });

    logger.info('Email queue worker started');
    return worker;
  } catch (err) {
    logger.warn({ err }, 'Redis unavailable — email queue disabled, falling back to direct send');
    return null;
  }
}

// Queue email if Redis is up, otherwise send directly so OTPs always arrive
export async function queueOtpEmail(to: string, otp: string, type: 'EMAIL_VERIFY' | 'PASSWORD_RESET') {
  if (emailQueue) {
    try {
      await emailQueue.add('send-otp', { to, otp, type });
      return;
    } catch (err) {
      logger.warn({ err }, 'Failed to queue email — sending directly');
    }
  }
  // Fallback: send directly (blocks for ~1-2s but always works)
  await sendOtpEmail(to, otp, type).catch((err) => {
    logger.error({ err, to }, 'Direct email send also failed');
  });
}
