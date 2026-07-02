import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { FileStoragePort } from '../../application/ports/file-storage.port';

export interface StorageFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

@Injectable()
export class MinioService extends FileStoragePort {
  private minioClient: Minio.Client;
  private bucketName: string;
  private readonly logger = new Logger(MinioService.name);

  constructor(private configService: ConfigService) {
    super();
    this.bucketName = this.configService.get<string>(
      'MINIO_BUCKET_NAME',
      'edu',
    );
    this.minioClient = new Minio.Client({
      endPoint: this.configService.get<string>('MINIO_ENDPOINT', 'localhost'),
      port: Number(this.configService.get<number>('MINIO_PORT', 9005)),
      useSSL:
        this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get<string>(
        'MINIO_ACCESS_KEY',
        'dao_minio_root',
      ),
      secretKey: this.configService.get<string>(
        'MINIO_SECRET_KEY',
        'Minio_Secure_Storage_Root_2026!',
      ),
    });
  }

  async uploadBase64Image(
    base64Str: string,
    prefix: string = 'avatars',
  ): Promise<string> {
    try {
      const match = base64Str.match(/^data:([-A-Za-z+/]+);base64,(.+)$/);
      if (!match || match.length !== 3) {
        throw new Error('Invalid base64 string');
      }

      const mimeType = match[1];
      const buffer = Buffer.from(match[2], 'base64');

      const extension = mimeType.split('/')[1] || 'png';
      const fileName = `${prefix}/${Date.now()}-${Math.floor(Math.random() * 10000)}.${extension}`;

      await this.minioClient.putObject(
        this.bucketName,
        fileName,
        buffer,
        buffer.length,
        {
          'Content-Type': mimeType,
        },
      );

      const endPoint = this.configService.get<string>(
        'MINIO_ENDPOINT',
        'localhost',
      );
      const port = this.configService.get<number>('MINIO_PORT', 9005);
      const useSSL =
        this.configService.get<string>('MINIO_USE_SSL', 'false') === 'true';
      const protocol = useSSL ? 'https' : 'http';

      return `${protocol}://${endPoint}:${port}/${this.bucketName}/${fileName}`;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Error uploading image to MinIO: ${message}`);
      throw error;
    }
  }

  async uploadFile(file: StorageFile, prefix: string): Promise<string> {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const objectKey = `${prefix}/${Date.now()}-${Math.floor(Math.random() * 100000)}-${safeName}`;
    await this.minioClient.putObject(
      this.bucketName,
      objectKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );
    return objectKey;
  }

  async getPresignedUrl(objectKey: string): Promise<string> {
    let url = await this.minioClient.presignedGetObject(
      this.bucketName,
      objectKey,
      15 * 60,
    );

    const externalEndpoint = this.configService.get<string>('MINIO_EXTERNAL_ENDPOINT') || '103.90.227.173';
    if (url.includes('localhost')) {
      url = url.replace('localhost', externalEndpoint);
    } else if (url.includes('127.0.0.1')) {
      url = url.replace('127.0.0.1', externalEndpoint);
    }

    return url;
  }

  async removeFile(objectKey: string): Promise<void> {
    await this.minioClient.removeObject(this.bucketName, objectKey);
  }
}
