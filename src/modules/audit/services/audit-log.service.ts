import { AuditLog } from "../models/audit-log.model";

export class AuditLogService {
  async record(input: {
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await AuditLog.create({
      actor: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata,
    });
  }
}
