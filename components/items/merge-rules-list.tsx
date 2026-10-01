'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getErrorMessage } from '@/lib/errors';
import { capitalizeWords } from '@/lib/items';
import type { ItemMergeRule } from '@/lib/types';

interface MergeRulesListProps {
  rules: ItemMergeRule[];
}

function describeMatch(rule: ItemMergeRule): string {
  return [rule.match_brand, rule.match_generic_name, rule.match_variant]
    .filter(Boolean)
    .map(capitalizeWords)
    .join(' · ');
}

export default function MergeRulesList({ rules }: MergeRulesListProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async (rule: ItemMergeRule) => {
    setDeletingId(rule.id);
    setError(null);
    try {
      const { error: deleteError } = await createClient()
        .from('item_merge_rules')
        .delete()
        .eq('id', rule.id);
      if (deleteError) throw deleteError;
      router.refresh();
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Could not delete the rule'));
    } finally {
      setDeletingId(null);
    }
  };

  if (rules.length === 0) {
    return (
      <div className="rounded-lg bg-white p-8 text-center shadow">
        <h3 className="mb-2 text-lg font-semibold">No merge rules yet</h3>
        <p className="text-gray-600">
          When you merge or edit items, the app remembers it here and renames
          matching items on future receipts.
        </p>
      </div>
    );
  }

  const sections = [
    {
      title: 'Printed receipt lines',
      help: 'Checked first. A receipt line printed exactly like this is renamed.',
      rules: rules.filter((r) => r.match_type === 'receipt_text'),
    },
    {
      title: 'Item names',
      help: 'Used when no printed line matches. An item the AI names like this is renamed.',
      rules: rules.filter((r) => r.match_type === 'product'),
    },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-gray-600">
        Deleting a rule only affects future receipts. Items already renamed
        stay as they are.
      </p>
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {sections.map(
        (section) =>
          section.rules.length > 0 && (
            <div key={section.title} className="rounded-lg bg-white shadow">
              <div className="border-b px-4 py-3">
                <h3 className="font-semibold">{section.title}</h3>
                <p className="text-xs text-gray-500">{section.help}</p>
              </div>
              <ul className="divide-y">
                {section.rules.map((rule) => (
                  <li
                    key={rule.id}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm"
                  >
                    <span
                      className={
                        rule.match_type === 'receipt_text'
                          ? 'font-mono text-xs text-gray-700'
                          : 'text-gray-700'
                      }
                    >
                      {rule.match_type === 'receipt_text'
                        ? rule.match_receipt_text
                        : describeMatch(rule)}
                    </span>
                    <span className="text-gray-400" aria-hidden>
                      →
                    </span>
                    <span className="min-w-0 flex-1 font-medium">
                      {rule.target_item_name}
                    </span>
                    <button
                      onClick={() => handleDelete(rule)}
                      disabled={deletingId === rule.id}
                      className="rounded px-2 py-1 text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === rule.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
      )}
    </div>
  );
}
