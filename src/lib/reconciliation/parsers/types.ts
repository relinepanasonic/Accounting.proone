export interface BankTransaction {
  id: string;
  date: string;
  amount: number;
  sourceDestination: string;
  transactionDetails: string;
  notes: string;
  rekFrom: string;
  /** Saldo after this line, and the time of the day (HH:MM), when the statement shows them. */
  balance?: number;
  time?: string;
}

export interface ParseResult {
  success: boolean;
  data?: BankTransaction[];
  error?: string;
}
