CREATE TABLE "CompanySettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL DEFAULT 'My Company',
    "logo" TEXT,
    "cin" TEXT,
    "gstin" TEXT,
    "pan" TEXT,
    "address" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "website" TEXT,
    "factory_address" TEXT,
    "regd_office" TEXT,
    CONSTRAINT "CompanySettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TermsTemplate" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "tax" TEXT,
    "packing" TEXT,
    "payment" TEXT,
    "freight" TEXT,
    "delivery" TEXT,
    "notes" TEXT,
    CONSTRAINT "TermsTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TermsTemplate_name_key" ON "TermsTemplate"("name");

CREATE TABLE "PurchaseOrder" (
    "id" SERIAL NOT NULL,
    "po_no" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vendor_name" TEXT NOT NULL,
    "vendor_details" JSONB,
    "items" JSONB NOT NULL,
    "terms" JSONB,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PurchaseOrder_po_no_key" ON "PurchaseOrder"("po_no");
