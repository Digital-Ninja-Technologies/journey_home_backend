import mongoose, { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { PackageService } from "../../packages/services/package.service";
import { PlanStatus, IPlan, CoverageStatus } from "../models/plan.model";
import { PlanRepository } from "../repositories/plan.repository";
import { PlanStateService } from "./plan-state.service";
import {
  PageOptions,
  pageResult,
  PaginatedResult,
} from "../../../common/utils/pagination";
import { CreatePlanDto } from "../validators/plan.validator";
import { NotificationEvent } from "../../notifications/models/notification.model";
import { NotificationService } from "../../notifications/services/notification.service";

export class PlanService {
  private packages = new PackageService();
  private state = new PlanStateService();
  private repository = new PlanRepository();

  async create(ownerId: string, dto: CreatePlanDto): Promise<IPlan> {
    // Load the selected package and capture its terms for this plan.
    const pkg = await this.packages.getPackage(dto.packageId, false);

    const packageDetails = this.packages.toSnapshot(pkg);

    if (!pkg.paystackPlanCode || pkg.paystackPlanStatus !== "ready")
      throw new BadRequestError("Package subscription setup is incomplete");
    const startDate = new Date();

    // Keep plan creation transactional.
    const session = await mongoose.startSession();

    try {
      let plan!: IPlan;

      await session.withTransaction(async () => {
        // Create the plan with a snapshot of the package terms
        plan = await this.repository.createWithSession(
          {
            owner: ownerId,
            package: pkg._id,
            packageDetails: packageDetails,
            coveredPerson: {
              ...dto.coveredPerson,

              dateOfBirth: dto.coveredPerson.dateOfBirth
                ? new Date(dto.coveredPerson.dateOfBirth)
                : undefined,
            },

            amount: packageDetails.amount,

            currency: packageDetails.currency,

            billingInterval: "monthly",

            startDate,

            status: PlanStatus.PENDING,

            coverageStatus: CoverageStatus.PENDING,
          },
          session,
        );
      });

      await new NotificationService().notifyUser({
        userId: ownerId,
        event: NotificationEvent.PLAN_CREATED,
        dedupeKey: `${plan._id}:created`,
        title: "Plan created",
        message: `Your ${packageDetails.name} plan for ${dto.coveredPerson.fullName} has been created. Complete the initial contribution to activate coverage.`,
      });
      return plan;
    } finally {
      // release the database session
      await session.endSession();
    }
  }

  // Return all plans belonging to a specific owner.
  async listForOwner(
    ownerId: string,
    options: PageOptions,
    filters: { name?: string; status?: PlanStatus; from?: Date; to?: Date },
  ): Promise<PaginatedResult<IPlan>> {
    const [items, total] = await this.repository.listForOwner(
      ownerId,
      options,
      filters,
    );
    return pageResult(items, total, options);
  }

  async dashboardOverview(ownerId: string) {
    return this.repository.dashboard(ownerId);
  }

  // Return all plans, typically for an administrative view.
  async listAll(
    options: PageOptions,
    filters: {
      status?: PlanStatus;
      ownerId?: string;
      packageId?: string;
      search?: string;
      ownerIds?: Types.ObjectId[];
    },
  ): Promise<PaginatedResult<IPlan>> {
    const [items, total] = await this.repository.listAll(options, filters);
    return pageResult(items, total, options);
  }

  async getForOwner(planId: string, ownerId: string): Promise<IPlan> {
    if (!Types.ObjectId.isValid(planId)) {
      throw new BadRequestError("Invalid plan id");
    }

    const plan = await this.repository.findForOwner(planId, ownerId);

    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    return plan;
  }

  async getPlan(planId: string): Promise<IPlan> {
    if (!Types.ObjectId.isValid(planId)) {
      throw new BadRequestError("Invalid plan id");
    }

    const plan = await this.repository.findById(planId);

    if (!plan) {
      throw new NotFoundError("Plan not found");
    }

    return plan;
  }

  async adminTransition(planId: string, status: PlanStatus): Promise<IPlan> {
    const plan = await this.getPlan(planId);

    this.state.assertTransition(plan.status, status);

    plan.status = status;
    await this.repository.save(plan);

    return plan;
  }
}
