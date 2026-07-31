import { Module } from '@nestjs/common';
import { DocumentStorageService } from './document-storage.service';
import { PdfRendererService } from './pdf-renderer.service';

@Module({
  providers: [DocumentStorageService, PdfRendererService],
  exports: [DocumentStorageService, PdfRendererService],
})
export class DocumentEngineModule {}
