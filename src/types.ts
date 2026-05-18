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
  gstStatus: string; // "Inclusive", "Exclusive", "18% Extra", or "5% Extra"
  extra: string;
  quoteDate?: string;
}

export interface Item {
  indentNo: string;
  siNo: string;
  description: string;
  uom: string;
  qty: number | string;
  weight?: number | string;
  previousPrice: {
    rate: number | string;
    date: string;
    vendor?: string;
  };
  vendorQuotes: VendorQuote[];
}

export interface ComparisonData {
  items: Item[];
  vendors: string[];
}

export interface CompanySettings {
  id: number;
  name: string;
  logo?: string;
  cin?: string;
  gstin?: string;
  pan?: string;
  address?: string;
  email?: string;
  phone?: string;
  website?: string;
  factory_address?: string;
  regd_office?: string;
}

export interface TermsTemplate {
  id: number;
  name: string;
  tax?: string;
  packing?: string;
  payment?: string;
  freight?: string;
  delivery?: string;
  contact_no?: string;
  notes?: string;
}

export interface VendorMaster {
  id: number;
  name: string;
  address?: string;
  state?: string;
  gstin?: string;
  mobile_no?: string;
}

export interface POItem {
  sn: number;
  itemName: string;
  qty: number;
  uom: string;
  rate: number;
  discount: number;
  tax: string;
}

export interface PurchaseOrder {
  id?: number;
  po_no: string;
  date: string;
  vendor_name: string;
  version?: 'hemraj_ind' | 'hemraj_rice' | 'radhashyam';
  vendor_details: {
    address: string;
    gstin: string;
    mail: string;
    ph: string;
    state?: string;
  };
  items: POItem[];
  terms: {
    tax: string;
    packing: string;
    payment: string;
    freight: string;
    delivery: string;
    contact_no?: string;
    notes?: string;
  };
  total_amount: number;
}
