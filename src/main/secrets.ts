import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { safeStorage } from 'electron';

export class SecretStore {
  constructor(private readonly path: string) {}

  hasApiKey() { return existsSync(this.path) && readFileSync(this.path).length > 0; }

  getApiKey(): string | null {
    if (!this.hasApiKey()) return null;
    if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统无法解密行情 API Key');
    return safeStorage.decryptString(readFileSync(this.path));
  }

  setApiKey(value: string | null) {
    if (!value) { writeFileSync(this.path, Buffer.alloc(0)); return; }
    if (!safeStorage.isEncryptionAvailable()) throw new Error('当前系统无法安全保存行情 API Key');
    writeFileSync(this.path, safeStorage.encryptString(value));
  }
}
