export interface Source {
  title: string;
  uri: string;
}

export interface CompanyData {
  companyName: string;
  taxCode: string;
  domain: string;
  summary: string;
  sources: Source[];
}

export interface SearchResultItem {
  id: string; 
  inputName: string;
  status: 'pending' | 'loading' | 'success' | 'error' | 'skipped';
  data?: CompanyData;
  error?: string;
  updateHistory?: string; 
  selected: boolean; // For checkbox selection
  isSkipped?: boolean; // If data already existed
}

export interface SearchState {
  isProcessing: boolean;
  results: SearchResultItem[];
  sheetHeaders: string[]; 
  sheetRows: string[][]; 
}