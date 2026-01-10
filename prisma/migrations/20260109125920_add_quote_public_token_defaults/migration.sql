-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "publicTokenExpiresAt" SET DEFAULT now() + interval '14 days';
