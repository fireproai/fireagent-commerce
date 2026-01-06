-- AlterTable
ALTER TABLE "Quote"
ADD COLUMN "publicToken" TEXT,
ADD COLUMN "publicTokenExpiresAt" TIMESTAMP(3);

-- Backfill existing rows with a random token and a 14 day expiry
UPDATE "Quote"
SET
  "publicToken" = md5(random()::text || clock_timestamp()::text || coalesce("quote_number", '')),
  "publicTokenExpiresAt" = NOW() + interval '14 days'
WHERE "publicToken" IS NULL OR "publicTokenExpiresAt" IS NULL;

ALTER TABLE "Quote"
ALTER COLUMN "publicToken" SET NOT NULL,
ALTER COLUMN "publicTokenExpiresAt" SET NOT NULL;

CREATE UNIQUE INDEX "Quote_publicToken_key" ON "Quote"("publicToken");
