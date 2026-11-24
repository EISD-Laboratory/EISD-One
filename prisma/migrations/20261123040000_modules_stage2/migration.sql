-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE');
CREATE TYPE "AssetCondition" AS ENUM ('GOOD', 'FAIR', 'DAMAGED');
CREATE TYPE "CoreRecordType" AS ENUM ('MEETING', 'LETTER');
CREATE TYPE "EventStatus" AS ENUM ('IDEA', 'PROPOSAL', 'APPROVED', 'ONGOING', 'COMPLETED');
CREATE TYPE "EventParticipantRole" AS ENUM ('COMMITTEE', 'ATTENDEE');
CREATE TYPE "PraktikumRecordType" AS ENUM ('ATTENDANCE', 'GRADE');
CREATE TYPE "PartnerStage" AS ENUM ('PROSPECT', 'APPROACH', 'NEGOTIATION', 'DEAL', 'ACTIVE', 'COMPLETED');

CREATE TABLE "core_transactions" (
    "id" UUID NOT NULL,
    "type" "TransactionType" NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "transaction_date" DATE NOT NULL,
    "source_module" VARCHAR(60),
    "source_entity_id" VARCHAR(120),
    "status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_transactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_assets" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "category" VARCHAR(80) NOT NULL,
    "condition" "AssetCondition" NOT NULL DEFAULT 'GOOD',
    "location" VARCHAR(160),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_records" (
    "id" UUID NOT NULL,
    "record_type" "CoreRecordType" NOT NULL,
    "reference_no" VARCHAR(80),
    "title" VARCHAR(200) NOT NULL,
    "record_date" DATE NOT NULL,
    "summary" TEXT,
    "document_url" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_events" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "speaker" VARCHAR(160),
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "location" VARCHAR(200),
    "status" "EventStatus" NOT NULL DEFAULT 'IDEA',
    "budget_amount" INTEGER NOT NULL DEFAULT 0,
    "actual_expense" INTEGER NOT NULL DEFAULT 0,
    "lpj_notes" TEXT,
    "is_public_open" BOOLEAN NOT NULL DEFAULT false,
    "sponsor_needed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "event_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "event_participants" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "role" "EventParticipantRole" NOT NULL DEFAULT 'ATTENDEE',
    "member_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "nim" VARCHAR(40),
    "email" VARCHAR(180),
    "institution" VARCHAR(160),
    "position" VARCHAR(100),
    "attended" BOOLEAN NOT NULL DEFAULT false,
    "attended_at" TIMESTAMPTZ(6),
    "certificate_no" VARCHAR(80),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "event_participants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "praktikum_courses" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "semester" VARCHAR(40) NOT NULL,
    "schedule" VARCHAR(160),
    "assistant_member_ids" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "praktikum_courses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "praktikum_records" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "record_type" "PraktikumRecordType" NOT NULL,
    "session_label" VARCHAR(100) NOT NULL,
    "record_date" DATE NOT NULL,
    "member_id" UUID,
    "student_nim" VARCHAR(40),
    "student_name" VARCHAR(160) NOT NULL,
    "is_present" BOOLEAN,
    "score" DOUBLE PRECISION,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "praktikum_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enabler_partners" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "pic_name" VARCHAR(120),
    "pic_contact" VARCHAR(120),
    "stage" "PartnerStage" NOT NULL DEFAULT 'PROSPECT',
    "mou_expires_at" DATE,
    "event_id" UUID,
    "obligations_json" JSONB,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "enabler_partners_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "enabler_recognitions" (
    "id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "member_id" UUID NOT NULL,
    "member_name" VARCHAR(160) NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT 'Staff of the Month',
    "kpi_score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "is_override" BOOLEAN NOT NULL DEFAULT false,
    "override_reason" TEXT,
    "reward_amount" INTEGER NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "approved_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "enabler_recognitions_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX "core_transactions_type_transaction_date_idx" ON "core_transactions"("type", "transaction_date");
CREATE UNIQUE INDEX "core_assets_code_key" ON "core_assets"("code");
CREATE INDEX "core_records_record_type_record_date_idx" ON "core_records"("record_type", "record_date");
CREATE UNIQUE INDEX "event_events_slug_key" ON "event_events"("slug");
CREATE INDEX "event_events_status_start_at_idx" ON "event_events"("status", "start_at");
CREATE UNIQUE INDEX "event_participants_certificate_no_key" ON "event_participants"("certificate_no");
CREATE INDEX "event_participants_event_id_role_idx" ON "event_participants"("event_id", "role");
CREATE INDEX "event_participants_member_id_idx" ON "event_participants"("member_id");
CREATE UNIQUE INDEX "praktikum_courses_code_key" ON "praktikum_courses"("code");
CREATE INDEX "praktikum_records_course_id_record_type_record_date_idx" ON "praktikum_records"("course_id", "record_type", "record_date");
CREATE INDEX "praktikum_records_member_id_record_type_idx" ON "praktikum_records"("member_id", "record_type");
CREATE INDEX "enabler_partners_stage_idx" ON "enabler_partners"("stage");
CREATE INDEX "enabler_recognitions_year_month_idx" ON "enabler_recognitions"("year", "month");

-- Foreign Keys
ALTER TABLE "event_participants" ADD CONSTRAINT "event_participants_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event_events"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "praktikum_records" ADD CONSTRAINT "praktikum_records_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "praktikum_courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
