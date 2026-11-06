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
  UploadCloud,
  BookOpen,
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
import { Users } from 'lucide-react';

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
  bankAccounts?: BankAccountItem[];
  products?: CatalogProduct[];
  isCurrentActive?: boolean;
  clients?: { id: string; name: string }[];
  staff?: { user_id: string; role: string; profiles: any }[];
  assignments?: { client_id: string; user_id: string }[];
  currentUserRole?: string;
  currentUserId?: string;
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
  bankAccounts: initialBankAccounts = [],
  products: initialProducts = [],
  isCurrentActive,
  clients,
  staff,
  assignments,
  currentUserRole,
  currentUserId,
}: WorkspaceDetailTabsProps) {
  const router = useRouter();

  // Navigation State (ordered: Product List -> Bank Account -> Tax)
  const [activeTab, setActiveTab] = useState<'catalog' | 'banking' | 'identity' | 'opening-balances' | 'users'>('identity');

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
  const [editingBankId, setEditingBankId] = useState<string | null>(null);
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
  const [newProdQuantity, setNewProdQuantity] = useState('1');
  const [newProdScale, setNewProdScale] = useState('pc');
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [editProdName, setEditProdName] = useState('');
  const [editProdDesc, setEditProdDesc] = useState('');
  const [editProdPrice, setEditProdPrice] = useState('0');
  const [editProdQuantity, setEditProdQuantity] = useState('1');
  const [editProdScale, setEditProdScale] = useState('pc');
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
        brandTagline: tagline,
        tagline,
        contactPhone: phone,
        phone,
        officialEmail: email,
        email,
        websiteUrl: website,
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

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (!result) return;

      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxDim = 400; // 400px maximum dimension preserves crisp quality while keeping data footprint light
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/png');
          setLogoUrl(dataUrl);
        } else {
          setLogoUrl(result);
        }
      };
      img.onerror = () => {
        setLogoUrl(result);
      };
      img.src = result;
    };
    reader.readAsDataURL(file);
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

    let updated = [...accounts];

    if (editingBankId) {
      updated = updated.map((acc) => {
        if (acc.id === editingBankId) {
          return {
            ...acc,
            bank_name: newBankName.trim(),
            account_number: newAccountNumber.trim(),
            account_name: newAccountName.trim(),
          };
        }
        return acc;
      });
      syncBankAccountsToServer(updated, `Updated "${newBankName.trim()}" successfully.`);
    } else {
      const isFirst = accounts.length === 0;
      const newItem: BankAccountItem = {
        id: `temp-${Date.now()}`,
        bank_name: newBankName.trim(),
        account_number: newAccountNumber.trim(),
        account_name: newAccountName.trim(),
        is_default: isFirst,
      };
      updated = [newItem, ...updated];
      syncBankAccountsToServer(updated, `Registered "${newItem.bank_name}" successfully.`);
    }

    setShowAddBankModal(false);
    setEditingBankId(null);
    setNewBankName('');
    setNewAccountNumber('');
    setNewAccountName('');
  };

  const handleEditBank = (acc: BankAccountItem) => {
    setEditingBankId(acc.id || null);
    setNewBankName(acc.bank_name);
    setNewAccountNumber(acc.account_number);
    setNewAccountName(acc.account_name);
    setShowAddBankModal(true);
    setBankingMsg(null);
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
        quantity: Number(newProdQuantity) || 1,
        scale: newProdScale || 'pc',
      });

      if (res.success) {
        setCatalogItems((prev) => [
          {
            id: `temp-${Date.now()}`,
            name: newProdName.trim(),
            description: newProdDesc.trim() || undefined,
            unit_price: Number(newProdPrice) || 0,
            quantity: Number(newProdQuantity) || 1,
            scale: newProdScale || 'pc',
          },
          ...prev,
        ]);
        setCatalogMsg({ type: 'success', text: `Added "${newProdName}" to deliverable catalog.` });
        setShowAddProductModal(false);
        setNewProdName('');
        setNewProdDesc('');
        setNewProdPrice('1000000');
        setNewProdQuantity('1');
        setNewProdScale('pc');
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
        quantity: Number(editProdQuantity) || 1,
        scale: editProdScale || 'pc',
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
                  quantity: Number(editProdQuantity) || 1,
                  scale: editProdScale || 'pc',
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
      <div className="border-b border-yellow-600/30 pb-5">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#18233c] to-[#0b0c10] border border-[#d4af37] flex items-center justify-center font-extrabold text-[#f5d77f] text-xl shrink-0">
            {name.substring(0, 2).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-white font-serif tracking-wide">Company Settings</h1>
            <p className="text-xs text-zinc-400 mt-1">The identity of this company: its name, logo and contacts (printed on invoices and quotations) and its PPN.</p>
          </div>
        </div>
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
                  These details auto-fill onto PDF Invoices, Quotations, and client pitches generated from this company.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-300 mb-1.5 font-mono">
                    BRAND LOGO (BROWSE & UPLOAD FROM YOUR PC OR ENTER URL)
                  </label>
                  <div className="flex flex-col sm:flex-row items-center gap-4 p-4 rounded-xl bg-black/70 border border-yellow-600/30">
                    {/* Logo Preview box */}
                    <div className="w-20 h-20 rounded-xl bg-zinc-900 border border-yellow-600/40 flex items-center justify-center shrink-0 overflow-hidden relative group shadow-md">
                      {logoUrl ? (
                        <img src={logoUrl} alt="Logo preview" className="w-full h-full object-contain p-1.5" />
                      ) : (
                        <UploadCloud className="w-7 h-7 text-zinc-600" />
                      )}
                    </div>

                    <div className="flex-1 w-full space-y-3">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <label className="gold-btn inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider cursor-pointer shadow-[0_0_15px_rgba(212,175,55,0.3)] hover:scale-105 transition-transform">
                          <UploadCloud className="w-4 h-4 text-black" />
                          <span>BROWSE PC / UPLOAD LOGO</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleLogoUpload}
                            disabled={identityPending}
                            className="hidden"
                          />
                        </label>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={() => setLogoUrl('')}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-red-500/15 border border-red-500/40 text-red-400 hover:bg-red-500/25 text-xs font-mono font-bold transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> REMOVE LOGO
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Or enter direct image URL / path (e.g. /logo.png or https://...)"
                        value={logoUrl}
                        onChange={(e) => setLogoUrl(e.target.value)}
                        disabled={identityPending}
                        className="w-full bg-black/90 border border-yellow-600/20 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono focus:outline-none focus:border-[#d4af37] transition-all"
                      />
                    </div>
                  </div>
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

    </div>
  );
}
