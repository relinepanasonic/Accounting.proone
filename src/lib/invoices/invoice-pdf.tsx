import React from 'react';
import { Document, Page, View, Text, StyleSheet, renderToBuffer } from '@react-pdf/renderer';

/**
 * A server-made PDF of one invoice (for the Drive documentation). It is built from the same database fields as the invoice page
 * (src/lib/invoices/document-view.tsx), without the browser: company, client, items, totals with taxes, payments and bank accounts.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const day = (v: any) => {
  const d = new Date(v);
  return isNaN(d.getTime()) ? '-' : `${String(d.getDate()).padStart(2, '0')} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};
const rp = (n: number) => `${n < 0 ? '-' : ''}Rp ${Math.round(Math.abs(n)).toLocaleString('id-ID')}`;

export interface InvoicePdfData {
  number: string;
  issueDate: string;
  dueDate: string;
  status: string;
  company: { name: string; tagline: string; address: string; phone: string; email: string; website: string };
  client: { name: string; legalName: string; contact: string; address: string; phone: string; email: string };
  items: Array<{ name: string; description: string; quantity: number; unitPrice: number; discount: number; total: number }>;
  subtotal: number;
  discount: number;
  taxLabel: string;
  taxAmount: number;
  pphAmount: number;
  grandTotal: number;
  paid: number;
  payments: Array<{ date: string; amount: number }>;
  banks: Array<{ bank: string; number: string; holder: string }>;
  notes: string;
}

const GOLD = '#b8901f';
const MUTED = '#6b7280';
const LINE = '#e5e7eb';
const st = StyleSheet.create({
  page: { padding: 36, paddingBottom: 50, fontFamily: 'Helvetica', fontSize: 9, color: '#111827' },
  head: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 18 },
  company: { fontSize: 15, fontFamily: 'Helvetica-Bold' },
  small: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  title: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: GOLD, textAlign: 'right' },
  badge: { marginTop: 4, alignSelf: 'flex-end', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 3, fontSize: 8, fontFamily: 'Helvetica-Bold' },
  cols: { flexDirection: 'row', marginBottom: 16 },
  box: { flex: 1, borderWidth: 1, borderColor: LINE, borderRadius: 4, padding: 8, marginRight: 8 },
  label: { fontSize: 7, color: MUTED, letterSpacing: 0.8, marginBottom: 3 },
  bold: { fontFamily: 'Helvetica-Bold' },
  th: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#9ca3af', paddingVertical: 4, backgroundColor: '#f9fafb' },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: LINE, paddingVertical: 4 },
  right: { textAlign: 'right' },
  muted: { color: MUTED },
  totals: { marginTop: 10, marginLeft: 'auto', width: 240 },
  tot: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  grand: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, marginTop: 3, borderTopWidth: 1, borderTopColor: '#111827' },
  footer: { position: 'absolute', bottom: 20, left: 36, right: 36, flexDirection: 'row', justifyContent: 'space-between', fontSize: 7.5, color: MUTED },
});

const W = [44, 10, 18, 12, 16]; // description, qty, unit price, discount, total (percent)

export function InvoicePdf({ d }: { d: InvoicePdfData }) {
  const balance = Math.max(0, d.grandTotal - d.paid);
  const paidFull = d.grandTotal > 0 && balance <= 0.5;
  const tone = paidFull ? { backgroundColor: '#d1fae5', color: '#065f46' } : d.paid > 0 ? { backgroundColor: '#fef3c7', color: '#92400e' } : { backgroundColor: '#e5e7eb', color: '#374151' };
  return (
    <Document title={d.number} author={d.company.name}>
      <Page size="A4" style={st.page}>
        <View style={st.head}>
          <View style={{ maxWidth: 300 }}>
            <Text style={st.company}>{d.company.name}</Text>
            {d.company.tagline ? <Text style={st.small}>{d.company.tagline}</Text> : null}
            {d.company.address ? <Text style={st.small}>{d.company.address}</Text> : null}
            {[d.company.phone, d.company.email, d.company.website].filter(Boolean).length ? <Text style={st.small}>{[d.company.phone, d.company.email, d.company.website].filter(Boolean).join('  |  ')}</Text> : null}
          </View>
          <View>
            <Text style={st.title}>INVOICE</Text>
            <Text style={[st.right, st.bold, { marginTop: 3 }]}>{d.number}</Text>
            <Text style={[st.badge, tone]}>{paidFull ? 'PAID' : d.paid > 0 ? 'PARTIALLY PAID' : String(d.status || 'UNPAID').toUpperCase()}</Text>
          </View>
        </View>

        <View style={st.cols}>
          <View style={st.box}>
            <Text style={st.label}>BILL TO</Text>
            <Text style={st.bold}>{d.client.legalName || d.client.name}</Text>
            {d.client.legalName && d.client.legalName !== d.client.name ? <Text style={st.small}>{d.client.name}</Text> : null}
            {d.client.contact ? <Text style={st.small}>Attn. {d.client.contact}</Text> : null}
            {d.client.address ? <Text style={st.small}>{d.client.address}</Text> : null}
            {[d.client.phone, d.client.email].filter(Boolean).length ? <Text style={st.small}>{[d.client.phone, d.client.email].filter(Boolean).join('  |  ')}</Text> : null}
          </View>
          <View style={[st.box, { marginRight: 0, flex: 0.7 }]}>
            <Text style={st.label}>DETAILS</Text>
            <Text>Invoice date: <Text style={st.bold}>{day(d.issueDate)}</Text></Text>
            <Text style={{ marginTop: 2 }}>Due date: <Text style={st.bold}>{day(d.dueDate)}</Text></Text>
          </View>
        </View>

        <View style={st.th}>
          <Text style={[st.label, { width: `${W[0]}%`, paddingLeft: 4, marginBottom: 0 }]}>DESCRIPTION</Text>
          <Text style={[st.label, st.right, { width: `${W[1]}%`, marginBottom: 0 }]}>QTY</Text>
          <Text style={[st.label, st.right, { width: `${W[2]}%`, marginBottom: 0 }]}>UNIT PRICE</Text>
          <Text style={[st.label, st.right, { width: `${W[3]}%`, marginBottom: 0 }]}>DISCOUNT</Text>
          <Text style={[st.label, st.right, { width: `${W[4]}%`, paddingRight: 4, marginBottom: 0 }]}>TOTAL</Text>
        </View>
        {d.items.map((it, i) => (
          <View key={i} style={st.tr} wrap={false}>
            <View style={{ width: `${W[0]}%`, paddingLeft: 4, paddingRight: 6 }}>
              {it.name ? <Text style={st.bold}>{it.name}</Text> : null}
              {it.description ? <Text style={st.small}>{it.description}</Text> : null}
            </View>
            <Text style={[st.right, { width: `${W[1]}%` }]}>{it.quantity}</Text>
            <Text style={[st.right, { width: `${W[2]}%` }]}>{rp(it.unitPrice)}</Text>
            <Text style={[st.right, { width: `${W[3]}%` }]}>{it.discount ? rp(it.discount) : '-'}</Text>
            <Text style={[st.right, st.bold, { width: `${W[4]}%`, paddingRight: 4 }]}>{rp(it.total)}</Text>
          </View>
        ))}

        <View style={st.totals} wrap={false}>
          <View style={st.tot}><Text style={st.muted}>Subtotal</Text><Text>{rp(d.subtotal)}</Text></View>
          {d.discount ? <View style={st.tot}><Text>Discount</Text><Text>-{rp(d.discount)}</Text></View> : null}
          {d.taxAmount ? <View style={st.tot}><Text>{d.taxLabel}</Text><Text>{rp(d.taxAmount)}</Text></View> : null}
          {d.pphAmount ? <View style={st.tot}><Text>PPh (withheld)</Text><Text>-{rp(d.pphAmount)}</Text></View> : null}
          <View style={st.grand}><Text style={st.bold}>TOTAL</Text><Text style={st.bold}>{rp(d.grandTotal)}</Text></View>
          {d.paid ? <View style={st.tot}><Text>Paid</Text><Text>{rp(d.paid)}</Text></View> : null}
          {d.paid ? <View style={st.tot}><Text style={st.bold}>Balance</Text><Text style={st.bold}>{rp(balance)}</Text></View> : null}
        </View>

        {d.payments.length > 0 && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={st.label}>PAYMENTS RECEIVED</Text>
            {d.payments.map((p, i) => <Text key={i} style={{ marginBottom: 1 }}>{day(p.date)}  -  {rp(p.amount)}</Text>)}
          </View>
        )}

        {d.banks.length > 0 && (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={st.label}>PAYMENT TO</Text>
            {d.banks.map((b, i) => <Text key={i} style={{ marginBottom: 1 }}><Text style={st.bold}>{b.bank}</Text>  {b.number}  {b.holder ? `a.n. ${b.holder}` : ''}</Text>)}
          </View>
        )}

        {d.notes ? (
          <View style={{ marginTop: 14 }} wrap={false}>
            <Text style={st.label}>NOTES</Text>
            <Text>{d.notes}</Text>
          </View>
        ) : null}

        <View style={st.footer} fixed>
          <Text>{d.company.name} - {d.number}</Text>
          <Text render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

export const renderInvoicePdf = (d: InvoicePdfData) => renderToBuffer(<InvoicePdf d={d} />);
