'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

interface LinkItemsDialogProps {
  itemId: string;
  itemName: string;
  brand?: string | null;
  genericName?: string | null;
  onClose: () => void;
}

export default function LinkItemsDialog({
  itemId,
  itemName,
  brand,
  genericName,
  onClose,
}: LinkItemsDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [similarItems, setSimilarItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [createNew, setCreateNew] = useState(false);
  const [canonicalName, setCanonicalName] = useState('');
  const router = useRouter();
  const supabase = createClient();

  // Search for similar items
  useEffect(() => {
    async function searchItems() {
      if (!searchQuery.trim() && !brand && !genericName) return;

      setLoading(true);
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Search by brand, generic name, or item name
        let query = supabase
          .from('receipt_items')
          .select('*, receipts!inner(user_id, store_name)')
          .eq('receipts.user_id', user.id)
          .neq('id', itemId); // Exclude current item

        // If searching, filter by search query
        if (searchQuery.trim()) {
          query = query.or(
            `item_name.ilike.%${searchQuery}%,brand.ilike.%${searchQuery}%,generic_name.ilike.%${searchQuery}%`
          );
        } else if (brand) {
          // If not searching but has brand, show items with same brand
          query = query.eq('brand', brand.toLowerCase());
        } else if (genericName) {
          // Or same generic name
          query = query.eq('generic_name', genericName.toLowerCase());
        }

        const { data, error } = await query.limit(10);

        if (!error && data) {
          // Group by product_id if it exists
          const grouped = data.reduce((acc, item) => {
            const key = item.product_id || item.id;
            if (!acc[key]) {
              acc[key] = {
                product_id: item.product_id,
                items: [],
                count: 0,
              };
            }
            acc[key].items.push(item);
            acc[key].count++;
            return acc;
          }, {} as any);

          setSimilarItems(Object.values(grouped));
        }
      } catch (error) {
        console.error('Error searching items:', error);
      } finally {
        setLoading(false);
      }
    }

    const debounce = setTimeout(searchItems, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, brand, genericName, itemId, supabase]);

  const handleLinkToExisting = async (targetProductId: string) => {
    setLinking(true);
    try {
      const { error } = await supabase
        .from('receipt_items')
        .update({ product_id: targetProductId })
        .eq('id', itemId);

      if (error) throw error;

      router.refresh();
      onClose();
    } catch (error: any) {
      alert('Error linking items: ' + error.message);
    } finally {
      setLinking(false);
    }
  };

  const handleCreateNewProduct = async () => {
    if (!canonicalName.trim()) {
      alert('Please enter a product name');
      return;
    }

    setLinking(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create new product
      const { data: product, error: productError } = await supabase
        .from('products')
        .insert({
          user_id: user.id,
          canonical_name: canonicalName,
          brand: brand || null,
          generic_name: genericName || null,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Link current item to new product
      const { error: linkError } = await supabase
        .from('receipt_items')
        .update({ product_id: product.id })
        .eq('id', itemId);

      if (linkError) throw linkError;

      router.refresh();
      onClose();
    } catch (error: any) {
      alert('Error creating product: ' + error.message);
    } finally {
      setLinking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold">Link Item</h2>
              <p className="text-sm text-gray-600 mt-1">
                Current item: <span className="font-medium">{itemName}</span>
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search for similar items
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by item name, brand, or type..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Similar Items */}
          {loading ? (
            <div className="text-center py-8 text-gray-500">Searching...</div>
          ) : similarItems.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-2">
                Similar items found:
              </h3>
              <div className="space-y-2">
                {similarItems.map((group: any) => (
                  <div
                    key={group.product_id || group.items[0].id}
                    className="border rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {group.items[0].item_name}
                        </p>
                        {group.items[0].brand && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded mr-1">
                            {group.items[0].brand}
                          </span>
                        )}
                        {group.items[0].generic_name && (
                          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">
                            {group.items[0].generic_name}
                          </span>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          Found {group.count} time{group.count > 1 ? 's' : ''}{' '}
                          across receipts
                        </p>
                        {group.product_id && (
                          <p className="text-xs text-green-600 mt-1">
                            ✓ Already linked as a product
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          handleLinkToExisting(
                            group.product_id || group.items[0].id
                          )
                        }
                        disabled={linking}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 disabled:bg-gray-400"
                      >
                        Link Here
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : searchQuery || brand || genericName ? (
            <div className="text-center py-8 text-gray-500">
              No similar items found
            </div>
          ) : null}

          {/* Create New Product */}
          <div className="border-t pt-4">
            <button
              onClick={() => setCreateNew(!createNew)}
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              {createNew ? '− Cancel' : '+ Create New Product Link'}
            </button>

            {createNew && (
              <div className="mt-4 space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name (Canonical)
                  </label>
                  <input
                    type="text"
                    value={canonicalName}
                    onChange={(e) => setCanonicalName(e.target.value)}
                    placeholder="e.g., Kraft Singles American Cheese 16ct"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will be the standard name used for grouping
                  </p>
                </div>
                <button
                  onClick={handleCreateNewProduct}
                  disabled={linking || !canonicalName.trim()}
                  className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                >
                  {linking ? 'Creating...' : 'Create & Link'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
