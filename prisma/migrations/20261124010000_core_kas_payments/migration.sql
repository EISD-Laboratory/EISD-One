-- CreateTable
CREATE TABLE "core_kas_payments" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 15000,
    "paid_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transaction_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,

    CONSTRAINT "core_kas_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "core_kas_payments_year_month_idx" ON "core_kas_payments"("year", "month");

-- CreateIndex
CREATE UNIQUE INDEX "core_kas_payments_member_id_year_month_key" ON "core_kas_payments"("member_id", "year", "month");

-- AddForeignKey
ALTER TABLE "core_kas_payments" ADD CONSTRAINT "core_kas_payments_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "core_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
