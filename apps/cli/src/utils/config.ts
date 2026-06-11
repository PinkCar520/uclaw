import * as path from 'node:path';
import * as os from 'node:os';

export const CONFIG = {
  GATEWAY_URL: process.env.OCEAN_GATEWAY_URL || 'http://localhost:3000',
  CRED_DIR: path.join(os.homedir(), '.ocean'),
  get CRED_PATH() {
    return path.join(this.CRED_DIR, 'credentials.json');
  },
  DEFAULT_WORKSPACE: process.cwd(),
};

/**
 * Common logging prefixes
 */
export const LOG = {
  PREFIX: '[Ocean]',
  DAEMON: '[Ocean Daemon]',
  RPC: '[RPC Request]',
};
