import test from "node:test";
import assert from "node:assert/strict";
import { AuditLogService } from "../modules/audit/services/audit-log.service";
import { BadRequestError } from "../common/errors/BadRequestError";
import { NotFoundError } from "../common/errors/NotFoundError";
import { PageOptions } from "../common/utils/pagination";
import { IAuditLog } from "../modules/audit/models/audit-log.model";
import { AuditLogFilters } from "../modules/audit/repositories/audit.repository";

test("AuditLogService throws BadRequestError for invalid id on getOne", async () => {
  const service = new AuditLogService();
  await assert.rejects(
    async () => {
      await service.getOne("invalid-id");
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestError);
      assert.equal((err as BadRequestError).message, "Invalid audit log id");
      return true;
    },
  );
});

test("AuditLogService throws BadRequestError for invalid id on deleteLog", async () => {
  const service = new AuditLogService();
  await assert.rejects(
    async () => {
      await service.deleteLog("invalid-id");
    },
    (err: unknown) => {
      assert.ok(err instanceof BadRequestError);
      assert.equal((err as BadRequestError).message, "Invalid audit log id");
      return true;
    },
  );
});

test("AuditLogService throws NotFoundError when log is not found", async () => {
  const service = new AuditLogService();
  const validObjectId = "507f1f77bcf86cd799439011";

  // Mock repository methods
  (service as any).repository = {
    findById: async () => null,
    deleteById: async () => null,
  };

  await assert.rejects(
    async () => {
      await service.getOne(validObjectId);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError);
      assert.equal((err as NotFoundError).message, "Audit log not found");
      return true;
    },
  );

  await assert.rejects(
    async () => {
      await service.deleteLog(validObjectId);
    },
    (err: unknown) => {
      assert.ok(err instanceof NotFoundError);
      assert.equal((err as NotFoundError).message, "Audit log not found");
      return true;
    },
  );
});

test("AuditLogService formats paginated result correctly on listAll", async () => {
  const service = new AuditLogService();
  const mockLog = {
    _id: "507f1f77bcf86cd799439011",
    action: "service_request.approved",
    resourceType: "ServiceRequest",
    resourceId: "507f1f77bcf86cd799439012",
    createdAt: new Date("2026-11-01T12:00:00.000Z"),
  } as unknown as IAuditLog;

  (service as any).repository = {
    listAll: async (options: PageOptions, _filters: AuditLogFilters) => {
      return [[mockLog], 1];
    },
  };

  const pageOptions: PageOptions = { page: 1, limit: 10, skip: 0 };
  const result = await service.getAll(pageOptions);

  assert.equal(result.items.length, 1);
  assert.equal(result.pagination.total, 1);
  assert.equal(result.pagination.page, 1);
  assert.equal(result.pagination.totalPages, 1);
  assert.equal(result.pagination.hasNextPage, false);
});
