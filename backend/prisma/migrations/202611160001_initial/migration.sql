-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "erp";

-- CreateTable
CREATE TABLE "erp"."User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Company" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'UTC',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "orderSequence" INTEGER NOT NULL DEFAULT 0,
    "invoiceSequence" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Membership" (
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("companyId","userId")
);

-- CreateTable
CREATE TABLE "erp"."Customer" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Product" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "reorder" INTEGER NOT NULL DEFAULT 0,
    "price" DECIMAL(14,2) NOT NULL,
    "supplier" TEXT NOT NULL,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Order" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Processing',
    "total" DECIMAL(14,2) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."OrderItem" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."InventoryMovement" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "reference" TEXT,
    "actorId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Invoice" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "customerId" UUID NOT NULL,
    "orderId" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issued" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due" DATE NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,
    "voidedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."InvoiceItem" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "total" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "InvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Payment" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reversedAt" TIMESTAMP(3),
    "reversalReason" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."AuditEvent" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."IdempotencyKey" (
    "companyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("companyId","key")
);

-- CreateTable
CREATE TABLE "erp"."WorkspaceState" (
    "companyId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "data" JSONB NOT NULL,

    CONSTRAINT "WorkspaceState_pkey" PRIMARY KEY ("companyId")
);

-- CreateTable
CREATE TABLE "erp"."Conversation" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "messages" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."Job" (
    "id" UUID NOT NULL,
    "companyId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "error" TEXT,
    "result" JSONB,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp"."RateLimit" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Membership_userId_idx" ON "erp"."Membership"("userId");

-- CreateIndex
CREATE INDEX "Customer_companyId_status_createdAt_idx" ON "erp"."Customer"("companyId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_id_key" ON "erp"."Customer"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_companyId_name_key" ON "erp"."Customer"("companyId", "name");

-- CreateIndex
CREATE INDEX "Product_companyId_archived_idx" ON "erp"."Product"("companyId", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_id_key" ON "erp"."Product"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Product_companyId_sku_key" ON "erp"."Product"("companyId", "sku");

-- CreateIndex
CREATE INDEX "Order_companyId_date_idx" ON "erp"."Order"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_id_key" ON "erp"."Order"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Order_companyId_number_key" ON "erp"."Order"("companyId", "number");

-- CreateIndex
CREATE INDEX "OrderItem_companyId_orderId_idx" ON "erp"."OrderItem"("companyId", "orderId");

-- CreateIndex
CREATE INDEX "InventoryMovement_companyId_productId_createdAt_idx" ON "erp"."InventoryMovement"("companyId", "productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_orderId_key" ON "erp"."Invoice"("orderId");

-- CreateIndex
CREATE INDEX "Invoice_companyId_due_idx" ON "erp"."Invoice"("companyId", "due");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_id_key" ON "erp"."Invoice"("companyId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_orderId_key" ON "erp"."Invoice"("companyId", "orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_companyId_number_key" ON "erp"."Invoice"("companyId", "number");

-- CreateIndex
CREATE INDEX "InvoiceItem_companyId_invoiceId_idx" ON "erp"."InvoiceItem"("companyId", "invoiceId");

-- CreateIndex
CREATE INDEX "Payment_companyId_invoiceId_idx" ON "erp"."Payment"("companyId", "invoiceId");

-- CreateIndex
CREATE INDEX "AuditEvent_companyId_createdAt_idx" ON "erp"."AuditEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "Conversation_companyId_userId_updatedAt_idx" ON "erp"."Conversation"("companyId", "userId", "updatedAt");

-- CreateIndex
CREATE INDEX "Job_status_availableAt_idx" ON "erp"."Job"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Job_companyId_key_key" ON "erp"."Job"("companyId", "key");

-- CreateIndex
CREATE INDEX "RateLimit_expiresAt_idx" ON "erp"."RateLimit"("expiresAt");

-- AddForeignKey
ALTER TABLE "erp"."Membership" ADD CONSTRAINT "Membership_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "erp"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "erp"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Customer" ADD CONSTRAINT "Customer_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "erp"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Product" ADD CONSTRAINT "Product_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "erp"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Order" ADD CONSTRAINT "Order_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "erp"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Order" ADD CONSTRAINT "Order_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "erp"."Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."OrderItem" ADD CONSTRAINT "OrderItem_companyId_orderId_fkey" FOREIGN KEY ("companyId", "orderId") REFERENCES "erp"."Order"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."OrderItem" ADD CONSTRAINT "OrderItem_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "erp"."Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."InventoryMovement" ADD CONSTRAINT "InventoryMovement_companyId_productId_fkey" FOREIGN KEY ("companyId", "productId") REFERENCES "erp"."Product"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Invoice" ADD CONSTRAINT "Invoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "erp"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Invoice" ADD CONSTRAINT "Invoice_companyId_customerId_fkey" FOREIGN KEY ("companyId", "customerId") REFERENCES "erp"."Customer"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Invoice" ADD CONSTRAINT "Invoice_companyId_orderId_fkey" FOREIGN KEY ("companyId", "orderId") REFERENCES "erp"."Order"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."InvoiceItem" ADD CONSTRAINT "InvoiceItem_companyId_invoiceId_fkey" FOREIGN KEY ("companyId", "invoiceId") REFERENCES "erp"."Invoice"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."Payment" ADD CONSTRAINT "Payment_companyId_invoiceId_fkey" FOREIGN KEY ("companyId", "invoiceId") REFERENCES "erp"."Invoice"("companyId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "erp"."WorkspaceState" ADD CONSTRAINT "WorkspaceState_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "erp"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Enforce business invariants even outside the application.
ALTER TABLE erp."Membership" ADD CONSTRAINT membership_role CHECK (role IN ('owner','manager','staff'));
ALTER TABLE erp."Company" ADD CONSTRAINT company_currency CHECK (currency = 'USD');
ALTER TABLE erp."Customer" ADD CONSTRAINT customer_status CHECK (status IN ('Active','Inactive'));
ALTER TABLE erp."Product" ADD CONSTRAINT product_nonnegative CHECK (stock >= 0 AND reorder >= 0 AND price >= 0);
ALTER TABLE erp."Order" ADD CONSTRAINT order_valid CHECK (total >= 0 AND status IN ('Processing','Shipped','Delivered','Cancelled'));
ALTER TABLE erp."OrderItem" ADD CONSTRAINT order_item_valid CHECK (quantity > 0 AND "unitPrice" >= 0 AND total = quantity * "unitPrice");
ALTER TABLE erp."InvoiceItem" ADD CONSTRAINT invoice_item_valid CHECK (quantity > 0 AND "unitPrice" >= 0 AND total = quantity * "unitPrice");
ALTER TABLE erp."Invoice" ADD CONSTRAINT invoice_nonnegative CHECK (total >= 0);
ALTER TABLE erp."Payment" ADD CONSTRAINT payment_positive CHECK (amount > 0);
ALTER TABLE erp."InventoryMovement" ADD CONSTRAINT movement_nonzero CHECK (quantity <> 0);
-- The application uses a private schema through a server-only SQL connection.
-- Do not add erp to Supabase Data API exposed schemas.
REVOKE ALL ON SCHEMA erp FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA erp FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON SCHEMA erp FROM anon;
    REVOKE ALL ON ALL TABLES IN SCHEMA erp FROM anon;
  END IF;
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON SCHEMA erp FROM authenticated;
    REVOKE ALL ON ALL TABLES IN SCHEMA erp FROM authenticated;
  END IF;
END $$;
