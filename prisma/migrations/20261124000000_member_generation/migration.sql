-- Menambahkan kolom generasi lab (contoh: v6, v7) pada core_members
ALTER TABLE "core_members" ADD COLUMN "generation" VARCHAR(20);
CREATE INDEX "core_members_generation_idx" ON "core_members"("generation");
