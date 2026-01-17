import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'node:os';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const tempDir = path.join(__dirname, 'temp-home-update');

vi.mock('node:os', async () => {
  const actual = await vi.importActual('node:os');
  return {
    ...actual,
    homedir: () => tempDir,
  };
});

// Mock utils.getVersion
vi.mock('../src/lib/utils.js', async () => {
  const actual = await vi.importActual('../src/lib/utils.js') as any;
  return {
    ...actual,
    getVersion: () => '0.5.0',
  };
});

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { checkForUpdate, formatUpdateMessage, checkForUpdateSync } from '../src/lib/update-check.js';

describe('update-check', () => {
  beforeAll(() => {
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    const cacheDir = path.join(tempDir, '.jira-ai');
    const cacheFile = path.join(cacheDir, 'cache.json');
    if (fs.existsSync(cacheFile)) {
      fs.unlinkSync(cacheFile);
    }
  });

  it('should return latest version if an update is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.6.0' }),
    });

    const result = await checkForUpdate(tempDir);
    expect(result).toBe('0.6.0');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should return null if already on latest version', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.5.0' }),
    });

    const result = await checkForUpdate(tempDir);
    expect(result).toBeNull();
  });

  it('should return null if an error occurs during fetch', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await checkForUpdate(tempDir);
    expect(result).toBeNull();
  });

  it('should cache the result and not fetch again within 24 hours', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.6.0' }),
    });

    // First call - should fetch
    await checkForUpdate(tempDir);
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second call - should use cache
    const result = await checkForUpdate(tempDir);
    expect(result).toBe('0.6.0');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should fetch again if cache is older than 24 hours', async () => {
    const cacheDir = path.join(tempDir, '.jira-ai');
    const cacheFile = path.join(cacheDir, 'cache.json');
    
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    // Create an old cache (48 hours ago)
    const oldTime = Date.now() - (48 * 60 * 60 * 1000);
    fs.writeFileSync(cacheFile, JSON.stringify({
      lastCheck: oldTime,
      latestVersion: '0.5.5'
    }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ version: '0.7.0' }),
    });

    const result = await checkForUpdate(tempDir);
    expect(result).toBe('0.7.0');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should return cached version synchronously with checkForUpdateSync', () => {
    const cacheDir = path.join(tempDir, '.jira-ai');
    const cacheFile = path.join(cacheDir, 'cache.json');
    
    if (!fs.existsSync(cacheDir)) {
      fs.mkdirSync(cacheDir, { recursive: true });
    }

    fs.writeFileSync(cacheFile, JSON.stringify({
      lastCheck: Date.now(),
      latestVersion: '0.8.0'
    }));

    const result = checkForUpdateSync(tempDir);
    expect(result).toBe('0.8.0');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should format the update message correctly', () => {
    const message = formatUpdateMessage('0.6.0');
    expect(message).toContain('Update available:');
    expect(message).toContain('0.6.0');
  });
});