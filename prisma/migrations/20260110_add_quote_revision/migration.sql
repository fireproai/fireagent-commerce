-- Add revision column to quotes for versioning
ALTER TABLE "Quote" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
