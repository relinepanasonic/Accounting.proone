async function run() {
  const apiKey = 'newwave_sync_secret_99887766554433';

  const payload = {
    source: 'proone',
    external_id: 'test-external-id-123',
    invoice_number: 'INV-TEST-001',
    brand: 'Niko Electronic', 
    invoice_date: '2026-07-28',
    due_date: '2026-08-12',
    status: 'draft',
    notes: 'Test sync from script',
    items: [
      {
        name: 'NW Silver Live + Pre Content',
        description: '50 hours per Package (25 days).',
        scale: 'pc',
        qty: 1,
        price: 5750000,
      }
    ]
  };

  console.log('Sending payload:', JSON.stringify(payload, null, 2));

  try {
    const res = await fetch('https://app.newwave.id/api/accounting/invoices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    console.log('Status:', res.status);
    const text = await res.text();
    console.log('Response body:', text);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

run();
