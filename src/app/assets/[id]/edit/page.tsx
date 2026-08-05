import React from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthenticatedWorkspaceContext } from '@/lib/auth/workspace-context';
import { ArrowLeft, Box } from 'lucide-react';
import { EditAssetForm } from '@/components/assets/EditAssetForm';

export const dynamic = 'force-dynamic';

export default async function EditAssetPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();
  const { activeWorkspaceId } = await getAuthenticatedWorkspaceContext(supabase);

  const { data: assetRecord } = await supabase
    .from('fixed_assets')
    .select('*')
    .eq('id', params.id)
    .eq('workspace_id', activeWorkspaceId)
    .single();

  if (!assetRecord) {
    notFound();
  }

  return (
    <div className="max-w-[800px] mx-auto px-6 py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex items-center justify-between pb-4 border-b border-[#d4af37]/20">
        <div className="flex items-center gap-3">
          <Link
            href="/assets"
            className="w-9 h-9 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white hover:border-[#d4af37]/40 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-extrabold tracking-wider uppercase text-white flex items-center gap-2">
              <Box className="w-5 h-5 text-[#d4af37]" />
              <span>EDIT FIXED ASSET DEPRECIATION SCHEDULE</span>
            </h1>
            <p className="text-xs text-[#d4af37] font-mono">
              MODIFY USEFUL LIFE & SALVAGE VALUE
            </p>
          </div>
        </div>
      </div>

      <div className="pt-4">
        <EditAssetForm initialData={assetRecord} />
      </div>
    </div>
  );
}
