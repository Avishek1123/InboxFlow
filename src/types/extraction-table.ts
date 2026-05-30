export type ExtractionColumn = {
  key: string;
  label: string;
  hint?: string;
};

export type ExtractionTableRecord = {
  id: string;
  name: string;
  description: string | null;
  columns: ExtractionColumn[];
  rowCount?: number;
  createdAt: string;
  updatedAt: string;
};

export type ExtractionTableRowRecord = {
  id: string;
  tableId: string;
  messageId: string | null;
  values: Record<string, string | number | boolean | null>;
  sourceSubject: string | null;
  sourceFrom: string | null;
  sourceSnippet: string | null;
  createdAt: string;
};
