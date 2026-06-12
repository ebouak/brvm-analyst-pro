// scraper/tests/client/bdfinAuthHeadless.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loginViaHeadless, HeadlessAuthError, type HeadlessAuthResult } from '../../src/client/bdfinAuthHeadless.js';
import type { HeadlessBrowser, HeadlessPage } from '../../src/headless/types.js';

describe('loginViaHeadless', () => {
  let mockPage: any;
  let mockBrowser: any;

  beforeEach(() => {
    mockPage = {
      goto: vi.fn().mockResolvedValue(undefined),
      click: vi.fn().mockResolvedValue(undefined),
      type: vi.fn().mockResolvedValue(undefined),
      waitForSelector: vi.fn().mockResolvedValue(undefined),
      evaluate: vi.fn().mockResolvedValue('https://bdfin.brvm.org/dashboard.aspx'),
      cookies: vi.fn().mockResolvedValue([
        { name: 'ASP.NET_SessionId', value: 'abc123' },
        { name: '.ASPXAUTH', value: 'token456' },
      ]),
      content: vi.fn().mockResolvedValue('<html><input id="ctl00$Main$Login1$UserName"></html>'),
      close: vi.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: vi.fn().mockResolvedValue(mockPage),
    } as unknown as HeadlessBrowser;
  });

  it('should successfully login and return auth result', async () => {
    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(result.success).toBe(true);
    expect(result.finalUrl).toBe('https://bdfin.brvm.org/dashboard.aspx');
    expect(result.cookies).toEqual([
      { name: 'ASP.NET_SessionId', value: 'abc123' },
      { name: '.ASPXAUTH', value: 'token456' },
    ]);
  });

  it('should navigate to login URL', async () => {
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(mockPage.goto).toHaveBeenCalledWith('https://bdfin.brvm.org/login.aspx', {
      waitUntil: 'networkidle2',
    });
  });

  it('should fill username and password fields', async () => {
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    // Verify username was clicked and filled
    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('UserName'));
    expect(mockPage.type).toHaveBeenCalledWith(
      expect.stringContaining('UserName'),
      'testuser',
      { delay: 50 },
    );

    // Verify password was clicked and filled
    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('Password'));
    expect(mockPage.type).toHaveBeenCalledWith(
      expect.stringContaining('Password'),
      'testpass',
      { delay: 50 },
    );
  });

  it('should click submit button', async () => {
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(mockPage.click).toHaveBeenCalledWith(expect.stringContaining('LoginButton'));
  });

  it('should detect failed login when URL contains login path', async () => {
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/login.aspx?error=invalid');

    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'wrongpass',
    );

    expect(result.success).toBe(false);
  });

  it('should detect failed login with case-insensitive URL check', async () => {
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/LOGIN.ASPX');

    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(result.success).toBe(false);
  });

  it('should close page after successful login', async () => {
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should close page even on navigation error', async () => {
    mockPage.goto.mockRejectedValue(new Error('Network error'));

    try {
      await loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      );
    } catch {
      // Expected error
    }

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should close page even on waitForSelector error', async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error('Timeout'));

    try {
      await loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      );
    } catch {
      // Expected error
    }

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should close page even on click error', async () => {
    mockPage.click.mockRejectedValue(new Error('Element not found'));

    try {
      await loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      );
    } catch {
      // Expected error
    }

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should throw HeadlessAuthError on login page not loading', async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error('Selector not found'));
    mockPage.content.mockResolvedValue('<html>Dashboard page</html>');

    await expect(
      loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      ),
    ).rejects.toThrow(HeadlessAuthError);

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should return success with cookies when redirected to dashboard', async () => {
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/dashboard.aspx');
    mockPage.cookies.mockResolvedValue([
      { name: 'ASP.NET_SessionId', value: 'session123' },
      { name: '.ASPXAUTH', value: 'auth456' },
      { name: 'lang', value: 'en' },
    ]);

    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'user',
      'pass',
    );

    expect(result.success).toBe(true);
    expect(result.cookies).toHaveLength(3);
    expect(result.cookies[0]).toEqual({ name: 'ASP.NET_SessionId', value: 'session123' });
  });

  it('should handle timeout during page load', async () => {
    mockPage.waitForSelector.mockRejectedValue(new Error('Timeout waiting for selector'));

    await expect(
      loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      ),
    ).rejects.toThrow(HeadlessAuthError);
  });

  it('should detect login failure even if page loads', async () => {
    // Page loads but URL still contains login path
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/login.aspx?msg=invalid');

    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'wrongpass',
    );

    expect(result.success).toBe(false);
    expect(result.finalUrl).toBe('https://bdfin.brvm.org/login.aspx?msg=invalid');
  });

  it('should normalize login path for comparison (remove leading slash)', async () => {
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/login');

    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login',
      'testuser',
      'testpass',
    );

    expect(result.success).toBe(false);
  });

  it('should detect success when URL changed to different page', async () => {
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/market/list');

    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(result.success).toBe(true);
    expect(result.finalUrl).toBe('https://bdfin.brvm.org/market/list');
  });

  it('should use custom timeout if provided', async () => {
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
      15000,
    );

    // Verify waitForSelector was called with 'body' and a timeout
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('body', { timeout: 15000 });
  });

  it('should use default timeout of 30000 if not provided', async () => {
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    // Verify waitForSelector was called with default timeout
    expect(mockPage.waitForSelector).toHaveBeenCalledWith('body', { timeout: 30000 });
  });

  it('should throw HeadlessAuthError on evaluate error', async () => {
    mockPage.evaluate.mockRejectedValue(new Error('Script error'));

    await expect(
      loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      ),
    ).rejects.toThrow(HeadlessAuthError);

    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should include cause error in HeadlessAuthError', async () => {
    const originalError = new Error('Network unreachable');
    mockPage.goto.mockRejectedValue(originalError);

    try {
      await loginViaHeadless(
        mockBrowser,
        'https://bdfin.brvm.org',
        '/login.aspx',
        'testuser',
        'testpass',
      );
    } catch (err) {
      expect(err).toBeInstanceOf(HeadlessAuthError);
      expect((err as HeadlessAuthError).cause).toBe(originalError);
    }
  });

  it('should handle credentials with special characters', async () => {
    const specialPass = 'P@ssw0rd!#$%^&*()';
    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'user@example.com',
      specialPass,
    );

    expect(mockPage.type).toHaveBeenCalledWith(
      expect.stringContaining('Password'),
      specialPass,
      { delay: 50 },
    );
  });

  it('should return HeadlessAuthResult with expected structure', async () => {
    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    expect(result).toHaveProperty('success');
    expect(result).toHaveProperty('finalUrl');
    expect(result).toHaveProperty('cookies');
    expect(typeof result.success).toBe('boolean');
    expect(typeof result.finalUrl).toBe('string');
    expect(Array.isArray(result.cookies)).toBe(true);
  });

  it('should handle page.content() fallback for non-login detection', async () => {
    // First waitForSelector call (login page indicator) fails, but content includes 'login'
    // Second waitForSelector call (body) succeeds
    let callCount = 0;
    mockPage.waitForSelector.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // First call checks for login page indicator - fails
        return Promise.reject(new Error('Selector timeout'));
      }
      // Second call checks for 'body' - succeeds
      return Promise.resolve();
    });
    mockPage.content.mockResolvedValue('<html><body><h1>Login Form</h1></body></html>');
    mockPage.evaluate.mockResolvedValue('https://bdfin.brvm.org/dashboard.aspx');

    // Should not throw because content includes "login"
    const result = await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'testuser',
      'testpass',
    );

    // The function should continue and attempt login since page has login content
    expect(result.success).toBe(true);
    expect(mockPage.close).toHaveBeenCalled();
  });

  it('should track all page operations in order', async () => {
    const callOrder: string[] = [];

    mockPage.goto.mockImplementation(() => {
      callOrder.push('goto');
      return Promise.resolve();
    });
    mockPage.waitForSelector.mockImplementation(() => {
      callOrder.push('waitForSelector');
      return Promise.resolve();
    });
    mockPage.click.mockImplementation(() => {
      callOrder.push('click');
      return Promise.resolve();
    });
    mockPage.type.mockImplementation(() => {
      callOrder.push('type');
      return Promise.resolve();
    });
    mockPage.evaluate.mockImplementation(() => {
      callOrder.push('evaluate');
      return Promise.resolve('https://bdfin.brvm.org/dashboard.aspx');
    });
    mockPage.cookies.mockImplementation(() => {
      callOrder.push('cookies');
      return Promise.resolve([]);
    });
    mockPage.close.mockImplementation(() => {
      callOrder.push('close');
      return Promise.resolve();
    });

    await loginViaHeadless(
      mockBrowser,
      'https://bdfin.brvm.org',
      '/login.aspx',
      'user',
      'pass',
    );

    // Verify goto was called first
    expect(callOrder[0]).toBe('goto');
    // Verify close was called last
    expect(callOrder[callOrder.length - 1]).toBe('close');
  });
});
