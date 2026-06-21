import { useState, useEffect } from 'react';
import {
  FileText, Plus, Eye, X, Save, Printer, ArrowLeft,
  AlertCircle, CheckCircle, Building2, Search, FileX
} from 'lucide-react';
import { supabase } from '../lib/supabase';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Organization {
  id: string;
  name: string;
  vat_number?: string;
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  province?: string;
  postal_code?: string;
  country?: string;
  company_registration_number?: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  total_amount: number;
  billing_period_start: string;
  billing_period_end: string;
}

interface CreditNote {
  id: string;
  credit_note_number: string;
  organization_id: string;
  invoice_id: string | null;
  credit_note_date: string;
  reason: string;
  subtotal: number;
  vat_amount: number;
  vat_rate: number;
  total_amount: number;
  status: 'issued' | 'applied' | 'cancelled';
  issued_at: string;
  notes?: string;
  organization?: Organization;
  invoice?: Invoice | null;
}

interface LineItemDraft {
  description: string;
  quantity: string;
  unit_price: string;
}

interface CreditNoteLineItem {
  id: string;
  line_number: number;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

interface ManagementOrg {
  name: string;
  vat_number?: string;
  address_line_1: string;
  address_line_2?: string;
  city: string;
  province: string;
  postal_code: string;
  country?: string;
  phone_number?: string;
  company_registration_number?: string;
}

interface Props {
  onBack: () => void;
}

const VAT_RATE = 0.15;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) =>
  `R ${Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;

const formatDate = (d: string) => {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
};

const statusBadge = (status: CreditNote['status']) => {
  switch (status) {
    case 'issued':
      return 'bg-blue-100 text-blue-800';
    case 'applied':
      return 'bg-green-100 text-green-800';
    case 'cancelled':
      return 'bg-red-100 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

// ─── Component ────────────────────────────────────────────────────────────────

function CreditNoteManagement({ onBack }: Props) {
  const [view, setView] = useState<'list' | 'create' | 'detail'>('list');

  // list state
  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<CreditNote[]>([]);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // detail state
  const [selectedNote, setSelectedNote] = useState<CreditNote | null>(null);
  const [detailLineItems, setDetailLineItems] = useState<CreditNoteLineItem[]>([]);
  const [managementOrg, setManagementOrg] = useState<ManagementOrg | null>(null);

  // create form state
  const [form, setForm] = useState({
    organization_id: '',
    invoice_id: '',
    credit_note_date: new Date().toISOString().split('T')[0],
    reason: '',
    notes: '',
  });
  const [orgInvoices, setOrgInvoices] = useState<Invoice[]>([]);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { description: '', quantity: '1', unit_price: '' },
  ]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // ─── Load ────────────────────────────────────────────────────────────────

  useEffect(() => {
    loadOrganizations();
    loadManagementOrg();
  }, []);

  useEffect(() => {
    if (selectedOrgId) loadCreditNotes();
    else {
      setCreditNotes([]);
      setFilteredNotes([]);
    }
  }, [selectedOrgId]);

  useEffect(() => {
    applyFilter();
  }, [creditNotes, statusFilter]);

  useEffect(() => {
    if (form.organization_id) loadOrgInvoices(form.organization_id);
    else setOrgInvoices([]);
  }, [form.organization_id]);

  const loadOrganizations = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('id, name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, company_registration_number')
      .eq('is_management_org', false)
      .order('name');
    setOrganizations(data || []);
  };

  const loadManagementOrg = async () => {
    const { data } = await supabase
      .from('organizations')
      .select('name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, phone_number, company_registration_number')
      .eq('is_management_org', true)
      .maybeSingle();
    if (data) setManagementOrg(data as ManagementOrg);
  };

  const loadCreditNotes = async () => {
    if (!selectedOrgId) return;
    try {
      setLoading(true);
      setError('');
      let q = supabase
        .from('credit_notes')
        .select(`*, organization:organizations(name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, company_registration_number), invoice:invoices!credit_notes_invoice_id_fkey(invoice_number, invoice_date, total_amount, billing_period_start, billing_period_end)`)
        .order('created_at', { ascending: false });

      if (selectedOrgId !== 'all') q = q.eq('organization_id', selectedOrgId);

      const { data, error: err } = await q;
      if (err) throw err;
      setCreditNotes((data as CreditNote[]) || []);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const loadOrgInvoices = async (orgId: string) => {
    const { data } = await supabase
      .from('invoices')
      .select('id, invoice_number, invoice_date, total_amount, billing_period_start, billing_period_end')
      .eq('organization_id', orgId)
      .order('invoice_date', { ascending: false });
    setOrgInvoices(data || []);
  };

  const loadDetailLineItems = async (creditNoteId: string) => {
    const { data } = await supabase
      .from('credit_note_line_items')
      .select('*')
      .eq('credit_note_id', creditNoteId)
      .order('line_number');
    setDetailLineItems((data as CreditNoteLineItem[]) || []);
  };

  const applyFilter = () => {
    if (statusFilter === 'all') setFilteredNotes(creditNotes);
    else setFilteredNotes(creditNotes.filter(n => n.status === statusFilter));
  };

  // ─── Derived totals ──────────────────────────────────────────────────────

  const parsedItems = lineItems.map(li => ({
    description: li.description,
    quantity: parseFloat(li.quantity) || 0,
    unit_price: parseFloat(li.unit_price) || 0,
    line_total: Math.round((parseFloat(li.quantity) || 0) * (parseFloat(li.unit_price) || 0) * 100) / 100,
  }));

  const subtotal = Math.round(parsedItems.reduce((s, i) => s + i.line_total, 0) * 100) / 100;
  const vatAmount = Math.round(subtotal * VAT_RATE * 100) / 100;
  const totalAmount = Math.round((subtotal + vatAmount) * 100) / 100;

  // ─── Actions ─────────────────────────────────────────────────────────────

  const openDetail = async (note: CreditNote) => {
    setSelectedNote(note);
    await loadDetailLineItems(note.id);
    setView('detail');
  };

  const handleCreate = async () => {
    setFormError('');
    if (!form.organization_id) return setFormError('Please select an organization.');
    if (!form.reason.trim()) return setFormError('Please enter a reason for the credit note.');
    if (parsedItems.every(i => i.line_total === 0)) return setFormError('Please add at least one line item with an amount.');

    try {
      setSaving(true);

      const { data: cnNum, error: seqErr } = await supabase.rpc('get_next_credit_note_number');
      if (seqErr) throw seqErr;

      const { data: { user } } = await supabase.auth.getUser();

      const { data: cn, error: cnErr } = await supabase
        .from('credit_notes')
        .insert({
          credit_note_number: cnNum,
          organization_id: form.organization_id,
          invoice_id: form.invoice_id || null,
          credit_note_date: form.credit_note_date,
          reason: form.reason.trim(),
          subtotal,
          vat_amount: vatAmount,
          vat_rate: VAT_RATE,
          total_amount: totalAmount,
          status: 'issued',
          issued_by: user?.id ?? null,
          notes: form.notes.trim() || null,
        })
        .select()
        .single();

      if (cnErr) throw cnErr;

      const lineItemRows = parsedItems
        .filter(i => i.line_total > 0)
        .map((item, idx) => ({
          credit_note_id: cn.id,
          line_number: idx + 1,
          description: item.description || 'Credit adjustment',
          quantity: item.quantity,
          unit_price: item.unit_price,
          line_total: item.line_total,
        }));

      if (lineItemRows.length > 0) {
        const { error: liErr } = await supabase.from('credit_note_line_items').insert(lineItemRows);
        if (liErr) throw liErr;
      }

      await loadCreditNotes();
      const { data: full } = await supabase
        .from('credit_notes')
        .select(`*, organization:organizations(name, vat_number, address_line_1, address_line_2, city, province, postal_code, country, company_registration_number), invoice:invoices!credit_notes_invoice_id_fkey(invoice_number, invoice_date, total_amount, billing_period_start, billing_period_end)`)
        .eq('id', cn.id)
        .maybeSingle();
      if (full) {
        setSelectedNote(full as CreditNote);
        await loadDetailLineItems(cn.id);
      }
      resetForm();
      setView('detail');
    } catch (e: any) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (id: string) => {
    if (!confirm('Cancel this credit note? This cannot be undone.')) return;
    const { error: e } = await supabase
      .from('credit_notes')
      .update({ status: 'cancelled' })
      .eq('id', id);
    if (e) { setError(e.message); return; }
    await loadCreditNotes();
    if (selectedNote?.id === id) {
      setSelectedNote(prev => prev ? { ...prev, status: 'cancelled' } : null);
    }
  };

  const handleMarkApplied = async (id: string) => {
    if (!confirm('Mark this credit note as applied to the client account?')) return;
    const { error: e } = await supabase
      .from('credit_notes')
      .update({ status: 'applied' })
      .eq('id', id);
    if (e) { setError(e.message); return; }
    await loadCreditNotes();
    if (selectedNote?.id === id) {
      setSelectedNote(prev => prev ? { ...prev, status: 'applied' } : null);
    }
  };

  const resetForm = () => {
    setForm({ organization_id: '', invoice_id: '', credit_note_date: new Date().toISOString().split('T')[0], reason: '', notes: '' });
    setLineItems([{ description: '', quantity: '1', unit_price: '' }]);
    setFormError('');
  };

  // ─── Line item helpers ───────────────────────────────────────────────────

  const updateLineItem = (idx: number, field: keyof LineItemDraft, value: string) => {
    setLineItems(prev => prev.map((li, i) => i === idx ? { ...li, [field]: value } : li));
  };

  const addLineItem = () => setLineItems(prev => [...prev, { description: '', quantity: '1', unit_price: '' }]);

  const removeLineItem = (idx: number) => {
    if (lineItems.length === 1) return;
    setLineItems(prev => prev.filter((_, i) => i !== idx));
  };

  // ─── Views ───────────────────────────────────────────────────────────────

  if (view === 'create') {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">New Credit Note</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Issue Credit Note'}
            </button>
            <button onClick={() => { resetForm(); setView('list'); }} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          </div>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {formError}
          </div>
        )}

        <div className="bg-white border border-gray-200 rounded-xl shadow-sm divide-y divide-gray-100">
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Organization *</label>
              <select
                value={form.organization_id}
                onChange={e => setForm(f => ({ ...f, organization_id: e.target.value, invoice_id: '' }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Select organization --</option>
                {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Credit Note Date *</label>
              <input
                type="date"
                value={form.credit_note_date}
                onChange={e => setForm(f => ({ ...f, credit_note_date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Related Invoice (optional)</label>
              <select
                value={form.invoice_id}
                onChange={e => setForm(f => ({ ...f, invoice_id: e.target.value }))}
                disabled={!form.organization_id}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">-- None / standalone credit note --</option>
                {orgInvoices.map(inv => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoice_number} — {formatDate(inv.invoice_date)} — {formatCurrency(inv.total_amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Reason *</label>
              <select
                value={form.reason}
                onChange={e => setForm(f => ({ ...f, reason: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              >
                <option value="">Select a reason...</option>
                <option value="Overpayment">Overpayment</option>
                <option value="Billing Error">Billing Error</option>
                <option value="Service Credit">Service Credit</option>
                <option value="Refund">Refund</option>
                <option value="Adjustment">Adjustment</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-1">Internal Notes (optional)</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any internal notes about this credit note..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>
          </div>

          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-800">Line Items</h3>
              <button onClick={addLineItem} className="flex items-center gap-1 text-blue-600 hover:text-blue-700 text-sm font-medium">
                <Plus className="w-4 h-4" /> Add Line
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wide px-1">
                <div className="col-span-5">Description</div>
                <div className="col-span-2 text-right">Qty</div>
                <div className="col-span-3 text-right">Unit Price</div>
                <div className="col-span-2 text-right">Total</div>
              </div>

              {lineItems.map((li, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={li.description}
                      onChange={e => updateLineItem(idx, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={li.quantity}
                      onChange={e => updateLineItem(idx, 'quantity', e.target.value)}
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={li.unit_price}
                      onChange={e => updateLineItem(idx, 'unit_price', e.target.value)}
                      placeholder="0.00"
                      className="w-full px-2 py-1.5 border border-gray-300 rounded text-sm text-right focus:ring-1 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div className="col-span-1 text-right text-sm text-gray-700 font-medium pr-1">
                    {parsedItems[idx]?.line_total > 0 ? `R ${parsedItems[idx].line_total.toFixed(2)}` : '—'}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button onClick={() => removeLineItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>VAT (15%)</span><span>{formatCurrency(vatAmount)}</span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                <span>Total Credit</span><span className="text-green-700">{formatCurrency(totalAmount)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === 'detail' && selectedNote) {
    return (
      <>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            body { margin: 0 !important; padding: 0 !important; }
            html, body { height: auto !important; overflow: visible !important; }
            #cn-detail { box-shadow: none !important; margin: 0 !important; border-radius: 0 !important; }
            @page { margin: 0.5cm; size: A4; }
            table { font-size: 0.875rem !important; }
          }
        `}</style>

        <div className="space-y-4">
          <div className="flex items-center justify-between no-print">
            <span />
            <div className="flex gap-2">
              <button onClick={() => setView('list')} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium">
                <ArrowLeft className="w-4 h-4" /> Back to Credit Notes
              </button>
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
              {selectedNote.status === 'issued' && (
                <>
                  <button
                    onClick={() => handleMarkApplied(selectedNote.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <CheckCircle className="w-4 h-4" /> Mark Applied
                  </button>
                  <button
                    onClick={() => handleCancel(selectedNote.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 border border-red-200 rounded-lg hover:bg-red-100 transition-colors text-sm"
                  >
                    <X className="w-4 h-4" /> Cancel
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden" id="cn-detail">
            {managementOrg && (
              <div className="p-8 border-b border-gray-300">
                <div className="flex justify-between items-start">
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 mb-1">{managementOrg.name}</h1>
                    <div className="text-sm text-gray-600 space-y-0.5">
                      <p>{managementOrg.address_line_1}{managementOrg.address_line_2 && `, ${managementOrg.address_line_2}`}</p>
                      <p>{managementOrg.city}, {managementOrg.province} {managementOrg.postal_code}</p>
                      {managementOrg.country && <p>{managementOrg.country}</p>}
                      {managementOrg.phone_number && <p>Phone: {managementOrg.phone_number}</p>}
                      <div className="flex gap-4 mt-2 font-medium">
                        {managementOrg.vat_number && <p>VAT No: {managementOrg.vat_number}</p>}
                        {managementOrg.company_registration_number && <p>Reg No: {managementOrg.company_registration_number}</p>}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-extrabold text-green-700 tracking-tight">CREDIT NOTE</div>
                    <div className="mt-2 space-y-0.5 text-sm text-gray-600">
                      <p><span className="font-semibold">CN No:</span> {selectedNote.credit_note_number}</p>
                      <p><span className="font-semibold">Date:</span> {formatDate(selectedNote.credit_note_date)}</p>
                      <p>
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(selectedNote.status)}`}>
                          {selectedNote.status.charAt(0).toUpperCase() + selectedNote.status.slice(1)}
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="p-8 space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Credit Issued To</p>
                  {selectedNote.organization && (
                    <div className="text-sm text-gray-800 space-y-0.5">
                      <p className="font-bold text-base">{selectedNote.organization.name}</p>
                      {selectedNote.organization.address_line_1 && <p>{selectedNote.organization.address_line_1}{selectedNote.organization.address_line_2 && `, ${selectedNote.organization.address_line_2}`}</p>}
                      {selectedNote.organization.city && <p>{selectedNote.organization.city}{selectedNote.organization.province && `, ${selectedNote.organization.province}`} {selectedNote.organization.postal_code}</p>}
                      {selectedNote.organization.vat_number && <p className="font-medium mt-1">VAT No: {selectedNote.organization.vat_number}</p>}
                      {selectedNote.organization.company_registration_number && <p className="font-medium">Reg No: {selectedNote.organization.company_registration_number}</p>}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">Details</p>
                  <div className="text-sm text-gray-700 space-y-1">
                    <div className="flex gap-2"><span className="font-semibold w-32">Reason:</span><span>{selectedNote.reason}</span></div>
                    {selectedNote.invoice && (
                      <div className="flex gap-2"><span className="font-semibold w-32">Related Invoice:</span><span>{selectedNote.invoice.invoice_number}</span></div>
                    )}
                    {selectedNote.notes && (
                      <div className="flex gap-2 mt-2"><span className="font-semibold w-32">Notes:</span><span className="text-gray-600 italic">{selectedNote.notes}</span></div>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-300">
                      <th className="text-left py-2 font-semibold text-gray-700">Description</th>
                      <th className="text-right py-2 font-semibold text-gray-700 w-16">Qty</th>
                      <th className="text-right py-2 font-semibold text-gray-700 w-28">Unit Price</th>
                      <th className="text-right py-2 font-semibold text-gray-700 w-28">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailLineItems.map(li => (
                      <tr key={li.id} className="border-b border-gray-100">
                        <td className="py-2 text-gray-800">{li.description}</td>
                        <td className="py-2 text-right text-gray-600">{li.quantity}</td>
                        <td className="py-2 text-right text-gray-600">{formatCurrency(li.unit_price)}</td>
                        <td className="py-2 text-right font-medium text-gray-900">{formatCurrency(li.line_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="w-64 space-y-1 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal</span><span>{formatCurrency(selectedNote.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>VAT (15%)</span><span>{formatCurrency(selectedNote.vat_amount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-300 pt-2 mt-2">
                    <span>Total Credit</span>
                    <span className="text-green-700">{formatCurrency(selectedNote.total_amount)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  // ─── List view ────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <FileX className="w-5 h-5 text-green-600" />
              Credit Notes
            </h2>
            <p className="text-sm text-gray-500">Issue and manage credit notes for client organizations</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { resetForm(); setView('create'); }}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New Credit Note
          </button>
          <button onClick={onBack} className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors no-print">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2 text-sm text-red-800">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{error}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-48">
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={selectedOrgId}
              onChange={e => setSelectedOrgId(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">-- Select organization --</option>
              <option value="all">All Organizations</option>
              {organizations.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </div>
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Statuses</option>
          <option value="issued">Issued</option>
          <option value="applied">Applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {!selectedOrgId ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <Search className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Select an organization to view its credit notes</p>
        </div>
      ) : loading ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400 text-sm">Loading...</div>
      ) : filteredNotes.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">No credit notes found</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">CN Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Organization</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Linked Invoice</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Total Credit</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredNotes.map(note => (
                <tr key={note.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">{note.credit_note_number}</td>
                  <td className="px-4 py-3 text-gray-800">{note.organization?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{formatDate(note.credit_note_date)}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-xs truncate">{note.reason}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{note.invoice?.invoice_number ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">{formatCurrency(note.total_amount)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${statusBadge(note.status)}`}>
                      {note.status.charAt(0).toUpperCase() + note.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => openDetail(note)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors text-xs font-medium"
                    >
                      <Eye className="w-3.5 h-3.5" /> View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}


export default CreditNoteManagement