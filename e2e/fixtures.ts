import { test as base, expect } from '@playwright/test';

// Handled loading/API failures may log messages; uncaught page errors must fail a test.
export const test = base.extend<{ noPageErrors: void }>({
  noPageErrors: [async ({ page }, runTest) => {
    const errors: string[] = [];
    const capture = (error: Error) => errors.push(error.message);
    page.on('pageerror', capture);
    try {
      await runTest();
    } finally {
      page.off('pageerror', capture);
      expect(errors, 'Unexpected uncaught browser errors').toEqual([]);
    }
  }, { auto: true }],
});

export { expect };
