import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Suggestions {
  brands: string[];
  genericNames: string[];
  variants: string[];
}

export function useItemSuggestions() {
  const [suggestions, setSuggestions] = useState<Suggestions>({
    brands: [],
    genericNames: [],
    variants: [],
  });
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        // Get user
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        // Get all items for this user
        const { data: items } = await supabase
          .from('receipt_items')
          .select('brand, generic_name, variant, receipts!inner(user_id)')
          .eq('receipts.user_id', user.id);

        if (items) {
          // Extract unique values
          const brands = new Set<string>();
          const genericNames = new Set<string>();
          const variants = new Set<string>();

          items.forEach((item) => {
            if (item.brand) brands.add(item.brand);
            if (item.generic_name) genericNames.add(item.generic_name);
            if (item.variant) variants.add(item.variant);
          });

          setSuggestions({
            brands: Array.from(brands).sort(),
            genericNames: Array.from(genericNames).sort(),
            variants: Array.from(variants).sort(),
          });
        }
      } catch (error) {
        console.error('Error fetching suggestions:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, []);

  return { suggestions, loading };
}
