// Imports AuditRepository from ../repositories/audit.repository.
import { AuditRepository } from "../repositories/audit.repository";

// Declares the service class that groups related application operations.
export class AuditLogService {
  // Provides the next part of the surrounding operation.
  private repository = new AuditRepository();
  
  // Stores the audit or notification record and performs related follow-up work.
  // Declares a function or method used by this service.
  async record(input: {
    // Declares the actorId property with type or value string.
    actorId?: string;
    // Declares the action property with type or value string.
    action: string;
    // Declares the resourceType property with type or value string.
    resourceType: string;
    // Declares the resourceId property with type or value string.
    resourceId: string;
    // Declares the metadata property with type or value Record<string, unknown>.
    metadata?: Record<string, unknown>;
  // Closes the current block.
  }): Promise<void> {
    // Waits for repository.create to finish before continuing.
    await this.repository.create({
      // Declares the actor property with type or value input.actorId,.
      actor: input.actorId,
      // Declares the action property with type or value input.action,.
      action: input.action,
      // Declares the resourceType property with type or value input.resourceType,.
      resourceType: input.resourceType,
      // Declares the resourceId property with type or value input.resourceId,.
      resourceId: input.resourceId,
      // Declares the metadata property with type or value input.metadata,.
      metadata: input.metadata,
    // Closes the current block.
    });
  // Closes the current block.
  }
// Closes the current block.
}
