import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { IJourneyPackage, IPackageSnapshot } from "../models/package.model";
import { PackageRepository } from "../repositories/package.repository";
import { PaystackService } from "../../payments/services/paystack.service";
import { PageOptions, pageResult, PaginatedResult } from "../../../common/utils/pagination";

export class PackageService {
  private repository = new PackageRepository();

  async listActive(): Promise<IJourneyPackage[]> {
    return this.repository.listActive();
  }

  // Returns all records in newest-first order.
  async listAll(options: PageOptions, filters: { isActive?: boolean; search?: string }): Promise<PaginatedResult<IJourneyPackage>> {
    const [items, total] = await this.repository.listAll(options, filters);
    return pageResult(items, total, options);
  }

  // get one package
  async getPackage(
    id: string,
    includeInactive = false,
  ): Promise<IJourneyPackage> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestError("Invalid package id");

    const pkg = await this.repository.findById(id, includeInactive);
    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }

  async create(
    dto: Partial<IJourneyPackage>,
    adminId: string,
  ): Promise<IJourneyPackage> {
    const newAdminId = new Types.ObjectId(adminId);

    const currency = (dto.currency || "NGN").toUpperCase();

    const interval = dto.billingInterval || "monthly";

    const session = await mongoose.startSession();
    let pkg!: IJourneyPackage;
    try {
      await session.withTransaction(async () => {
        pkg = await this.repository.createWithSession({ ...dto, currency, billingInterval: interval, paystackPlanStatus: "pending", createdBy: newAdminId, updatedBy: newAdminId }, session);
      });
    } finally { await session.endSession(); }

    // Persist the package before the external call so Paystack cannot succeed without a local record.
    try {
      const providerPlan = await new PaystackService().createPlan({ name: pkg.name, amount: pkg.amount, currency: pkg.currency, interval: pkg.billingInterval, description: pkg.description });
      const updated = await this.repository.update(pkg._id.toString(), { paystackPlanCode: providerPlan.plan_code, paystackPlanId: providerPlan.id, paystackPlanAmount: providerPlan.amount, paystackPlanCurrency: providerPlan.currency, paystackPlanInterval: providerPlan.interval, paystackPlanSyncedAt: new Date(), paystackPlanStatus: "ready" });
      if (!updated) throw new Error("Package provider details could not be persisted");
      return updated;
    } catch (error) {
      await this.repository.update(pkg._id.toString(), { paystackPlanStatus: "failed" });
      throw error;
    }
  }

  async update(
    id: string,
    dto: Partial<IJourneyPackage>,
    adminId: string,
  ): Promise<IJourneyPackage> {

    if (!Types.ObjectId.isValid(id))
      throw new BadRequestError("Invalid package id");
    
    const blocked = ["_id", "createdBy", "createdAt", "updatedAt"];

    if (Object.keys(dto).some((key) => blocked.includes(key))) {
      throw new BadRequestError("Protected package fields cannot be updated");
    }

    const newAdminId = new Types.ObjectId(adminId);

    const current = await this.repository.findById(id, true);

    if (!current) throw new NotFoundError("Package not found");

    const commercialChange =
      (dto.amount !== undefined &&
        dto.amount !== current.amount) ||
      
      (dto.currency !== undefined &&
        dto.currency.toUpperCase() !== current.currency) ||
      
      (dto.billingInterval !== undefined &&
        dto.billingInterval !== current.billingInterval);
    
    let providerFields: Partial<IJourneyPackage> = {};

    if (commercialChange) {
      const providerPlan = await new PaystackService().createPlan({
        name: dto.name || current.name,
        amount:
          dto.amount ?? current.amount,
        
        currency: (dto.currency || current.currency).toUpperCase(),

        interval: dto.billingInterval || current.billingInterval,

        description: dto.description || current.description,
      });

      providerFields = {
        paystackPlanCode: providerPlan.plan_code,
        paystackPlanStatus: "ready",

        paystackPlanId: providerPlan.id,
        paystackPlanAmount: providerPlan.amount,
        paystackPlanCurrency: providerPlan.currency,
        paystackPlanInterval: providerPlan.interval,
        paystackPlanSyncedAt: new Date(),
      };
    }
    const pkg = await this.repository.update(id, {
      ...dto,
      currency: dto.currency?.toUpperCase(),
      ...providerFields,
      updatedBy: newAdminId,
    });

    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }

  async syncPaystackPlan(id: string): Promise<IJourneyPackage> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestError("Invalid package id");
    const pkg = await this.repository.findById(id, true);

    if (!pkg) throw new NotFoundError("Package not found");

    const providerPlan = await new PaystackService().createPlan({
      name: pkg.name,
      amount: pkg.amount,
      currency: pkg.currency,
      interval: pkg.billingInterval,
      description: pkg.description,
    });

    const updated = await this.repository.update(id, {
      paystackPlanCode: providerPlan.plan_code,
      paystackPlanId: providerPlan.id,
      paystackPlanAmount: providerPlan.amount,
      paystackPlanCurrency: providerPlan.currency,
      paystackPlanInterval: providerPlan.interval,
      paystackPlanSyncedAt: new Date(),
      paystackPlanStatus: "ready",
    });
    if (!updated) throw new NotFoundError("Package not found");
    return updated;
  }

  toSnapshot(pkg: IJourneyPackage): IPackageSnapshot {
    return {
      packageId: pkg._id,
      name: pkg.name,
      description: pkg.description,
      features: pkg.features || [],
      amount: pkg.amount,
      currency: pkg.currency,
      billingInterval: pkg.billingInterval,
    };
  }

  publicView(pkg: IJourneyPackage) {
    const value = pkg.toObject();
    delete value.paystackPlanCode;
    delete value.paystackPlanId;
    delete value.paystackPlanAmount;
    delete value.paystackPlanStatus;
    delete value.paystackPlanCurrency;
    delete value.paystackPlanInterval;
    delete value.paystackPlanSyncedAt;
    return value;
  }
}
