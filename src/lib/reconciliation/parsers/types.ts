export interface BankTransaction {
  id: string;
  date: string;
  amount: number;
  sourceDestination: string;
  transactionDetails: string;
  notes: string;
  rekFrom: string;
}

export interface ParseResult {
  success: boolean;
  data?: BankTransaction[];
  error?: string;
}
