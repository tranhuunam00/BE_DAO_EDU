import { Module } from '@nestjs/common';
import { FileStoragePort } from '../../application/ports/file-storage.port';
import { MinioService } from './minio.service';

@Module({
  providers: [
    MinioService,
    { provide: FileStoragePort, useExisting: MinioService },
  ],
  exports: [MinioService, FileStoragePort],
})
export class StorageModule {}
