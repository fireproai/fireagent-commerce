-- AlterTable
ALTER TABLE "Quote"
ADD COLUMN "privacy_acknowledged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "privacy_acknowledged_at" TIMESTAMP(3);
