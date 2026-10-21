import { ClientSession, Types } from "mongoose";
import { Plan, IPlan, PlanStatus, CoverageStatus } from "../models/plan.model";
import { PageOptions, escapeRegex } from "../../../common/utils/pagination";

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

  listAll(options: PageOptions, filters: { status?: PlanStatus; ownerId?: string; packageId?: string; search?: string }) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.ownerId) query.owner = filters.ownerId;
    if (filters.packageId) query.package = filters.packageId;
    if (filters.search) query["coveredPerson.fullName"] = { $regex: escapeRegex(filters.search), $options: "i" };
    return Promise.all([Plan.find(query).sort({ createdAt: -1 }).skip(options.skip).limit(options.limit).exec(), Plan.countDocuments(query).exec()]);
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
