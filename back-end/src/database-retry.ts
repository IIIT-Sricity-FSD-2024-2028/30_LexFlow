import { setTimeout as delay } from 'node:timers/promises';

const DNS_RETRY_DELAYS_MS = [500, 1000, 2000, 4000, 6000];

export async function retryDatabaseDns<T>(
  run: () => Promise<T>,
  delays = DNS_RETRY_DELAYS_MS,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException | null)?.code;
      // These failures happen before a connection can send a query.
      if ((code !== 'ENOTFOUND' && code !== 'EAI_AGAIN') || attempt === delays.length) {
        throw error;
      }
      await delay(delays[attempt]);
    }
  }
}
