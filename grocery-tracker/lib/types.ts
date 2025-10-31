export interface Receipt {
  id: string;
  user_id: string;
  store_name: string | null;
  purchase_date: string | null;
  total_amount: number | null;
  image_url: string | null;
  raw_text: string | null;
  created_at: string;
}

export interface ReceiptItem {
  id: string;
  receipt_id: string;
  item_name: string;
  receipt_text: string | null;
  quantity: number | null;
  unit_price: number | null;
  total_price: number | null;
  was_on_sale: boolean;
  category: string | null;
  brand: string | null;
  generic_name: string | null;
  variant: string | null;
  created_at: string;
}
