-- 1. Create the Global Chart of Accounts Table
CREATE TABLE IF NOT EXISTS public.global_chart_of_accounts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  account_code TEXT UNIQUE NOT NULL,
  account_name TEXT NOT NULL,
  account_type TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Enable RLS
ALTER TABLE public.global_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
-- Everyone can read the global chart of accounts
CREATE POLICY "Allow read access for all authenticated users"
  ON public.global_chart_of_accounts
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins/founders can insert/update/delete.
-- For simplicity, we allow all authenticated users in this simplified MVP, 
-- or we can restrict it. Since it's global, we will allow anyone authenticated to edit it for now, 
-- but in the app logic, we will restrict the UI to only admins/founders.
CREATE POLICY "Allow all actions for authenticated users"
  ON public.global_chart_of_accounts
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 4. Seed International Template (IFRS / GAAP standard simplified)
INSERT INTO public.global_chart_of_accounts (account_code, account_name, account_type, description)
VALUES 
  ('1000', 'Cash & Cash Equivalents', 'Asset', 'Bank accounts, petty cash, and short-term liquid assets'),
  ('1200', 'Accounts Receivable', 'Asset', 'Money owed by customers for goods/services provided'),
  ('1400', 'Inventory', 'Asset', 'Goods available for sale'),
  ('1500', 'Fixed Assets', 'Asset', 'Long-term assets like equipment, property, and vehicles'),
  
  ('2000', 'Accounts Payable', 'Liability', 'Money owed to vendors and suppliers'),
  ('2200', 'Accrued Liabilities', 'Liability', 'Expenses incurred but not yet paid (e.g., wages, taxes)'),
  ('2400', 'Short-Term Loans', 'Liability', 'Debt payable within one year'),
  ('2500', 'Long-Term Debt', 'Liability', 'Debt payable after more than one year'),
  
  ('3000', 'Owner Equity', 'Equity', 'Initial and subsequent capital contributions'),
  ('3100', 'Retained Earnings', 'Equity', 'Accumulated net income retained in the business'),
  
  ('4000', 'Sales Revenue', 'Revenue', 'Income from primary business operations'),
  ('4100', 'Service Revenue', 'Revenue', 'Income from consulting or services provided'),
  ('4200', 'Interest Income', 'Revenue', 'Income earned from bank interests or investments'),
  
  ('5000', 'Cost of Goods Sold (COGS)', 'Expense', 'Direct costs of producing the goods sold by a company'),
  ('6000', 'Advertising & Marketing', 'Expense', 'Expenses related to promoting the business'),
  ('6100', 'Bank Fees', 'Expense', 'Fees charged by financial institutions'),
  ('6200', 'Rent Expense', 'Expense', 'Cost of renting office or warehouse space'),
  ('6300', 'Salaries & Wages', 'Expense', 'Employee compensation and payroll'),
  ('6400', 'Software Subscriptions', 'Expense', 'SaaS tools, cloud hosting, and software licenses'),
  ('6500', 'Travel & Meals', 'Expense', 'Business travel, flights, and client entertainment'),
  ('6900', 'Depreciation Expense', 'Expense', 'Allocated cost of tangible assets over their useful life')
ON CONFLICT (account_code) DO NOTHING;
