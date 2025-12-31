-- CreateTable
CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "quote_number" TEXT NOT NULL,
    "quote_date" TIMESTAMP(3) NOT NULL,
    "daily_seq" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "email" TEXT NOT NULL,
    "company" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "subtotal_ex_vat" DECIMAL(18,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteLine" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unit_price_ex_vat" DECIMAL(18,2) NOT NULL,
    "line_total_ex_vat" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "QuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quote_number_key" ON "Quote"("quote_number");

-- CreateIndex
CREATE UNIQUE INDEX "Quote_quote_date_daily_seq_key" ON "Quote"("quote_date", "daily_seq");

-- AddForeignKey
ALTER TABLE "QuoteLine" ADD CONSTRAINT "QuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
