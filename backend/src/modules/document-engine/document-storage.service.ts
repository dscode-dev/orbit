import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { InfrastructureException } from '../../exceptions';
import { generateUuidV7 } from '../../utils';

@Injectable()
export class DocumentStorageService {
  private readonly root = resolve(
    process.env.DOCUMENT_STORAGE_DIR ?? 'storage/documents',
  );

  async store(buffer: Buffer) {
    const storageKey = `${generateUuidV7()}.pdf`;
    try {
      await mkdir(this.root, { recursive: true });
      await writeFile(this.path(storageKey), buffer, { flag: 'wx' });
      return {
        storageBucket: 'documents',
        storageKey,
        sizeBytes: BigInt(buffer.length),
        sha256: createHash('sha256').update(buffer).digest('hex'),
      };
    } catch {
      throw new InfrastructureException('Unable to persist generated PDF');
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.path(storageKey));
    } catch {
      throw new InfrastructureException('Unable to read generated PDF');
    }
  }

  async remove(storageKey: string): Promise<void> {
    try {
      await unlink(this.path(storageKey));
    } catch (error) {
      const code =
        typeof error === 'object' && error && 'code' in error
          ? error.code
          : undefined;
      if (code !== 'ENOENT') {
        throw new InfrastructureException('Unable to remove generated PDF');
      }
    }
  }

  private path(storageKey: string): string {
    return resolve(this.root, basename(storageKey));
  }
}
