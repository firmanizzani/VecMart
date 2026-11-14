export type AssistantProduct = { id: string; name: string; barcode: string; stock: number; unit: string };
export type StockChange = { id: string; productId: string; productName: string; unit: string; quantity: number; before: number; after: number; undone?: boolean };
export type AssistantReply = {
  text: string;
  kind: 'message' | 'products' | 'choose_product' | 'stock_changed' | 'stock_undone' | 'report';
  products?: AssistantProduct[];
  selectionToken?: string;
  change?: StockChange;
  undoToken?: string;
  report?: { from: string; to: string; revenue: number; profit: number; transactions: number; average: number };
  topProducts?: { name: string; quantity: number; revenue: number }[];
};
