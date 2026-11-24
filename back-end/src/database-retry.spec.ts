import { retryDatabaseDns } from './database-retry';

const dbError = (code: string) => Object.assign(new Error(code), { code });

describe('PostgreSQL DNS retry', () => {
  it('recovers from a temporary DNS failure before sending a query', async () => {
    const connect = jest.fn()
      .mockRejectedValueOnce(dbError('ENOTFOUND'))
      .mockRejectedValueOnce(dbError('EAI_AGAIN'))
      .mockResolvedValueOnce('connected');

    await expect(retryDatabaseDns(connect, [0, 0])).resolves.toBe('connected');
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('rethrows the DNS failure after the configured attempts', async () => {
    const failure = dbError('ENOTFOUND');
    const connect = jest.fn().mockRejectedValue(failure);
    await expect(retryDatabaseDns(connect, [0])).rejects.toBe(failure);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('surfaces SQL and authentication errors immediately', async () => {
    const query = jest.fn().mockRejectedValue(dbError('28P01'));
    await expect(retryDatabaseDns(query, [0])).rejects.toMatchObject({ code: '28P01' });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
