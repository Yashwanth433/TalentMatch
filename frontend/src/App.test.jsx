import { describe, it, expect } from 'vitest';
describe('Recruitment frontend smoke checks', () => {
  it('has a configured API default', () => {
    const api = import.meta.env.VITE_API_URL || 'http://localhost:8081/api';
    expect(api).toContain('/api');
  });
});
