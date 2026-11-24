-- AlterTable
ALTER TABLE "core_records" ADD COLUMN     "letter_data_json" JSONB,
ADD COLUMN     "sequence_no" INTEGER,
ADD COLUMN     "sequence_year" INTEGER,
ADD COLUMN     "template_code" VARCHAR(30);

-- CreateIndex
CREATE INDEX "core_records_sequence_year_sequence_no_idx" ON "core_records"("sequence_year", "sequence_no");
