export interface HeaderInfo {
  docNo: string;
  preparedBy: string;
  date: string;
  indentDate: string;
  plantName: string;
}

export interface VendorQuote {
  vendorName: string;
  make: string;
  mrp: number | string;
  discount: number | string;
  netRate: number | string;
  totalAmount: number | string;
  deliveryPeriod: string;
  readyStock: string;
  packingAndForwarding: string;
  freight: string;
  gstStatus: string; // "Inclusive" or "Exclusive"
  extra: string;
}

export interface Item {
  indentNo: string;
  siNo: string;
  description: string;
  uom: string;
  qty: number | string;
  previousPrice: {
    rate: number | string;
    date: string;
  };
  vendorQuotes: VendorQuote[];
}

export interface ComparisonData {
  items: Item[];
  vendors: string[];
}
