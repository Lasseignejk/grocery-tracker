'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MergeDialog, { type FieldSuggestions } from '@/components/items/merge-dialog';
import type { Product } from '@/lib/items';

interface ItemEditButtonProps {
  product: Product;
  otherSizes: Product[];
  suggestions: FieldSuggestions;
}

// Renames the product from its detail page. Renaming changes the product's
// key, so this page's URL no longer exists; go back to the items list.
export default function ItemEditButton({
  product,
  otherSizes,
  suggestions,
}: ItemEditButtonProps) {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg border px-3 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50"
      >
        Edit
      </button>
      {open && (
        <MergeDialog
          products={[product]}
          otherSizes={otherSizes}
          suggestions={suggestions}
          onClose={() => setOpen(false)}
          onMerged={() => router.push('/items')}
        />
      )}
    </>
  );
}
