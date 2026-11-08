import { PageOptions } from "../../../common/utils/pagination";
import { AuditLog, IAuditLog } from "../models/audit-log.model";

export interface AuditLogFilters {
  from?: Date;
  to?: Date;
  action?: string;
  resourceType?: string;
  resourceId?: string;
}

export class AuditRepository {
  create(data: Parameters<typeof AuditLog.create>[0]) {
    return AuditLog.create(data);
  }

  async listAll(
    options: PageOptions,
    filters: AuditLogFilters,
  ): Promise<[IAuditLog[], number]> {
    const query: Record<string, unknown> = {};

    if (filters.from || filters.to) {
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    }

    if (filters.action) query.action = filters.action;
    if (filters.resourceType) query.resourceType = filters.resourceType;
    if (filters.resourceId) query.resourceId = filters.resourceId;

    return Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .populate("actor", "name email role")
        .exec(),
      AuditLog.countDocuments(query).exec(),
    ]);
  }

  findById(id: string) {
    return AuditLog.findById(id).populate("actor", "name email role").exec();
  }

  deleteById(id: string) {
    return AuditLog.findByIdAndDelete(id).exec();
  }
}

