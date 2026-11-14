export type ProductAction = 'increase_stock' | 'decrease_stock' | 'set_stock' | 'update_price';
export type AssistantProduct = { id: string; name: string; barcode: string; stock: number; unit: string; sellPrice?: number | string };
export type StockChange = { id: string; productId: string; productName: string; unit: string; quantity: number; before: number; after: number; undone?: boolean; field?: 'stock' | 'sellPrice' };
export type AssistantReply = {
  text: string;
  kind: 'message' | 'products' | 'choose_product' | 'stock_changed' | 'stock_undone' | 'report' | 'confirm_action' | 'product_changed' | 'product_undone';
  products?: AssistantProduct[];
  selectionToken?: string;
  selectionEndpoint?: 'choose-action';
  confirmationToken?: string;
  preview?: { productName: string; before: number; after: number; unit: string; field: 'stock' | 'sellPrice' };
  change?: StockChange;
  undoToken?: string;
  report?: { from: string; to: string; revenue: number; profit: number; transactions: number; average: number };
  topProducts?: { name: string; quantity: number; revenue: number }[];
};
