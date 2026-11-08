import { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { PageOptions, PaginatedResult, pageResult } from "../../../common/utils/pagination";
import { IAuditLog } from "../models/audit-log.model";
import { AuditLogFilters, AuditRepository } from "../repositories/audit.repository";

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

  async listAll(
    options: PageOptions,
    filters: AuditLogFilters = {},
  ): Promise<PaginatedResult<IAuditLog>> {
    const [items, total] = await this.repository.listAll(options, filters);
    return pageResult(items, total, options);
  }

  async getAll(
    options: PageOptions,
    filters: AuditLogFilters = {},
  ): Promise<PaginatedResult<IAuditLog>> {
    return this.listAll(options, filters);
  }

  async getOne(id: string): Promise<IAuditLog> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid audit log id");
    }
    const log = await this.repository.findById(id);
    if (!log) {
      throw new NotFoundError("Audit log not found");
    }
    return log;
  }

  async getById(id: string): Promise<IAuditLog> {
    return this.getOne(id);
  }

  async deleteLog(id: string): Promise<IAuditLog> {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestError("Invalid audit log id");
    }
    const log = await this.repository.deleteById(id);
    if (!log) {
      throw new NotFoundError("Audit log not found");
    }
    return log;
  }

  async delete(id: string): Promise<IAuditLog> {
    return this.deleteLog(id);
  }
}

