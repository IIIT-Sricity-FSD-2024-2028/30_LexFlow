import { SetMetadata } from '@nestjs/common';

export const FIRM_WRITE_KEY = 'firmWrite';
export type FirmWritePolicy = 'signed-in' | 'client-signup';
export const FirmWrite = (policy: FirmWritePolicy = 'signed-in') => SetMetadata(FIRM_WRITE_KEY, policy);
