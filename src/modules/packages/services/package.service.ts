import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { IJourneyPackage, IPackageSnapshot } from "../models/package.model";
import { PackageRepository } from "../repositories/package.repository";
import { PaystackService } from "../../payments/services/paystack.service";
import {
  PageOptions,
  pageResult,
  PaginatedResult,
} from "../../../common/utils/pagination";

export class PackageService {
  private repository = new PackageRepository();

  async listActive(): Promise<IJourneyPackage[]> {
    return this.repository.listActive();
  }

  // Returns all records in newest-first order.
  async listAll(
    options: PageOptions,
    filters: { isActive?: boolean; search?: string },
  ): Promise<PaginatedResult<IJourneyPackage>> {
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
        pkg = await this.repository.createWithSession(
          {
            ...dto,
            amount: dto.amount === undefined ? undefined : dto.amount * 100,
            currency,
            billingInterval: interval,
            paystackPlanStatus: "pending",
            createdBy: newAdminId,
            updatedBy: newAdminId,
          },
          session,
        );
      });
    } finally {
      await session.endSession();
    }

    // Persist the package before the external call so Paystack cannot succeed without a local record.
    try {
      const providerPlan = await new PaystackService().createPlan({
        name: pkg.name,
        amount: pkg.amount,
        currency: pkg.currency,
        interval: pkg.billingInterval,
        description: pkg.description,
      });
      const updated = await this.repository.update(pkg._id.toString(), {
        paystackPlanCode: providerPlan.plan_code,
        paystackPlanId: providerPlan.id,
        paystackPlanAmount: providerPlan.amount,
        paystackPlanCurrency: providerPlan.currency,
        paystackPlanInterval: providerPlan.interval,
        paystackPlanSyncedAt: new Date(),
        paystackPlanStatus: "ready",
      });
      if (!updated)
        throw new Error("Package provider details could not be persisted");
      return updated;
    } catch (error) {
      await this.repository.update(pkg._id.toString(), {
        paystackPlanStatus: "failed",
      });
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

    // Package amounts arrive in major currency units, while MongoDB and Paystack store minor units.
    const nextAmount =
      dto.amount === undefined ? current.amount : dto.amount * 100;
    const nextCurrency = (dto.currency ?? current.currency).toUpperCase();
    const nextName = dto.name ?? current.name;
    const nextDescription = dto.description ?? current.description;
    const nextInterval = dto.billingInterval ?? current.billingInterval;

    // These are the fields represented by a Paystack plan. Features and isActive remain local package settings.
    const paystackPlanChanged =
      nextName !== current.name ||
      nextDescription !== current.description ||
      nextAmount !== current.amount ||
      nextCurrency !== current.currency ||
      nextInterval !== current.billingInterval;

    let providerFields: Partial<IJourneyPackage> = {};

    if (paystackPlanChanged) {
      const paystack = new PaystackService();
      if (current.paystackPlanCode) {
        // Update the existing Paystack plan; existing subscriptions retain their current terms.
        await paystack.updatePlan(current.paystackPlanCode, {
          name: nextName,
          amount: nextAmount,
          currency: nextCurrency,
          interval: nextInterval,
          description: nextDescription,
          update_existing_subscriptions: false,
        });

        // The update endpoint returns no plan object, so mirror the requested values in local sync metadata.
        providerFields = {
          paystackPlanStatus: "ready",
          paystackPlanAmount: nextAmount,
          paystackPlanCurrency: nextCurrency,
          paystackPlanInterval: nextInterval,
          paystackPlanSyncedAt: new Date(),
        };
      } else {
        // Older packages without a Paystack code need one initial plan created before future edits can update it.
        const providerPlan = await paystack.createPlan({
          name: nextName,
          amount: nextAmount,
          currency: nextCurrency,
          interval: nextInterval,
          description: nextDescription,
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
    }
    const pkg = await this.repository.update(id, {
      ...dto,
      amount: dto.amount === undefined ? undefined : dto.amount * 100,
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

    const paystack = new PaystackService();
    let providerFields: Partial<IJourneyPackage>;
    if (pkg.paystackPlanCode) {
      // A manual sync updates the linked plan too, avoiding a second Paystack plan for the same package.
      await paystack.updatePlan(pkg.paystackPlanCode, {
        name: pkg.name,
        amount: pkg.amount,
        currency: pkg.currency,
        interval: pkg.billingInterval,
        description: pkg.description,
        update_existing_subscriptions: false,
      });
      providerFields = {
        paystackPlanAmount: pkg.amount,
        paystackPlanCurrency: pkg.currency,
        paystackPlanInterval: pkg.billingInterval,
        paystackPlanSyncedAt: new Date(),
        paystackPlanStatus: "ready",
      };
    } else {
      // Create a provider plan only when this package has never been linked to one.
      const providerPlan = await paystack.createPlan({
        name: pkg.name,
        amount: pkg.amount,
        currency: pkg.currency,
        interval: pkg.billingInterval,
        description: pkg.description,
      });
      providerFields = {
        paystackPlanCode: providerPlan.plan_code,
        paystackPlanId: providerPlan.id,
        paystackPlanAmount: providerPlan.amount,
        paystackPlanCurrency: providerPlan.currency,
        paystackPlanInterval: providerPlan.interval,
        paystackPlanSyncedAt: new Date(),
        paystackPlanStatus: "ready",
      };
    }

    const updated = await this.repository.update(id, providerFields);
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
