-- Workforce — especialidades, certificações, equipes e geolocalização.
--
-- Complementa `organization_memberships`, que responde "quem faz parte e com
-- que papel", com o que a operação de campo precisa saber: o que a pessoa sabe
-- fazer, o que está habilitada a fazer, com quem trabalha e onde esteve.
--
-- Nada aqui participa de autenticação ou autorização.

CREATE TABLE "specialties" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "specialties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_specialties" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "specialty_id" UUID NOT NULL,
    "level" VARCHAR(30) NOT NULL DEFAULT 'PLENO',
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "member_specialties_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_certifications" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "issuer" VARCHAR(180),
    "credential_id" VARCHAR(120),
    "issued_at" DATE,
    "expires_at" DATE,
    "file_id" UUID,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "member_certifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "teams" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "business_unit_id" UUID,
    "leader_user_id" UUID,
    "name" VARCHAR(140) NOT NULL,
    "slug" VARCHAR(140) NOT NULL,
    "description" TEXT,
    "color" VARCHAR(40),
    "status" VARCHAR(40) NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "team_memberships" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "team_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" VARCHAR(80),
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ(3),
    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_locations" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "accuracy" DECIMAL(10,2),
    "source" VARCHAR(30) NOT NULL DEFAULT 'MOBILE',
    "recorded_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_locations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "specialties_organization_id_slug_key" ON "specialties"("organization_id", "slug");
CREATE INDEX "specialties_organization_id_deleted_at_idx" ON "specialties"("organization_id", "deleted_at");

CREATE UNIQUE INDEX "member_specialties_user_id_specialty_id_key" ON "member_specialties"("user_id", "specialty_id");
CREATE INDEX "member_specialties_organization_id_specialty_id_deleted_at_idx" ON "member_specialties"("organization_id", "specialty_id", "deleted_at");
CREATE INDEX "member_specialties_organization_id_user_id_deleted_at_idx" ON "member_specialties"("organization_id", "user_id", "deleted_at");

CREATE INDEX "member_certifications_organization_id_user_id_deleted_at_idx" ON "member_certifications"("organization_id", "user_id", "deleted_at");
CREATE INDEX "member_certifications_organization_id_expires_at_deleted_at_idx" ON "member_certifications"("organization_id", "expires_at", "deleted_at");

CREATE UNIQUE INDEX "teams_organization_id_slug_key" ON "teams"("organization_id", "slug");
CREATE INDEX "teams_organization_id_status_deleted_at_idx" ON "teams"("organization_id", "status", "deleted_at");

CREATE UNIQUE INDEX "team_memberships_team_id_user_id_key" ON "team_memberships"("team_id", "user_id");
CREATE INDEX "team_memberships_organization_id_user_id_deleted_at_idx" ON "team_memberships"("organization_id", "user_id", "deleted_at");

CREATE INDEX "member_locations_organization_id_user_id_recorded_at_idx" ON "member_locations"("organization_id", "user_id", "recorded_at");
CREATE INDEX "member_locations_organization_id_recorded_at_idx" ON "member_locations"("organization_id", "recorded_at");

ALTER TABLE "specialties" ADD CONSTRAINT "specialties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_specialties" ADD CONSTRAINT "member_specialties_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_specialties" ADD CONSTRAINT "member_specialties_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_specialties" ADD CONSTRAINT "member_specialties_specialty_id_fkey" FOREIGN KEY ("specialty_id") REFERENCES "specialties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_certifications" ADD CONSTRAINT "member_certifications_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "storage_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "teams" ADD CONSTRAINT "teams_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_business_unit_id_fkey" FOREIGN KEY ("business_unit_id") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "teams" ADD CONSTRAINT "teams_leader_user_id_fkey" FOREIGN KEY ("leader_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_locations" ADD CONSTRAINT "member_locations_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_locations" ADD CONSTRAINT "member_locations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Isolamento por tenant.
--
-- Todas as tabelas são de organização, não de unidade: uma pessoa pertence à
-- empresa e pode atender várias unidades. Por isso a política é por
-- `organization_id`, sem recorte de `business_unit_ids`.

ALTER TABLE "specialties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "specialties" FORCE ROW LEVEL SECURITY;
CREATE POLICY "specialties_tenant" ON "specialties" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "member_specialties" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_specialties" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_specialties_tenant" ON "member_specialties" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "member_certifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_certifications" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_certifications_tenant" ON "member_certifications" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" FORCE ROW LEVEL SECURITY;
CREATE POLICY "teams_tenant" ON "teams" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "team_memberships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_memberships" FORCE ROW LEVEL SECURITY;
CREATE POLICY "team_memberships_tenant" ON "team_memberships" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

ALTER TABLE "member_locations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "member_locations" FORCE ROW LEVEL SECURITY;
CREATE POLICY "member_locations_tenant" ON "member_locations" FOR ALL
  USING (app_is_platform_admin() OR organization_id = app_current_organization_id())
  WITH CHECK (app_is_platform_admin() OR organization_id = app_current_organization_id());

-- Capabilities do domínio, concedidas ao plano existente.
--
-- `workforce.read` acompanha quem já administra a organização; `workforce.manage`
-- acompanha quem já a edita. Nenhum plano novo é criado.
UPDATE plans SET capabilities = ARRAY(
  SELECT DISTINCT unnest(capabilities || ARRAY['workforce.read', 'workforce.manage']::varchar[])
);
