import { AuditLog } from "../models/audit-log.model";

export class AuditRepository {
  create(data: Parameters<typeof AuditLog.create>[0]) {
    return AuditLog.create(data);
  }
}
