import { AuditRepository } from "../repositories/audit.repository";

export class AuditLogService {
  private repository = new AuditRepository();
  
  async record(input: {
    actorId?: string;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.repository.create({
      actor: input.actorId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata: input.metadata,
    });
  }
}
