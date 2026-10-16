// Imports mongoose from mongoose.
import mongoose, { Types } from "mongoose";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";
// Imports NotFoundError from ../../../common/errors/NotFoundError.
import { NotFoundError } from "../../../common/errors/NotFoundError";
// Imports PackageService from ../../packages/services/package.service.
import { PackageService } from "../../packages/services/package.service";
// Imports BillingScheduleService from ../../billing/services/billing-schedule.service.
import { BillingScheduleService } from "../../billing/services/billing-schedule.service";
// Imports PlanStatus, IPlan, CoverageStatus from ../models/plan.model.
import { PlanStatus, IPlan, CoverageStatus } from "../models/plan.model";
// Imports PlanRepository from ../repositories/plan.repository.
import { PlanRepository } from "../repositories/plan.repository";
// Imports addOneMonthPreservingBillingDay from ./date.service.
import { addOneMonthPreservingBillingDay } from "./date.service";
// Imports PlanStateService from ./plan-state.service.
import { PlanStateService } from "./plan-state.service";

// Declares the service class that groups related application operations.
export class PlanService {
  // Provides the next part of the surrounding operation.
  private packages = new PackageService();
  // Provides the next part of the surrounding operation.
  private state = new PlanStateService();
  // Provides the next part of the surrounding operation.
  private repository = new PlanRepository();

  // Creates the requested record and coordinates its related work.
  // Declares a function or method used by this service.
  async create(ownerId: string, dto: any): Promise<IPlan> {
    // Stores the result of this.packages.getPackage in pkg.
    const pkg = await this.packages.getPackage(dto.packageId, false);
    // Stores the result of this.packages.toSnapshot in snapshot.
    const snapshot = this.packages.toSnapshot(pkg);
    // Stores the result of Date in startDate.
    const startDate = new Date();
    // Stores the result of addOneMonthPreservingBillingDay in nextPaymentDate.
    const nextPaymentDate = addOneMonthPreservingBillingDay(startDate);
    // Stores the result of mongoose.startSession in session.
    const session = await mongoose.startSession();

    // Starts an operation whose errors are handled below.
    try {
      // Provides the next part of the surrounding operation.
      let plan!: IPlan;
      // Waits for session.withTransaction to finish before continuing.
      await session.withTransaction(async () => {
        // Updates plan with the value on the right-hand side.
        plan = await this.repository.createWithSession({
            // Declares the owner property with type or value ownerId,.
            owner: ownerId,
            // Declares the package property with type or value pkg._id,.
            package: pkg._id,
            // Declares the packageSnapshot property with type or value snapshot,.
            packageSnapshot: snapshot,
            // Declares the coveredPerson property with type or value {.
            coveredPerson: {
              // Provides the next part of the surrounding operation.
              ...dto.coveredPerson,
              // Declares the dateOfBirth property with type or value dto.coveredPerson.dateOfBirth ? new Date(dto.coveredPerson.dateOfBirth.
              dateOfBirth: dto.coveredPerson.dateOfBirth ? new Date(dto.coveredPerson.dateOfBirth) : undefined,
            // Closes the current block.
            },
            // Declares the contributionAmountMinor property with type or value snapshot.monthlyContributionMinor,.
            contributionAmountMinor: snapshot.monthlyContributionMinor,
            // Declares the currency property with type or value snapshot.currency,.
            currency: snapshot.currency,
            // Declares the billingFrequency property with type or value "monthly",.
            billingFrequency: "monthly",
            // Provides the next part of the surrounding operation.
            startDate,
            // Provides the next part of the surrounding operation.
            nextPaymentDate,
            // Declares the status property with type or value PlanStatus.PENDING,.
            status: PlanStatus.PENDING,
            // Declares the coverageStatus property with type or value CoverageStatus.PENDING,.
            coverageStatus: CoverageStatus.PENDING,
          // Closes the current block.
          }, session);
        // Provides the next part of the surrounding operation.
        await new BillingScheduleService().createInitialSchedule(plan, session);
      // Closes the current block.
      });
      // Returns plan to the caller.
      return plan;
    // Closes the current block.
    } finally {
      // Waits for session.endSession to finish before continuing.
      await session.endSession();
    // Closes the current block.
    }
  // Closes the current block.
  }

  // Returns records belonging to the specified owner.
  // Declares a function or method used by this service.
  async listForOwner(ownerId: string): Promise<IPlan[]> {
    // Returns this.repository.listForOwner(ownerId) to the caller.
    return this.repository.listForOwner(ownerId);
  // Closes the current block.
  }

  // Returns all records in newest-first order.
  // Declares a function or method used by this service.
  async listAll(): Promise<IPlan[]> {
    // Returns this.repository.listAll() to the caller.
    return this.repository.listAll();
  // Closes the current block.
  }

  // Returns a record only when it belongs to the specified owner.
  // Declares a function or method used by this service.
  async getForOwner(planId: string, ownerId: string): Promise<IPlan> {
    // Runs the following branch when !Types.ObjectId.isValid(planId)) throw new BadRequestError("Invalid plan id" is true.
    if (!Types.ObjectId.isValid(planId)) throw new BadRequestError("Invalid plan id");
    // Stores the result of this.repository.findForOwner in plan.
    const plan = await this.repository.findForOwner(planId, ownerId);
    // Runs the following branch when !plan) throw new NotFoundError("Plan not found" is true.
    if (!plan) throw new NotFoundError("Plan not found");
    // Returns plan to the caller.
    return plan;
  // Closes the current block.
  }

  // Returns the requested record for administrative access.
  // Declares a function or method used by this service.
  async getForAdmin(planId: string): Promise<IPlan> {
    // Runs the following branch when !Types.ObjectId.isValid(planId)) throw new BadRequestError("Invalid plan id" is true.
    if (!Types.ObjectId.isValid(planId)) throw new BadRequestError("Invalid plan id");
    // Stores the result of this.repository.findById in plan.
    const plan = await this.repository.findById(planId);
    // Runs the following branch when !plan) throw new NotFoundError("Plan not found" is true.
    if (!plan) throw new NotFoundError("Plan not found");
    // Returns plan to the caller.
    return plan;
  // Closes the current block.
  }

  // Performs the requested service operation.
  // Declares a function or method used by this service.
  async adminTransition(planId: string, status: PlanStatus): Promise<IPlan> {
    // Stores the result of this.getForAdmin in plan.
    const plan = await this.getForAdmin(planId);
    // Calls state.assertTransition to perform the next step.
    this.state.assertTransition(plan.status, status);
    // Updates plan.status with the value on the right-hand side.
    plan.status = status;
    // Waits for repository.save to finish before continuing.
    await this.repository.save(plan);
    // Returns plan to the caller.
    return plan;
  // Closes the current block.
  }
// Closes the current block.
}
