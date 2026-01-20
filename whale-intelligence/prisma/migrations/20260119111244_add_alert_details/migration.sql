/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "alerts" ADD COLUMN     "amount" DECIMAL(65,30),
ADD COLUMN     "price" DECIMAL(65,30),
ADD COLUMN     "side" TEXT,
ADD COLUMN     "tx_count" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
