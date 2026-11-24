export const TEST_PAYMENT_METHODS = {
  'test-4242': { last4: '4242', renews: true },
  'test-0002': { last4: '0002', renews: false },
} as const;

export type TestPaymentMethod = keyof typeof TEST_PAYMENT_METHODS;

export function testPaymentMethod(reference?: string | null) {
  return reference && Object.prototype.hasOwnProperty.call(TEST_PAYMENT_METHODS, reference)
    ? TEST_PAYMENT_METHODS[reference as TestPaymentMethod]
    : undefined;
}

export function addBillingMonth(paidAt: Date): Date {
  const end = new Date(paidAt);
  const day = end.getDate();
  end.setDate(1);
  end.setMonth(end.getMonth() + 1);
  const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  end.setDate(Math.min(day, daysInMonth));
  return end;
}
