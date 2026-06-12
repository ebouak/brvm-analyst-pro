// scraper/src/headless/types.ts

export interface HeadlessPage {
  goto(url: string, options?: { waitUntil?: 'networkidle0' | 'networkidle2' | 'domcontentloaded' }): Promise<void>;
  content(): Promise<string>;
  evaluate<T>(pageFunction: () => T): Promise<T>;
  $eval<T>(selector: string, pageFunction: (el: HTMLElement) => T): Promise<T>;
  $$eval<T>(selector: string, pageFunction: (els: HTMLElement[]) => T): Promise<T>;
  waitForSelector(selector: string, options?: { timeout?: number }): Promise<void>;
  click(selector: string): Promise<void>;
  type(selector: string, text: string, options?: { delay?: number }): Promise<void>;
  cookies(): Promise<Array<{ name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }>>;
  setCookie(cookie: { name: string; value: string; domain?: string; path?: string; expires?: number; httpOnly?: boolean; secure?: boolean; sameSite?: string }): Promise<void>;
  close(): Promise<void>;
}

export interface HeadlessBrowser {
  newPage(): Promise<HeadlessPage>;
  close(): Promise<void>;
}

export interface HeadlessConfig {
  cdpUrl: string;
  timeout?: number;
  stealth?: boolean;
}

export class HeadlessError extends Error {
  constructor(message: string, public override readonly cause?: Error) {
    super(message);
    this.name = 'HeadlessError';
  }
}
