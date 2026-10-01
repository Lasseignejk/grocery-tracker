import type { Tables } from './database.types';

export type Receipt = Tables<'receipts'>;
export type ReceiptItem = Tables<'receipt_items'>;
export type ItemMergeRule = Tables<'item_merge_rules'>;
