import { generateSlug } from '../../src/utils/slug.js';

// Unit tests for slug generation utility
describe('slug utility', () => {
  it('should convert name to lowercase hyphenated format with suffix', () => {
    const slug = generateSlug('Acme Production');
    expect(slug).toMatch(/^acme-production-[a-z0-9]{4}$/);
  });

  it('should remove special characters and accents', () => {
    const slug = generateSlug('Hello @ World # 2026!');
    expect(slug).toMatch(/^hello-world-2026-[a-z0-9]{4}$/);
  });

  it('should fallback to status when input is empty or all symbols', () => {
    const slug = generateSlug('!!!@@@###');
    expect(slug).toMatch(/^status-[a-z0-9]{4}$/);
  });
});
