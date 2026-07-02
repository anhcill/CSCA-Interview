import type { Request } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";

type AuditInput = {
  action: string;
  adminUserId?: string | null;
  afterData?: unknown;
  beforeData?: unknown;
  entityId?: string | null;
  entityType: string;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function toJsonValue(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function writeAdminAuditLog(req: Request, input: AuditInput) {
  try {
    await prisma.admin_audit_logs.create({
      data: {
        action: input.action,
        admin_user_id: input.adminUserId ?? null,
        after_data: toJsonValue(input.afterData),
        before_data: toJsonValue(input.beforeData),
        entity_id: input.entityId && uuidPattern.test(input.entityId) ? input.entityId : null,
        entity_type: input.entityType,
        ip_address: req.ip,
        user_agent: req.get("user-agent") ?? null
      }
    });
  } catch (error) {
    console.warn("[ADMIN_AUDIT] write failed", error instanceof Error ? error.message : error);
  }
}
