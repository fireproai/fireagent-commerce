-- CreateEnum
CREATE TYPE "QuoteStatus" AS ENUM ('draft', 'issued', 'cancelled', 'expired');

-- AlterTable
ALTER TABLE "Quote" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Quote" ALTER COLUMN "status" TYPE "QuoteStatus" USING ("status"::text::"QuoteStatus");
ALTER TABLE "Quote" ALTER COLUMN "status" SET DEFAULT 'draft';
ALTER TABLE "Quote" ALTER COLUMN "status" SET NOT NULL;
ALTER TABLE "Quote" ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
