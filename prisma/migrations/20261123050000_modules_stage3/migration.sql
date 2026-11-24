-- EISD One — Tahap 3 Migration
-- 4 Modul Sisa (Media, Competition, Research, Study Group) + Custom Module Builder

CREATE TYPE "MediaRequestStatus" AS ENUM ('REQUESTED', 'IN_PROGRESS', 'REVIEW', 'PUBLISHED');
CREATE TYPE "CompetitionStatus" AS ENUM ('REGISTERED', 'FINALIST', 'WINNER', 'PARTICIPANT');
CREATE TYPE "ResearchType" AS ENUM ('RESEARCH', 'PUBLICATION', 'COMMUNITY_SERVICE');
CREATE TYPE "ResearchStatus" AS ENUM ('PROPOSAL', 'ONGOING', 'SUBMITTED', 'PUBLISHED', 'COMPLETED');

CREATE TABLE "media_requests" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "requester_division" VARCHAR(80),
    "channel" VARCHAR(80) NOT NULL DEFAULT 'Instagram',
    "pic_member_id" UUID,
    "pic_name" VARCHAR(160),
    "due_date" DATE,
    "publish_at" TIMESTAMPTZ(6),
    "status" "MediaRequestStatus" NOT NULL DEFAULT 'REQUESTED',
    "brief" TEXT,
    "asset_url" VARCHAR(300),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "media_requests_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "media_requests_status_due_date_idx" ON "media_requests"("status", "due_date");
CREATE INDEX "media_requests_pic_member_id_idx" ON "media_requests"("pic_member_id");

CREATE TABLE "competition_entries" (
    "id" UUID NOT NULL,
    "competition_name" VARCHAR(200) NOT NULL,
    "organizer" VARCHAR(160),
    "level" VARCHAR(60) NOT NULL DEFAULT 'Nasional',
    "team_name" VARCHAR(140) NOT NULL,
    "member_ids_json" JSONB,
    "member_names" TEXT,
    "event_date" DATE NOT NULL,
    "status" "CompetitionStatus" NOT NULL DEFAULT 'REGISTERED',
    "achievement" VARCHAR(200),
    "registration_fee" INTEGER NOT NULL DEFAULT 0,
    "recorded_to_cash" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "competition_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "competition_entries_status_event_date_idx" ON "competition_entries"("status", "event_date");

CREATE TABLE "research_projects" (
    "id" UUID NOT NULL,
    "title" VARCHAR(240) NOT NULL,
    "type" "ResearchType" NOT NULL DEFAULT 'RESEARCH',
    "year" INTEGER NOT NULL,
    "lead_member_id" UUID,
    "lead_name" VARCHAR(160),
    "team_summary" TEXT,
    "status" "ResearchStatus" NOT NULL DEFAULT 'PROPOSAL',
    "venue_or_partner" VARCHAR(200),
    "document_url" VARCHAR(300),
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "research_projects_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "research_projects_type_year_idx" ON "research_projects"("type", "year");
CREATE INDEX "research_projects_lead_member_id_idx" ON "research_projects"("lead_member_id");

CREATE TABLE "study_group_classes" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "topic" VARCHAR(160) NOT NULL,
    "mentor_member_id" UUID,
    "mentor_name" VARCHAR(160),
    "schedule" VARCHAR(160),
    "max_participants" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "study_group_classes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "study_group_classes_code_key" ON "study_group_classes"("code");
CREATE INDEX "study_group_classes_mentor_member_id_idx" ON "study_group_classes"("mentor_member_id");

CREATE TABLE "study_group_sessions" (
    "id" UUID NOT NULL,
    "group_id" UUID NOT NULL,
    "session_no" INTEGER NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "session_date" TIMESTAMPTZ(6) NOT NULL,
    "material_url" VARCHAR(300),
    "attendee_count" INTEGER NOT NULL DEFAULT 0,
    "attendees_text" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "study_group_sessions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "study_group_sessions_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "study_group_classes"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "study_group_sessions_group_id_session_date_idx" ON "study_group_sessions"("group_id", "session_date");

CREATE TABLE "core_custom_modules" (
    "id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "fields_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_custom_modules_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "core_custom_modules_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "core_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "core_custom_modules_division_id_key" ON "core_custom_modules"("division_id");
CREATE UNIQUE INDEX "core_custom_modules_code_key" ON "core_custom_modules"("code");

CREATE TABLE "core_custom_records" (
    "id" UUID NOT NULL,
    "module_id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "data_json" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_custom_records_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "core_custom_records_module_id_fkey" FOREIGN KEY ("module_id") REFERENCES "core_custom_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "core_custom_records_module_id_created_at_idx" ON "core_custom_records"("module_id", "created_at");
