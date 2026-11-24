import { addBillingMonth, testPaymentMethod } from './subscription-cycle';

describe('Rolling subscription periods', () => {
  it('uses the same day and time in the next month', () => {
    expect(addBillingMonth(new Date(2026, 10, 24, 16, 20))).toEqual(new Date(2026, 11, 24, 16, 20));
  });

  it('uses the last available day in a shorter month', () => {
    expect(addBillingMonth(new Date(2026, 0, 31, 9))).toEqual(new Date(2026, 1, 28, 9));
    expect(addBillingMonth(new Date(2028, 0, 31, 9))).toEqual(new Date(2028, 1, 29, 9));
  });

  it('accepts only the test payment method references', () => {
    expect(testPaymentMethod('test-4242')).toEqual({ last4: '4242', renews: true });
    expect(testPaymentMethod('test-0002')).toEqual({ last4: '0002', renews: false });
    expect(testPaymentMethod('4242424242424242')).toBeUndefined();
    expect(testPaymentMethod('constructor')).toBeUndefined();
  });
});
