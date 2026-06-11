import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { CONFIG } from './config.js';

const execAsync = promisify(exec);
const CRED_DIR = CONFIG.CRED_DIR;
const CRED_PATH = CONFIG.CRED_PATH;

/**
 * Resolve API Key from:
 * 1. OCEAN_API_KEY environment variable
 * 2. ~/.ocean/credentials.json
 */
export async function resolveApiKey(): Promise<string | null> {
  if (process.env.OCEAN_API_KEY) return process.env.OCEAN_API_KEY;

  try {
    const raw = await fs.readFile(CRED_PATH, 'utf-8');
    const creds = JSON.parse(raw);
    return creds.apiKey || null;
  } catch {
    return null;
  }
}

/**
 * Save credentials to ~/.ocean/credentials.json
 */
export async function saveCredentials(creds: { apiKey: string; userId?: string }): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(CRED_DIR, { recursive: true });

  // Read existing or create new
  let existing = {};
  try {
    existing = JSON.parse(await fs.readFile(CRED_PATH, 'utf-8'));
  } catch { /* ignore */ }

  const updated = { ...existing, ...creds, updatedAt: new Date().toISOString() };
  await fs.writeFile(CRED_PATH, JSON.stringify(updated, null, 2), 'utf-8');

  // Set restrictive permissions (owner read/write only)
  await fs.chmod(CRED_PATH, 0o600);
}

/**
 * Remove credentials file from ~/.ocean/credentials.json
 */
export async function removeCredentials(): Promise<boolean> {
  try {
    await fs.unlink(CRED_PATH);
    return true;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return false; // File already doesn't exist
    }
    throw error;
  }
}

/**
 * Get current user identity (Priority: env > git config > system user)
 */
export async function getAutoUserId(): Promise<string> {
  if (process.env.OCEAN_USER_ID) return process.env.OCEAN_USER_ID;
  if (process.env.OCEAN_WORK_ID) return process.env.OCEAN_WORK_ID;
  try {
    const { stdout } = await execAsync('git config user.name');
    return stdout.trim() || process.env.USER || 'unknown_dev';
  } catch {
    return process.env.USER || 'unknown_dev';
  }
}
