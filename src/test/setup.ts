import '@testing-library/jest-dom';
import { mockChrome } from './mocks/chrome';

// Set up Chrome API mock globally
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).chrome = mockChrome;

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
});
