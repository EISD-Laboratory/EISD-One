-- CreateEnum
CREATE TYPE "MemberStatus" AS ENUM ('ACTIVE', 'LEAVE', 'ALUMNI');
CREATE TYPE "RoleScope" AS ENUM ('GLOBAL', 'DIVISION');
CREATE TYPE "ImportDuplicateStrategy" AS ENUM ('SKIP', 'OVERWRITE', 'MERGE');
CREATE TYPE "ImportBatchStatus" AS ENUM ('VALIDATED', 'COMPLETED', 'FAILED', 'ROLLED_BACK');
CREATE TYPE "ImportItemOperation" AS ENUM ('CREATED', 'UPDATED', 'SKIPPED', 'FAILED');
CREATE TYPE "KpiFrameworkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'ARCHIVED');
CREATE TYPE "KpiSourceType" AS ENUM ('AUTO', 'MANUAL');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE "CalendarCategory" AS ENUM ('EVENT', 'PRAKTIKUM', 'MEETING', 'COMPETITION', 'BIRTHDAY', 'OTHER');

CREATE TABLE "core_divisions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_divisions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_periods" (
    "id" UUID NOT NULL,
    "name" VARCHAR(40) NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_periods_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_members" (
    "id" UUID NOT NULL,
    "nim" VARCHAR(40) NOT NULL,
    "full_name" VARCHAR(160) NOT NULL,
    "email" VARCHAR(180),
    "birth_date" DATE,
    "phone" VARCHAR(40),
    "status" "MemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "batch_year" INTEGER,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_memberships" (
    "id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "division_id" UUID NOT NULL,
    "position_title" VARCHAR(120) NOT NULL,
    "is_head" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(180) NOT NULL,
    "password_hash" VARCHAR(255),
    "google_id" VARCHAR(180),
    "full_name" VARCHAR(160) NOT NULL,
    "member_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "last_login_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_roles" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "scope" "RoleScope" NOT NULL DEFAULT 'DIVISION',
    "division_id" UUID,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "is_extra_role" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_permissions" (
    "id" UUID NOT NULL,
    "code" VARCHAR(120) NOT NULL,
    "module" VARCHAR(60) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "action" VARCHAR(60) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "core_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_role_permissions" (
    "id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "permission_id" UUID NOT NULL,
    CONSTRAINT "core_role_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_user_roles" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "core_user_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "actor_email" VARCHAR(180),
    "action" VARCHAR(80) NOT NULL,
    "module" VARCHAR(60) NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "entity_id" VARCHAR(120),
    "before_data" JSONB,
    "after_data" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "core_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_settings" (
    "id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "value" JSONB NOT NULL,
    "description" TEXT,
    "is_public" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,
    CONSTRAINT "core_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_import_batches" (
    "id" UUID NOT NULL,
    "entity_type" VARCHAR(80) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_path" VARCHAR(300),
    "duplicate_strategy" "ImportDuplicateStrategy" NOT NULL DEFAULT 'SKIP',
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'VALIDATED',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "success_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "column_mapping" JSONB,
    "errors_json" JSONB,
    "rolled_back_at" TIMESTAMPTZ(6),
    "rolled_back_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    CONSTRAINT "core_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_import_batch_items" (
    "id" UUID NOT NULL,
    "batch_id" UUID NOT NULL,
    "row_number" INTEGER NOT NULL,
    "entity_id" UUID,
    "operation" "ImportItemOperation" NOT NULL,
    "previous_snapshot" JSONB,
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "core_import_batch_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_kpi_frameworks" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "period_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "KpiFrameworkStatus" NOT NULL DEFAULT 'DRAFT',
    "cloned_from_id" UUID,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_kpi_frameworks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_kpi_indicators" (
    "id" UUID NOT NULL,
    "framework_id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "target_division_id" UUID,
    "weight" DOUBLE PRECISION NOT NULL,
    "source_type" "KpiSourceType" NOT NULL,
    "unit" VARCHAR(40) NOT NULL DEFAULT 'poin',
    "min_scale" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "max_scale" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "source_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_kpi_indicators_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_kpi_scores" (
    "id" UUID NOT NULL,
    "framework_id" UUID NOT NULL,
    "indicator_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "raw_value" DOUBLE PRECISION NOT NULL,
    "normalized_score" DOUBLE PRECISION NOT NULL,
    "source_type" "KpiSourceType" NOT NULL,
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'APPROVED',
    "approved_by" UUID,
    "submitted_by" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    CONSTRAINT "core_kpi_scores_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_kpi_results" (
    "id" UUID NOT NULL,
    "framework_id" UUID NOT NULL,
    "member_id" UUID NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "final_score" DOUBLE PRECISION NOT NULL,
    "breakdown_json" JSONB NOT NULL,
    "is_closed" BOOLEAN NOT NULL DEFAULT false,
    "calculated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "core_kpi_results_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_calendar_items" (
    "id" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "category" "CalendarCategory" NOT NULL DEFAULT 'OTHER',
    "start_at" TIMESTAMPTZ(6) NOT NULL,
    "end_at" TIMESTAMPTZ(6) NOT NULL,
    "all_day" BOOLEAN NOT NULL DEFAULT false,
    "location" VARCHAR(200),
    "division_id" UUID,
    "source_module" VARCHAR(60),
    "source_entity_id" VARCHAR(120),
    "is_recurring_yearly" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    CONSTRAINT "core_calendar_items_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE UNIQUE INDEX "core_divisions_code_key" ON "core_divisions"("code");
CREATE UNIQUE INDEX "core_periods_name_key" ON "core_periods"("name");
CREATE INDEX "core_periods_is_active_idx" ON "core_periods"("is_active");
CREATE UNIQUE INDEX "core_members_nim_key" ON "core_members"("nim");
CREATE UNIQUE INDEX "core_members_email_key" ON "core_members"("email");
CREATE INDEX "core_members_status_idx" ON "core_members"("status");
CREATE INDEX "core_members_full_name_idx" ON "core_members"("full_name");
CREATE UNIQUE INDEX "core_memberships_member_id_period_id_division_id_key" ON "core_memberships"("member_id", "period_id", "division_id");
CREATE INDEX "core_memberships_period_id_division_id_idx" ON "core_memberships"("period_id", "division_id");
CREATE UNIQUE INDEX "core_users_email_key" ON "core_users"("email");
CREATE UNIQUE INDEX "core_users_google_id_key" ON "core_users"("google_id");
CREATE UNIQUE INDEX "core_users_member_id_key" ON "core_users"("member_id");
CREATE INDEX "core_users_is_active_idx" ON "core_users"("is_active");
CREATE UNIQUE INDEX "core_roles_code_key" ON "core_roles"("code");
CREATE UNIQUE INDEX "core_permissions_code_key" ON "core_permissions"("code");
CREATE INDEX "core_permissions_module_idx" ON "core_permissions"("module");
CREATE UNIQUE INDEX "core_role_permissions_role_id_permission_id_key" ON "core_role_permissions"("role_id", "permission_id");
CREATE UNIQUE INDEX "core_user_roles_user_id_role_id_key" ON "core_user_roles"("user_id", "role_id");
CREATE INDEX "core_audit_logs_module_created_at_idx" ON "core_audit_logs"("module", "created_at");
CREATE INDEX "core_audit_logs_actor_id_created_at_idx" ON "core_audit_logs"("actor_id", "created_at");
CREATE UNIQUE INDEX "core_settings_key_key" ON "core_settings"("key");
CREATE INDEX "core_import_batches_entity_type_created_at_idx" ON "core_import_batches"("entity_type", "created_at");
CREATE INDEX "core_import_batch_items_batch_id_operation_idx" ON "core_import_batch_items"("batch_id", "operation");
CREATE INDEX "core_kpi_frameworks_period_id_status_idx" ON "core_kpi_frameworks"("period_id", "status");
CREATE UNIQUE INDEX "core_kpi_indicators_framework_id_code_key" ON "core_kpi_indicators"("framework_id", "code");
CREATE UNIQUE INDEX "core_kpi_scores_framework_id_indicator_id_member_id_year_mo_key" ON "core_kpi_scores"("framework_id", "indicator_id", "member_id", "year", "month");
CREATE INDEX "core_kpi_scores_framework_id_year_month_idx" ON "core_kpi_scores"("framework_id", "year", "month");
CREATE UNIQUE INDEX "core_kpi_results_framework_id_member_id_year_month_key" ON "core_kpi_results"("framework_id", "member_id", "year", "month");
CREATE INDEX "core_kpi_results_framework_id_year_month_final_score_idx" ON "core_kpi_results"("framework_id", "year", "month", "final_score");
CREATE INDEX "core_calendar_items_start_at_end_at_idx" ON "core_calendar_items"("start_at", "end_at");

-- Foreign Keys
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "core_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "core_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_memberships" ADD CONSTRAINT "core_memberships_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "core_divisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_users" ADD CONSTRAINT "core_users_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "core_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core_roles" ADD CONSTRAINT "core_roles_division_id_fkey" FOREIGN KEY ("division_id") REFERENCES "core_divisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "core_role_permissions" ADD CONSTRAINT "core_role_permissions_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_role_permissions" ADD CONSTRAINT "core_role_permissions_permission_id_fkey" FOREIGN KEY ("permission_id") REFERENCES "core_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_user_roles" ADD CONSTRAINT "core_user_roles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "core_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_user_roles" ADD CONSTRAINT "core_user_roles_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "core_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_import_batch_items" ADD CONSTRAINT "core_import_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "core_import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_kpi_frameworks" ADD CONSTRAINT "core_kpi_frameworks_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "core_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "core_kpi_indicators" ADD CONSTRAINT "core_kpi_indicators_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "core_kpi_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_kpi_scores" ADD CONSTRAINT "core_kpi_scores_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "core_kpi_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_kpi_scores" ADD CONSTRAINT "core_kpi_scores_indicator_id_fkey" FOREIGN KEY ("indicator_id") REFERENCES "core_kpi_indicators"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_kpi_scores" ADD CONSTRAINT "core_kpi_scores_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "core_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_kpi_results" ADD CONSTRAINT "core_kpi_results_framework_id_fkey" FOREIGN KEY ("framework_id") REFERENCES "core_kpi_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_kpi_results" ADD CONSTRAINT "core_kpi_results_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "core_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
