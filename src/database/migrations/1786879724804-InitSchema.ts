import { MigrationInterface, QueryRunner } from "typeorm";

export class InitSchema1786879724804 implements MigrationInterface {
    name = 'InitSchema1786879724804'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 新库没有 uuid-ossp 扩展，uuid_generate_v4() 会报「函数不存在」——先建扩展（幂等）
        await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
        await queryRunner.query(`CREATE TABLE "permissions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(100) NOT NULL, "name" character varying(100) NOT NULL, "module" character varying(50) NOT NULL, "action" character varying(50) NOT NULL, "description" character varying(255), CONSTRAINT "PK_920331560282b8bd21bb02290df" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_8dad765629e83229da6feda1c1" ON "permissions"  ("code") `);
        await queryRunner.query(`CREATE TYPE "public"."menus_type_enum" AS ENUM('directory', 'menu', 'button')`);
        await queryRunner.query(`CREATE TYPE "public"."menus_status_enum" AS ENUM('enabled', 'disabled')`);
        await queryRunner.query(`CREATE TABLE "menus" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "parent_id" uuid, "name" character varying(100) NOT NULL, "code" character varying(100) NOT NULL, "type" "public"."menus_type_enum" NOT NULL, "path" character varying(255), "component" character varying(255), "redirect" character varying(255), "icon" character varying(100), "permission" character varying(100), "sort" integer NOT NULL DEFAULT '0', "visible" boolean NOT NULL DEFAULT true, "status" "public"."menus_status_enum" NOT NULL DEFAULT 'enabled', CONSTRAINT "PK_3fec3d93327f4538e0cbd4349c4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_9b9626d392ff967d6715178a3e" ON "menus"  ("code") `);
        await queryRunner.query(`CREATE TABLE "roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(50) NOT NULL, "name" character varying(100) NOT NULL, "description" character varying(255), "is_system" boolean NOT NULL DEFAULT false, "sort" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_c1433d71a4838793a49dcad46ab" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_f6d54f95c31b73fb1bdd8e91d0" ON "roles"  ("code") `);
        await queryRunner.query(`CREATE TYPE "public"."users_status_enum" AS ENUM('active', 'inactive', 'banned')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "nickname" character varying(100), "password_hash" character varying(255) NOT NULL, "status" "public"."users_status_enum" NOT NULL DEFAULT 'active', "avatar_url" character varying(255), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_97672ac88f789774dd47f7c8be" ON "users"  ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."files_category_enum" AS ENUM('image', 'document', 'video', 'audio', 'other')`);
        await queryRunner.query(`CREATE TYPE "public"."files_storagedriver_enum" AS ENUM('local', 's3')`);
        await queryRunner.query(`CREATE TABLE "files" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "original_name" character varying(255) NOT NULL, "storage_key" character varying(500) NOT NULL, "url" character varying(500) NOT NULL, "size" bigint NOT NULL, "mime_type" character varying(100) NOT NULL, "category" "public"."files_category_enum" NOT NULL DEFAULT 'other', "storageDriver" "public"."files_storagedriver_enum" NOT NULL DEFAULT 'local', "uploaded_by" uuid NOT NULL, "uploaderId" uuid, CONSTRAINT "PK_6c16b9093a142e0e7613b04a3d9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_06b12932681504a24b937efb59" ON "files"  ("original_name") `);
        await queryRunner.query(`CREATE TYPE "public"."projects_status_enum" AS ENUM('active', 'archived')`);
        await queryRunner.query(`CREATE TYPE "public"."projects_visibility_enum" AS ENUM('private', 'public')`);
        await queryRunner.query(`CREATE TABLE "projects" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text, "status" "public"."projects_status_enum" NOT NULL DEFAULT 'active', "visibility" "public"."projects_visibility_enum" NOT NULL DEFAULT 'private', "owner_id" uuid NOT NULL, "ownerId" uuid, CONSTRAINT "PK_6271df0a7aed1d6c0691ce6ac50" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_2187088ab5ef2a918473cb9900" ON "projects"  ("name") `);
        await queryRunner.query(`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "token" character varying(500) NOT NULL, "user_id" uuid NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "isActive" boolean NOT NULL DEFAULT true, "userId" uuid, CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_4542dd2f38a61354a040ba9fd5" ON "refresh_tokens"  ("token") `);
        await queryRunner.query(`CREATE TYPE "public"."scenes_status_enum" AS ENUM('draft', 'published', 'archived')`);
        await queryRunner.query(`CREATE TABLE "scenes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "description" text, "status" "public"."scenes_status_enum" NOT NULL DEFAULT 'draft', "payload" jsonb, "project_id" uuid NOT NULL, "projectId" uuid, CONSTRAINT "PK_071fd0f410cbb449feebafd46ac" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_03728c2afa70a9858469558b97" ON "scenes"  ("name") `);
        await queryRunner.query(`CREATE TABLE "role_menus" ("role_id" uuid NOT NULL, "menu_id" uuid NOT NULL, CONSTRAINT "PK_0c02205fabd207a919cb7833813" PRIMARY KEY ("role_id", "menu_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_cec0c62317111ac45c9c295d22" ON "role_menus"  ("role_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_4c7c7bd4eb8a33aece58434cbf" ON "role_menus"  ("menu_id") `);
        await queryRunner.query(`CREATE TABLE "user_roles" ("user_id" uuid NOT NULL, "role_id" uuid NOT NULL, CONSTRAINT "PK_23ed6f04fe43066df08379fd034" PRIMARY KEY ("user_id", "role_id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_87b8888186ca9769c960e92687" ON "user_roles"  ("user_id") `);
        await queryRunner.query(`CREATE INDEX "IDX_b23c65e50a758245a33ee35fda" ON "user_roles"  ("role_id") `);
        await queryRunner.query(`ALTER TABLE "files" ADD CONSTRAINT "FK_bcc22fe79462563aa584d143f27" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "projects" ADD CONSTRAINT "FK_a8e7e6c3f9d9528ed35fe5bae33" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_610102b60fea1455310ccd299de" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "scenes" ADD CONSTRAINT "FK_b29a6eaccc21ceb52b607e4f10e" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "role_menus" ADD CONSTRAINT "FK_cec0c62317111ac45c9c295d226" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "role_menus" ADD CONSTRAINT "FK_4c7c7bd4eb8a33aece58434cbf5" FOREIGN KEY ("menu_id") REFERENCES "menus"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_87b8888186ca9769c960e926870" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "user_roles" ADD CONSTRAINT "FK_b23c65e50a758245a33ee35fda1" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_b23c65e50a758245a33ee35fda1"`);
        await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT "FK_87b8888186ca9769c960e926870"`);
        await queryRunner.query(`ALTER TABLE "role_menus" DROP CONSTRAINT "FK_4c7c7bd4eb8a33aece58434cbf5"`);
        await queryRunner.query(`ALTER TABLE "role_menus" DROP CONSTRAINT "FK_cec0c62317111ac45c9c295d226"`);
        await queryRunner.query(`ALTER TABLE "scenes" DROP CONSTRAINT "FK_b29a6eaccc21ceb52b607e4f10e"`);
        await queryRunner.query(`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_610102b60fea1455310ccd299de"`);
        await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "FK_a8e7e6c3f9d9528ed35fe5bae33"`);
        await queryRunner.query(`ALTER TABLE "files" DROP CONSTRAINT "FK_bcc22fe79462563aa584d143f27"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b23c65e50a758245a33ee35fda"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87b8888186ca9769c960e92687"`);
        await queryRunner.query(`DROP TABLE "user_roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4c7c7bd4eb8a33aece58434cbf"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_cec0c62317111ac45c9c295d22"`);
        await queryRunner.query(`DROP TABLE "role_menus"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_17022daf3f885f7d35423e9971"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_178199805b901ccd220ab7740e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_03728c2afa70a9858469558b97"`);
        await queryRunner.query(`DROP TABLE "scenes"`);
        await queryRunner.query(`DROP TYPE "public"."scenes_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_4542dd2f38a61354a040ba9fd5"`);
        await queryRunner.query(`DROP TABLE "refresh_tokens"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2187088ab5ef2a918473cb9900"`);
        await queryRunner.query(`DROP TABLE "projects"`);
        await queryRunner.query(`DROP TYPE "public"."projects_visibility_enum"`);
        await queryRunner.query(`DROP TYPE "public"."projects_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_06b12932681504a24b937efb59"`);
        await queryRunner.query(`DROP TABLE "files"`);
        await queryRunner.query(`DROP TYPE "public"."files_storagedriver_enum"`);
        await queryRunner.query(`DROP TYPE "public"."files_category_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_97672ac88f789774dd47f7c8be"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_status_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_f6d54f95c31b73fb1bdd8e91d0"`);
        await queryRunner.query(`DROP TABLE "roles"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b9626d392ff967d6715178a3e"`);
        await queryRunner.query(`DROP TABLE "menus"`);
        await queryRunner.query(`DROP TYPE "public"."menus_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."menus_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_8dad765629e83229da6feda1c1"`);
        await queryRunner.query(`DROP TABLE "permissions"`);
    }

}
