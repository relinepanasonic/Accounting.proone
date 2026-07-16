'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RupiahInput } from '@/components/ui/RupiahInput';
import { DescriptionBullets } from '@/components/ui/DescriptionBullets';
import { BulletTextarea } from '@/components/ui/BulletTextarea';
import {
  ArrowLeft,
  Sliders,
  CreditCard,
  Package,
  Plus,
  Trash2,
  Star,
  Check,
  AlertCircle,
  Loader2,
  Save,
  Building2,
  Edit2,
  Copy,
  X,
} from 'lucide-react';
import {
  saveWorkspaceSettings,
  createProduct,
  updateProduct,
  duplicateProduct,
  deleteProduct,
  type BankAccountItem,
} from '@/app/actions/settings';
import type { CatalogProduct } from '@/components/settings/CatalogManager';

interface WorkspaceDetailTabsProps {
  targetWorkspaceId: string;
  workspaceName: string;
  isTaxRegistered: boolean;
  taxRatePercent: number;
  logoUrl?: string;
  tagline?: string;
  phone?: string;
  email?: string;
  website?: string;
  bankAccounts: BankAccountItem[];
  products: CatalogProduct[];
  isCurrentActive: boolean;
}

export function WorkspaceDetailTabs({
  targetWorkspaceId,
  workspaceName: initialName,
  isTaxRegistered: initialTaxRegistered,
  taxRatePercent: initialTaxRate,
  logoUrl: initialLogoUrl = '',
  tagline: initialTagline = '',
  phone: initialPhone = '',
  email: initialEmail = '',
  website: initialWebsite = '',
  bankAccounts: initialBankAccounts,
  products: initialProducts,
  isCurrentActive,
}: WorkspaceDetailTabsProps) {
  const router = useRouter();

  // Navigation State (ordered: Product List -> Bank Account -> Tax)
  const [activeTab, setActiveTab] = useState<'catalog' | 'banking' | 'identity'>('catalog');

  // Tab 1: Identity & Brand State
  const [name, setName] = useState(initialName);
  const [isTaxRegistered, setIsTaxRegistered] = useState(initialTaxRegistered);
  const [taxRatePercent, setTaxRatePercent] = useState(initialTaxRate || 11);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [tagline, setTagline] = useState(initialTagline);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [website, setWebsite] = useState(initialWebsite);
  const [identityMsg, setIdentityMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [identityPending, startIdentityTransition] = useTransition();

  // Tab 2: Banking State
  const [accounts, setAccounts] = useState<BankAccountItem[]>(initialBankAccounts);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBankName, setNewBankName] = useState('');
  const [newAccountNumber, setNewAccountNumber] = useState('');
  const [newAccountName, setNewAccountName] = useState('');
  const [bankingMsg, setBankingMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [bankingPending, startBankingTransition] = useTransition();

  // Tab 3: Catalog State
  const [catalogItems, setCatalogItems] = useState<CatalogProduct[]>(initialProducts);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdDesc, setNewProdDesc] = useState('');
  const [newProdPrice, setNewProdPrice] = useState('85000000');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdDesc, setEditProdDesc] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('0');
  const [catalogMsg, setCatalogMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [catalogPending, startCatalogTransition] = useTransition();

  // --- Handlers: Identity Tab ---
  const handleSaveIdentity = (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityMsg(null);
    const effectiveTaxRate = isTaxRegistered ? Number(taxRatePercent) || 0 : 0;

    startIdentityTransition(async () => {
      const res = await saveWorkspaceSettings({
        targetWorkspaceId,
        name,
        isTaxRegistered,
        taxRatePercent: effectiveTaxRate,
        logoUrl,
        tagline,
        phone,
        email,
        website,
      });

      if (res.success) {
        setIdentityMsg({ type: 'success', text: 'Identity & Tax profile updated successfully.' });
        router.refresh();
      } else {
        setIdentityMsg({ type: 'error', text: res.error || 'Failed to update identity settings.' });
      }
    });
  };

  // --- Handlers: Banking Tab ---
  const syncBankAccountsToServer = (updatedList: BankAccountItem[], successMessage: string) => {
    setBankingMsg(null);
    setAccounts(updatedList);

    startBankingTransition(async () => {
      const res = await saveWorkspaceSettings({
        targetWorkspaceId,
        bankAccounts: updatedList,
      });
      if (res.success) {
        if (res.savedBankAccounts) {
          setAccounts(res.savedBankAccounts);
        }
        setBankingMsg({ type: 'success', text: successMessage });
        router.refresh();
      } else {
        setBankingMsg({ type: 'error', text: res.error || 'Failed to sync bank accounts.' });
      }
    });
  };

  const handleRegisterBank = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBankName.trim() || !newAccountNumber.trim() || !newAccountName.trim()) return;

    const isFirst = accounts.length === 0;
    const newItem: BankAccountItem = {
      id: `temp-${Date.now()}`,
      bank_name: newBankName.trim(),
      account_number: newAccountNumber.trim(),
      account_name: newAccountName.trim(),
      is_default: isFirst,
    };

    const updated = [newItem, ...accounts];
    setShowAddBankModal(false);
    setNewBankName('');
    setNewAccountNumber('');
    setNewAccountName('');
    syncBankAccountsToServer(updated, `Registered "${newItem.bank_name}" successfully.`);
  };

  const handleDeleteBank = (id?: string, index?: number) => {
    let updated = accounts.filter((_, i) => (id ? _.id !== id : i !== index));
    if (updated.length > 0 && !updated.some((b) => b.is_default)) {
      updated[0].is_default = true;
    }
    syncBankAccountsToServer(updated, 'Bank account removed and settlement methods synced.');
  };

  const handleSetDefaultBank = (index: number) => {
    const updated = accounts.map((item, i) => ({
      ...item,
      is_default: i === index,
    }));
    syncBankAccountsToServer(updated, `Set "${updated[index].bank_name}" as primary default settlement account.`);
  };

  // --- Handlers: Catalog Tab ---
  const handleCreateProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return;
    setCatalogMsg(null);

    startCatalogTransition(async () => {
      const res = await createProduct({
        targetWorkspaceId,
        name: newProdName.trim(),
        description: newProdDesc.trim(),
        unitPrice: Number(newProdPrice) || 0,
      });

      if (res.success) {
        setCatalogItems((prev) => [
          {
            id: `temp-${Date.now()}`,
            name: newProdName.trim(),
            description: newProdDesc.trim() || undefined,
            unit_price: Number(newProdPrice) || 0,
          },
          ...prev,
        ]);
        setCatalogMsg({ type: 'success', text: `Added "${newProdName}" to deliverable catalog.` });
        setShowAddProductModal(false);
        setNewProdName('');
        setNewProdDesc('');
        setNewProdPrice('1000000');
        router.refresh();
      } else {
        setCatalogMsg({ type: 'error', text: res.error || 'Failed to add product.' });
      }
    });
  };

  const handleDeleteProduct = (productId: string) => {
    setCatalogMsg(null);
    setCatalogItems((prev) => prev.filter((p) => p.id !== productId));

    startCatalogTransition(async () => {
      const res = await deleteProduct(productId, targetWorkspaceId);
      if (!res.success) {
        setCatalogMsg({ type: 'error', text: res.error || 'Failed to remove item from server.' });
      } else {
        router.refresh();
      }
    });
  };

  const handleUpdateProduct = (productId: string) => {
    if (!editProdName.trim()) return;
    setCatalogMsg(null);
    startCatalogTransition(async () => {
      const res = await updateProduct({
        id: productId,
        targetWorkspaceId,
        name: editProdName.trim(),
        description: editProdDesc,
        unitPrice: Number(editProdPrice) || 0,
      });
      if (res.success) {
        setCatalogItems((prev) =>
          prev.map((p) =>
            p.id === productId
              ? {
                  ...p,
                  name: editProdName.trim(),
                  description: editProdDesc,
                  unit_price: Number(editProdPrice) || 0,
                }
              : p
          )
        );
        setCatalogMsg({ type: 'success', text: `Updated "${editProdName.trim()}" successfully.` });
        setEditingProductId(null);
        router.refresh();
      } else {
        setCatalogMsg({ type: 'error', text: res.error || 'Failed to update item.' });
      }
    });
  };

  const handleDuplicateProduct = (productId: string) => {
    setCatalogMsg(null);
    startCatalogTransition(async () => {
      const res = await duplicateProduct(productId, targetWorkspaceId);
      if (res.success) {
        if (res.product) {
          setCatalogItems((prev) => [...prev, res.product]);
        }
        setCatalogMsg({ type: 'success', text: 'Product duplicated successfully.' });
        router.refresh();
      } else {
        setCatalogMsg({ type: 'error', text: res.error || 'Failed to duplicate item.' });
      }
    });
  };

  return (
    <div className="space-y-8 pb-16">
      {/* HEADER SECTION */}
      <div className="border-b border-yellow-600/30 pb-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link
            href="/settings/workspaces"
            className="inline-flex items-center gap-2 text-xs font-mono font-bold uppercase tracking-wider text-zinc-400 hover:text-[#f5d77f] transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 text-[#d4af37] group-hover:-translate-x-1 transition-transform" />
            <span>← Back to Workspaces</span>
          </Link>

          {isCurrentActive ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-mono uppercase font-bold shadow-[0_0_15px_rgba(16,185,129,0.15)]">
              <Check className="w-3.5 h-3.5" />
              <span>Active Operating Session</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-yellow-600/30 text-zinc-300 text-xs font-mono uppercase font-bold">
              <span>Standby Tenant Clearance</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#18233c] to-[#0b0c10] border border-[#d4af37] flex items-center justify-center font-extrabold text-[#f5d77f] text-xl shadow-[0_0_25px_rgba(212,175,55,0.25)] shrink-0">
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white font-serif tracking-wide">
              {name}
            </h1>
            <div className="text-xs font-mono text-zinc-400 mt-1 flex items-center gap-2 flex-wrap">
              <span>TENANT ID: <span className="text-zinc-300">{targetWorkspaceId}</span></span>
              <span>•</span>
              <span className="text-[#f5d77f] font-bold">SUPERADMIN CONTROL MATRIX</span>
            </div>
          </div>
        </div>
      </div>

      {/* HORIZONTAL TAB PILLS WRAPPER (Product List | Bank Account | Tax) */}
      <div className="bg-white/5 backdrop-blur-md border border-yellow-600/30 rounded-2xl p-1.5 flex flex-wrap items-center gap-2 shadow-[0_0_30px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => setActiveTab('catalog')}
          className={`flex-1 min-w-[150px] py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all duration-300 ${
            activeTab === 'catalog'
              ? 'bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] font-extrabold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Package className={`w-4 h-4 ${activeTab === 'catalog' ? 'text-black' : 'text-[#d4af37]'}`} />
          <span>Product List</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'catalog'
                ? 'bg-black text-[#f5d77f]'
                : 'bg-white/10 text-zinc-300'
            }`}
          >
            {catalogItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('banking')}
          className={`flex-1 min-w-[150px] py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all duration-300 ${
            activeTab === 'banking'
              ? 'bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] font-extrabold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <CreditCard className={`w-4 h-4 ${activeTab === 'banking' ? 'text-black' : 'text-[#d4af37]'}`} />
          <span>Bank Account</span>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              activeTab === 'banking'
                ? 'bg-black text-[#f5d77f]'
                : 'bg-white/10 text-zinc-300'
            }`}
          >
            {accounts.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('identity')}
          className={`flex-1 min-w-[150px] py-3 px-5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2.5 transition-all duration-300 ${
            activeTab === 'identity'
              ? 'bg-gradient-to-r from-[#d4af37] to-[#f5d77f] text-black shadow-[0_0_20px_rgba(212,175,55,0.4)] font-extrabold'
              : 'text-zinc-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <Sliders className={`w-4 h-4 ${activeTab === 'identity' ? 'text-black' : 'text-[#d4af37]'}`} />
          <span>Tax</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: IDENTITY & TAX PROFILE */}
      {/* ========================================================================= */}
      {activeTab === 'identity' && (
        <form
          onSubmit={handleSaveIdentity}
          className="bg-white/5 backdrop-blur-md border border-yellow-600/30 rounded-3xl p-6 sm:p-8 space-y-8 shadow-[0_0_40px_rgba(0,0,0,0.5)] animate-in fade-in duration-200"
        >
          <div className="border-b border-yellow-600/20 pb-4">
            <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
              LEGAL ENTITY & TAX PROFILE PARAMETERS
            </h2>
            <p className="text-xs text-zinc-400 font-sans mt-1">
              Configure official business registration title and automated Indonesian PPN (VAT) invoice rules.
            </p>
          </div>

          {identityMsg && (
            <div
              className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-mono border ${
                identityMsg.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                  : 'bg-red-950/60 border-red-700 text-red-200'
              }`}
            >
              {identityMsg.type === 'success' ? (
                <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              )}
              <span>{identityMsg.text}</span>
            </div>
          )}

          <div className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                WORKSPACE / ENTERPRISE NAME *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={identityPending}
                className="w-full bg-black/60 border border-yellow-600/30 rounded-2xl px-4 py-3.5 text-sm text-white font-sans focus:outline-none focus:border-[#d4af37] transition-all"
              />
            </div>

            {/* BRAND IDENTITY BOX: Logo | Tagline | Mobile phone | Email | Website */}
            <div className="p-5 rounded-2xl bg-black/40 border border-yellow-600/20 space-y-5">
              <div className="border-b border-yellow-600/20 pb-3">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#f5d77f] font-mono">
                  BRAND IDENTITY PARAMETERS (FOR INVOICES & QUOTATIONS)
                </h3>
                <p className="text-[11px] text-zinc-400 font-sans mt-0.5">
                  These details auto-fill onto PDF Invoices, Quotations, and client pitches generated from this workspace.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    LOGO URL (IMAGE PATH OR DIRECT LINK)
                  </label>
                  <input
                    type="text"
                    placeholder="/logo (8).png or https://..."
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    disabled={identityPending}
                    className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#d4af37] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    BRAND TAGLINE / SUBTITLE
                  </label>
                  <input
                    type="text"
                    placeholder="EXECUTIVE E-COMMERCE & CREATOR ACCOUNTING"
                    value={tagline}
                    onChange={(e) => setTagline(e.target.value)}
                    disabled={identityPending}
                    className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-sans focus:outline-none focus:border-[#d4af37] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    MOBILE PHONE / CONTACT NUMBER
                  </label>
                  <input
                    type="text"
                    placeholder="+62 811-XXXX-XXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={identityPending}
                    className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#d4af37] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    OFFICIAL EMAIL ADDRESS
                  </label>
                  <input
                    type="email"
                    placeholder="billing@yourbrand.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={identityPending}
                    className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#d4af37] transition-all"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5">
                    WEBSITE URL
                  </label>
                  <input
                    type="text"
                    placeholder="www.yourdomain.com"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    disabled={identityPending}
                    className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-[#d4af37] transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Official Tax Registration Toggle */}
            <div className="p-5 rounded-2xl bg-black/40 border border-yellow-600/20 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <label className="text-sm font-bold text-white cursor-pointer select-none flex items-center gap-2">
                    <span>Tax Registered Entity (PKP)</span>
                    {isTaxRegistered && (
                      <span className="text-[10px] font-mono text-[#f5d77f] uppercase px-2 py-0.5 rounded bg-[#d4af37]/15 border border-[#d4af37]/40">
                        ACTIVE
                      </span>
                    )}
                  </label>
                  <p className="text-xs text-zinc-400 font-sans">
                    Toggle ON if this enterprise legally charges PPN / VAT on outbound client invoices.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsTaxRegistered(!isTaxRegistered)}
                  disabled={identityPending}
                  className={`w-14 h-8 rounded-full p-1 transition-all duration-300 flex items-center shrink-0 ${
                    isTaxRegistered
                      ? 'bg-gradient-to-r from-[#d4af37] to-[#f5d77f] shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                      : 'bg-zinc-800 border border-zinc-700'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-black transition-transform duration-300 shadow-md ${
                      isTaxRegistered ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {isTaxRegistered && (
                <div className="pt-4 border-t border-yellow-600/20 animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">
                    TAX RATE (%) • PPN PERCENTAGE VALUE
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      required={isTaxRegistered}
                      value={taxRatePercent}
                      onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                      disabled={identityPending}
                      className="w-44 bg-black border border-[#d4af37]/50 rounded-xl px-4 py-3 text-sm font-mono font-bold text-[#f5d77f] focus:outline-none focus:border-[#d4af37] transition-all"
                    />
                    <span className="text-xs text-zinc-400 font-mono">
                      Calculated automatically across all line items when generating PDF invoices.
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-yellow-600/20 flex justify-end">
            <button
              type="submit"
              disabled={identityPending}
              className="gold-btn inline-flex items-center justify-center gap-2.5 px-10 py-4 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_30px_rgba(212,175,55,0.35)] disabled:opacity-50 transition-all min-h-[46px]"
            >
              {identityPending ? (
                <Loader2 className="w-4 h-4 animate-spin text-black" />
              ) : (
                <Save className="w-4 h-4 text-black" />
              )}
              <span>SAVE IDENTITY & TAX CONFIG</span>
            </button>
          </div>
        </form>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BANK ACCOUNTS (Progressive Disclosure) */}
      {/* ========================================================================= */}
      {activeTab === 'banking' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white/5 backdrop-blur-md border border-yellow-600/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-yellow-600/20 pb-5">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
                  CORPORATE SETTLEMENT ACCOUNTS ({accounts.length})
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-1">
                  Bank accounts formatted automatically into PDF payment instructions on client invoices.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddBankModal(!showAddBankModal);
                  setBankingMsg(null);
                }}
                className="gold-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.35)] shrink-0 transition-transform hover:scale-105"
              >
                <Plus className="w-4 h-4 text-black" />
                <span>{showAddBankModal ? 'CLOSE FORM' : '+ REGISTER BANK ACCOUNT'}</span>
              </button>
            </div>

            {bankingMsg && (
              <div
                className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-mono border ${
                  bankingMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-700 text-red-200'
                }`}
              >
                {bankingMsg.type === 'success' ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{bankingMsg.text}</span>
              </div>
            )}

            {/* PROGRESSIVE DISCLOSURE: Add Bank Account Modal / Accordion */}
            {showAddBankModal && (
              <form
                onSubmit={handleRegisterBank}
                className="p-6 rounded-3xl bg-black/80 border border-[#d4af37]/60 space-y-5 animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_35px_rgba(212,175,55,0.2)]"
              >
                <div className="flex items-center justify-between border-b border-yellow-600/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] font-mono">
                    <Plus className="w-4 h-4" />
                    <span>NEW SETTLEMENT BANK DETAILS</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    INSTANT TENANT SYNC
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                      BANK / INSTITUTION NAME *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Bank BCA Corporate, Wise"
                      value={newBankName}
                      onChange={(e) => setNewBankName(e.target.value)}
                      autoFocus
                      className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                      ACCOUNT / VA NUMBER *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 429-577-5778"
                      value={newAccountNumber}
                      onChange={(e) => setNewAccountNumber(e.target.value)}
                      className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                      ACCOUNT HOLDER NAME *
                    </label>
                    <input
                      type="text"
                      placeholder={`e.g. ${initialName}`}
                      value={newAccountName}
                      onChange={(e) => setNewAccountName(e.target.value)}
                      className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBankModal(false);
                      setNewBankName('');
                      setNewAccountNumber('');
                      setNewAccountName('');
                    }}
                    className="px-5 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono uppercase transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={
                      bankingPending ||
                      !newBankName.trim() ||
                      !newAccountNumber.trim() ||
                      !newAccountName.trim()
                    }
                    className="gold-btn inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-50"
                  >
                    {bankingPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <Plus className="w-4 h-4 text-black" />
                    )}
                    <span>SAVE BANK ACCOUNT</span>
                  </button>
                </div>
              </form>
            )}

            {/* Grid of Luxurious Credit Card Style Blocks */}
            {accounts.length === 0 && !showAddBankModal ? (
              <div className="p-12 rounded-3xl bg-black/40 border border-yellow-600/20 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-yellow-600/10 border border-yellow-600/30 flex items-center justify-center mx-auto text-[#f5d77f]">
                  <CreditCard className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-extrabold uppercase text-white font-serif">
                  NO SETTLEMENT ACCOUNTS REGISTERED
                </h3>
                <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto">
                  Click the register button above to save corporate bank accounts so clients know where to transfer settlement funds.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {accounts.map((acc, index) => (
                  <div
                    key={acc.id || `acc-${index}`}
                    className={`rounded-3xl p-6 border transition-all relative overflow-hidden flex flex-col justify-between min-h-[200px] ${
                      acc.is_default
                        ? 'bg-gradient-to-br from-[#18233c]/80 via-black/90 to-[#0b0c10] border-[#d4af37] shadow-[0_0_35px_rgba(212,175,55,0.25)]'
                        : 'bg-black/60 border-yellow-600/20 hover:border-yellow-600/50'
                    }`}
                  >
                    {/* Decorative Card Chip / Top Row */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-[#d4af37] to-[#f5d77f] flex items-center justify-center shadow-inner shrink-0 border border-black/40">
                            <div className="w-6 h-4 border border-black/30 rounded-sm grid grid-cols-2 gap-0.5 opacity-60" />
                          </div>
                          <span className="text-xs font-bold uppercase tracking-widest text-zinc-300 truncate font-sans">
                            {acc.bank_name}
                          </span>
                        </div>

                        {acc.is_default && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold uppercase px-2.5 py-1 rounded-full bg-[#d4af37] text-black shadow-md shrink-0">
                            <Star className="w-3 h-3 fill-black text-black" />
                            <span>PRIMARY DEFAULT</span>
                          </span>
                        )}
                      </div>

                      {/* Account Number in Prominent Card Typography */}
                      <div className="space-y-1 my-4">
                        <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                          ACCOUNT NUMBER / VIRTUAL ACCOUNT
                        </div>
                        <div className="text-lg sm:text-xl font-mono font-extrabold tracking-wider text-[#f5d77f] drop-shadow-[0_2px_10px_rgba(212,175,55,0.3)]">
                          {acc.account_number}
                        </div>
                      </div>
                    </div>

                    {/* Holder & Footer Actions */}
                    <div className="pt-4 border-t border-yellow-600/20 flex items-center justify-between gap-3 mt-4">
                      <div className="min-w-0">
                        <div className="text-[9px] font-mono text-zinc-500 uppercase">
                          ACCOUNT HOLDER
                        </div>
                        <div className="text-xs font-bold text-white uppercase tracking-wider truncate font-sans">
                          {acc.account_name}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!acc.is_default && (
                          <button
                            type="button"
                            onClick={() => handleSetDefaultBank(index)}
                            disabled={bankingPending}
                            className="px-3 py-1.5 rounded-xl border border-yellow-600/30 bg-black/60 hover:border-[#d4af37] text-[10px] font-mono font-bold uppercase text-zinc-300 hover:text-[#f5d77f] transition-all"
                          >
                            SET DEFAULT
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteBank(acc.id, index)}
                          disabled={bankingPending}
                          title="Remove Bank Account"
                          className="p-2 rounded-xl border border-yellow-600/20 bg-black/40 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: PRODUCT CATALOG (Progressive Disclosure & Minimalist Table) */}
      {/* ========================================================================= */}
      {activeTab === 'catalog' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          <div className="bg-white/5 backdrop-blur-md border border-yellow-600/30 rounded-3xl p-6 sm:p-8 space-y-6 shadow-[0_0_40px_rgba(0,0,0,0.5)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-yellow-600/20 pb-5">
              <div>
                <h2 className="text-sm font-extrabold uppercase tracking-wider text-white font-serif">
                  DELIVERABLE CATALOG SERVICES ({catalogItems.length})
                </h2>
                <p className="text-xs text-zinc-400 font-sans mt-1">
                  Standard billable items and baseline IDR pricing for instant line-item selection on invoices.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAddProductModal(!showAddProductModal);
                  setCatalogMsg(null);
                }}
                className="gold-btn inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_25px_rgba(212,175,55,0.35)] shrink-0 transition-transform hover:scale-105"
              >
                <Plus className="w-4 h-4 text-black" />
                <span>{showAddProductModal ? 'CLOSE FORM' : '+ ADD PRODUCT OR SERVICE'}</span>
              </button>
            </div>

            {catalogMsg && (
              <div
                className={`flex items-center gap-3 p-4 rounded-2xl text-xs font-mono border ${
                  catalogMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-950/60 border-red-700 text-red-200'
                }`}
              >
                {catalogMsg.type === 'success' ? (
                  <Check className="w-4 h-4 shrink-0 text-emerald-400" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                )}
                <span>{catalogMsg.text}</span>
              </div>
            )}

            {/* PROGRESSIVE DISCLOSURE: Add Product Modal / Accordion */}
            {showAddProductModal && (
              <form
                onSubmit={handleCreateProduct}
                className="p-6 rounded-3xl bg-black/80 border border-[#d4af37]/60 space-y-5 animate-in fade-in zoom-in-95 duration-200 shadow-[0_0_35px_rgba(212,175,55,0.2)]"
              >
                <div className="flex items-center justify-between border-b border-yellow-600/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#f5d77f] font-mono">
                    <Package className="w-4 h-4" />
                    <span>ADD SERVICE TO TENANT CATALOG</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400 uppercase">
                    INSTANT CATALOG SYNC
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                      SERVICE / DELIVERABLE NAME *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. TikTok Live Studio Retainer"
                      value={newProdName}
                      onChange={(e) => setNewProdName(e.target.value)}
                      autoFocus
                      className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-[#d4af37] font-sans"
                    />
                  </div>

                  <div className="md:col-span-6">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                      DELIVERABLE DESCRIPTION (BULLET POINTS)
                    </label>
                    <BulletTextarea
                      rows={3}
                      placeholder="Automatic bullet points..."
                      value={newProdDesc}
                      onChange={(val) => setNewProdDesc(val)}
                      className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs text-zinc-300 focus:outline-none focus:border-[#d4af37] font-sans whitespace-pre-line"
                    />
                  </div>

                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                      UNIT PRICE (IDR / RP) *
                    </label>
                    <RupiahInput
                      required
                      placeholder="Rp 0"
                      value={newProdPrice}
                      onChange={(e) => setNewProdPrice(e.target.value)}
                      className="w-full bg-black border border-yellow-600/30 rounded-xl px-3.5 py-2.5 text-xs font-mono text-[#f5d77f] focus:outline-none focus:border-[#d4af37]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddProductModal(false);
                      setNewProdName('');
                      setNewProdDesc('');
                    }}
                    className="px-5 py-2.5 rounded-xl border border-zinc-800 text-zinc-400 hover:text-white text-xs font-mono uppercase transition-colors"
                  >
                    CANCEL
                  </button>
                  <button
                    type="submit"
                    disabled={catalogPending || !newProdName.trim()}
                    className="gold-btn inline-flex items-center justify-center gap-2 px-8 py-2.5 rounded-full text-xs font-extrabold uppercase tracking-wider shadow-[0_0_20px_rgba(212,175,55,0.4)] disabled:opacity-50"
                  >
                    {catalogPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                    ) : (
                      <Plus className="w-4 h-4 text-black" />
                    )}
                    <span>ADD TO CATALOG</span>
                  </button>
                </div>
              </form>
            )}

            {/* Minimalist Data Table */}
            {catalogItems.length === 0 ? (
              <div className="p-12 rounded-3xl bg-black/40 border border-yellow-600/20 text-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-yellow-600/10 border border-yellow-600/30 flex items-center justify-center mx-auto text-[#f5d77f]">
                  <Package className="w-7 h-7" />
                </div>
                <h3 className="text-sm font-extrabold uppercase text-white font-serif">
                  NO CATALOG SERVICES LISTED
                </h3>
                <p className="text-xs text-zinc-400 font-sans max-w-md mx-auto">
                  Click the "+ Add Product Or Service" button to register billable items for rapid invoice generation.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-yellow-600/20 bg-black/40">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-yellow-600/20 bg-black/60 text-[11px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      <th className="py-4 px-6">SERVICE NAME & DESCRIPTION</th>
                      <th className="py-4 px-6 text-right">UNIT PRICE (IDR)</th>
                      <th className="py-4 px-6 text-right w-24">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-yellow-600/10 text-xs">
                    {catalogItems.map((item) =>
                      editingProductId === item.id ? (
                        <tr key={item.id} className="bg-white/5 border-y border-[#d4af37]/40 transition-all">
                          <td className="py-4 px-6 min-w-[280px]">
                            <div className="space-y-3 py-1">
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-1 font-mono">
                                  SERVICE / DELIVERABLE NAME *
                                </label>
                                <input
                                  type="text"
                                  value={editProdName}
                                  onChange={(e) => setEditProdName(e.target.value)}
                                  autoFocus
                                  className="w-full bg-black border border-yellow-600/40 rounded-xl px-3 py-2 text-xs text-white font-sans focus:outline-none focus:border-[#d4af37]"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-1 font-mono">
                                  DELIVERABLE DESCRIPTION (BULLET POINTS)
                                </label>
                                <BulletTextarea
                                  rows={3}
                                  value={editProdDesc}
                                  onChange={(val) => setEditProdDesc(val)}
                                  className="w-full bg-black border border-yellow-600/40 rounded-xl px-3 py-2 text-xs text-zinc-300 font-sans focus:outline-none focus:border-[#d4af37] whitespace-pre-line"
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right align-top">
                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-300 mb-1 font-mono text-right">
                                UNIT PRICE (IDR / RP) *
                              </label>
                              <RupiahInput
                                value={editProdPrice}
                                onChange={(e) => setEditProdPrice(e.target.value)}
                                className="w-44 bg-black border border-yellow-600/40 rounded-xl px-3 py-2 text-xs font-mono text-[#f5d77f] text-right focus:outline-none focus:border-[#d4af37] ml-auto"
                              />
                            </div>
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap align-top">
                            <div className="flex items-center justify-end gap-2 mt-5">
                              <button
                                type="button"
                                onClick={() => handleUpdateProduct(item.id)}
                                disabled={catalogPending || !editProdName.trim()}
                                title="Save Changes"
                                className="p-2 rounded-xl border border-green-500/40 bg-green-500/15 text-green-400 hover:bg-green-500/25 hover:border-green-400 transition-all shadow-[0_0_12px_rgba(34,197,94,0.2)]"
                              >
                                {catalogPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingProductId(null)}
                                disabled={catalogPending}
                                title="Cancel Edit"
                                className="p-2 rounded-xl border border-zinc-700 bg-black/40 text-zinc-400 hover:text-white hover:border-zinc-500 transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        <tr
                          key={item.id}
                          className="hover:bg-white/5 transition-colors group"
                        >
                          <td className="py-4 px-6 min-w-[280px]">
                            <div className="font-bold text-sm text-white font-sans group-hover:text-[#f5d77f] transition-colors">
                              {item.name}
                            </div>
                            <DescriptionBullets
                              description={item.description}
                              allBullets={true}
                              isDark={true}
                              className="mt-1.5 max-w-xl"
                            />
                          </td>
                          <td className="py-4 px-6 text-right font-mono font-bold text-sm text-[#f5d77f] whitespace-nowrap">
                            Rp {Number(item.unit_price || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-4 px-6 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleDuplicateProduct(item.id)}
                                disabled={catalogPending}
                                title="Duplicate Product"
                                className="p-2 rounded-xl border border-yellow-600/20 bg-black/40 text-zinc-400 hover:text-[#f5d77f] hover:border-[#f5d77f]/40 transition-all"
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingProductId(item.id);
                                  setEditProdName(item.name);
                                  setEditProdDesc(item.description || '');
                                  setEditProdPrice(String(item.unit_price || 0));
                                }}
                                disabled={catalogPending}
                                title="Edit Product"
                                className="p-2 rounded-xl border border-yellow-600/20 bg-black/40 text-zinc-400 hover:text-[#f5d77f] hover:border-[#f5d77f]/40 transition-all"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(item.id)}
                                disabled={catalogPending}
                                title="Remove Product"
                                className="p-2 rounded-xl border border-yellow-600/20 bg-black/40 text-zinc-400 hover:text-red-400 hover:border-red-500/40 transition-all"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
