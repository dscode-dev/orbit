import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { InfrastructureException } from '../../exceptions';
import { generateUuidV7 } from '../../utils';

export interface StoredOperationFile {
  storageKey: string;
  checksum: string;
  size: number;
}

@Injectable()
export class OperationStorageService {
  private readonly root = resolve(
    process.env.OPERATION_UPLOAD_DIR ?? 'storage/operations',
  );

  async store(file: Express.Multer.File): Promise<StoredOperationFile> {
    const extension = extname(file.originalname).toLowerCase().slice(0, 12);
    const storageKey = `${generateUuidV7()}${extension}`;
    try {
      await mkdir(this.root, { recursive: true });
      await writeFile(this.path(storageKey), file.buffer, { flag: 'wx' });
      return {
        storageKey,
        checksum: createHash('sha256').update(file.buffer).digest('hex'),
        size: file.size,
      };
    } catch {
      throw new InfrastructureException('Unable to persist attachment');
    }
  }

  async read(storageKey: string): Promise<Buffer> {
    try {
      return await readFile(this.path(storageKey));
    } catch {
      throw new InfrastructureException('Unable to read attachment');
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
        throw new InfrastructureException('Unable to remove attachment');
      }
    }
  }

  private path(storageKey: string): string {
    return resolve(this.root, basename(storageKey));
  }
}
