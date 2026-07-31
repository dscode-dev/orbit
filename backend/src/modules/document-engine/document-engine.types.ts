export interface DocumentField {
  label: string;
  path: string;
}

export interface DocumentColumn extends DocumentField {
  width?: number;
}

export interface DocumentSection {
  key: string;
  title: string;
  type: 'HEADING' | 'TEXT' | 'KEY_VALUE' | 'TABLE' | 'PAGE_BREAK';
  order: number;
  content?: string;
  fields?: DocumentField[];
  columns?: DocumentColumn[];
  dataPath?: string;
}

export interface SignatureSlot {
  key: string;
  label: string;
  signerType: 'USER' | 'CUSTOMER' | 'EXTERNAL';
  required: boolean;
  order: number;
}

export interface DocumentSettings {
  pageSize?: 'A4' | 'LETTER';
  orientation?: 'portrait' | 'landscape';
  margin?: number;
  header?: string;
  footer?: string;
  showPageNumbers?: boolean;
}

export interface RenderSignature {
  slotKey: string;
  signerName: string;
  signerDocument?: string | null;
  signedAt: Date;
  signatureHash: string;
}

export interface RenderDocumentInput {
  title: string;
  code: string;
  version: number;
  sections: DocumentSection[];
  signatureSlots: SignatureSlot[];
  settings: DocumentSettings;
  data: Record<string, unknown>;
  signatures: RenderSignature[];
  contentHash: string;
}
