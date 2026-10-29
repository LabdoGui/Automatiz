-- AlterTable
ALTER TABLE "food" ADD COLUMN     "catalogKey" TEXT;

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "catalogKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "food_catalogKey_key" ON "food"("catalogKey");

-- CreateIndex
CREATE UNIQUE INDEX "product_catalogKey_key" ON "product"("catalogKey");
