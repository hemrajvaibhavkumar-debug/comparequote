export interface HeaderInfo {
  docNo: string;
  preparedBy: string;
  date: string;
  indentDate: string;
  plantName: string;
  itemApplicationArea?: string;
  installType?: string;
  isRepairable?: string;
  technicalApproval?: string;
  indentApprovedBy?: string;
  primaryNegotiation?: string;
}

export interface InternalComment {
  id: string;
  text: string;
  author: string;
  date: string;
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
  multiplyByWeight?: boolean;
  internal_comments?: InternalComment[];
}

export interface ComparisonRecord {
  id: number;
  doc_no: string;
  created_at: string;
  data: ComparisonData;
  executive?: any;
  plant?: any;
  internal_comments?: InternalComment[];
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
  warranty?: string | number;
  warranty_description?: string;
  manual_notes?: string[];
  payment_milestones?: { percentage: number; description: string }[];
}

export interface VendorMaster {
  name: string;
  address?: string;
  state?: string;
  gstin?: string;
  mobile_no?: string;
  email?: string;
}

export interface SystemRole {
  id: number;
  name: string;
}

export interface POItem {
  sn: number;
  make: string;
  itemName: string;
  qty: number;
  uom: string;
  rate: number;
  discount: number;
  tax: string;
  amount: number;
}

export interface IndentItem {
  sn?: number;
  itemName: string;
  qty: number | string;
  uom: string;
  applicationArea: string;
  orderPlacedBy: string;
  orderPassedBy: string;
  oldMaterialStatus: string;
}

export interface Indent {
  id?: number;
  indent_no: string;
  date: string;
  plant_name?: string;
  department?: string;
  items: IndentItem[];
  total_items: number;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  created_by_name?: string;
  order_placed_by?: string;
  order_passed_by?: string;
  rejection_remarks?: string;
  approved_by?: string;
  approved_at?: string;
  internal_comments?: InternalComment[];
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrder {
  id?: number;
  po_no: string;
  date: string;
  quote_date?: string;
  quote_doc_no?: string;
  quote_ref_type?: 'MAIL' | 'WHATSAPP' | string;
  vendor_name: string;
  version?: 'hemraj_ind' | 'hemraj_rice' | 'radhashyam';
  vendor_details: {
    address: string;
    gstin: string;
    mail: string;
    ph: string;
    state?: string;
    cc?: string;
  };
  items: POItem[];
  terms: {
    tax: string;
    packing: string;
    payment: string;
    payment_milestones?: { percentage: number; description: string }[];
    freight: string;
    freight_amount?: number;
    freight_tax?: string; // e.g. "GST @18%", "GST @5%", "Nil"
    warranty?: string | number;
    warranty_description?: string;
    warranties?: { years: string | number; description: string }[];
    igst?: string;
    delivery: string;
    contact_no?: string;
    notes?: string;
    manual_notes?: string[];
    po_type?: 'Capital' | 'Consumables' | string;
  };
  total_amount: number;
  created_by_name?: string;
  status?: 'PENDING' | 'PENDING_L2' | 'APPROVED' | 'REJECTED' | string;
  rejection_remarks?: string;
  l1_approved_by?: string;
  l1_approved_at?: string;
  approved_by?: string;
  approved_at?: string;
  pdf_base64?: string;
  internal_comments?: InternalComment[];
}
