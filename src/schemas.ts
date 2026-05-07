import { z } from "zod";

export const VendorQuoteSchema = z.object({
  vendorName: z.string(),
  make: z.string().default(""),
  mrp: z.number().default(0),
  discount: z.number().default(0),
  netRate: z.number().default(0),
  totalAmount: z.number().default(0),
  deliveryPeriod: z.string().default(""),
  readyStock: z.string().default(""),
  packingAndForwarding: z.string().default(""),
  freight: z.string().default(""),
  gstStatus: z.string().default("Exclusive"),
  extra: z.string().default(""),
  quoteDate: z.string().optional(),
});

export const PreviousPriceSchema = z.object({
  rate: z.number().default(0),
  date: z.string().default(""),
});

export const ComparisonItemSchema = z.object({
  indentNo: z.string().default(""),
  siNo: z.string().default(""),
  description: z.string().default(""),
  uom: z.string().default(""),
  qty: z.number().default(0),
  weight: z.number().optional(),
  previousPrice: PreviousPriceSchema.optional(),
  vendorQuotes: z.array(VendorQuoteSchema).default([]),
});

export const ComparisonDataSchema = z.object({
  vendors: z.array(z.string()).default([]),
  items: z.array(ComparisonItemSchema).default([]),
});

export const HeaderInfoSchema = z.object({
  docNo: z.string(),
  preparedBy: z.string().default(""),
  date: z.string().default(""),
  indentDate: z.string().default(""),
  plantName: z.string().default(""),
});

export const SaveComparisonSchema = z.object({
  doc_no: z.string(),
  data: z.object({
    header: HeaderInfoSchema,
    data: ComparisonDataSchema,
  }),
});
