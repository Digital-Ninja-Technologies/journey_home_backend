import { ClientSession, Types } from "mongoose";
import { Plan, IPlan, PlanStatus, CoverageStatus } from "../models/plan.model";

export class PlanRepository {
  async createWithSession(
    data: Record<string, unknown>,
    session: ClientSession,
  ): Promise<IPlan> {
    const [created] = await Plan.create([data], { session });
    return created;
  }

  listForOwner(ownerId: string) {
    return Plan.find({ owner: ownerId }).sort({ createdAt: -1 }).exec();
  }

  listAll() {
    return Plan.find().sort({ createdAt: -1 }).exec();
  }

  findForOwner(planId: string, ownerId: string) {
    return Plan.findOne({ _id: planId, owner: ownerId }).exec();
  }

  findById(planId: string) {
    return Plan.findById(planId).exec();
  }

  updateStatus(id: Types.ObjectId | string, status: PlanStatus) {
    return Plan.updateOne({ _id: id }, { $set: { status } }).exec();
  }

  save(plan: IPlan) {
    return plan.save();
  }
}
