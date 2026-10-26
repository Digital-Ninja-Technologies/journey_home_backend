import { ClientSession, Types } from "mongoose";
import { Plan, IPlan, PlanStatus, CoverageStatus } from "../models/plan.model";
import { PageOptions, escapeRegex } from "../../../common/utils/pagination";
import { Payment, PaymentStatus } from "../../payments/models/payment.model";

export class PlanRepository {
  async createWithSession(
    data: Record<string, unknown>,
    session: ClientSession,
  ): Promise<IPlan> {
    const [created] = await Plan.create([data], { session });
    return created;
  }

  listForOwner(
    ownerId: string,
    options: PageOptions,
    filters: { name?: string; status?: PlanStatus; from?: Date; to?: Date },
  ) {
    const query: Record<string, unknown> = { owner: ownerId };
    if (filters.status) query.status = filters.status;
    if (filters.name)
      query["coveredPerson.fullName"] = {
        $regex: escapeRegex(filters.name),
        $options: "i",
      };
    if (filters.from || filters.to)
      query.createdAt = {
        ...(filters.from ? { $gte: filters.from } : {}),
        ...(filters.to ? { $lte: filters.to } : {}),
      };
    return Promise.all([
      Plan.find(query)
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .exec(),
      Plan.countDocuments(query).exec(),
    ]);
  }

  async dashboard(ownerId: string) {
    const plans = await Plan.find({ owner: ownerId })
      .select("status totalContributedAmount nextPaymentDate")
      .lean();
    const payments = await Payment.aggregate([
      {
        $match: {
          owner: new Types.ObjectId(ownerId),
          status: PaymentStatus.SUCCESSFUL,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const paymentCount = await Payment.countDocuments({
      owner: ownerId,
      status: PaymentStatus.SUCCESSFUL,
      createdAt: { $gte: monthStart },
    });

    const now = new Date();

    const next = plans
      .map((p) => p.nextPaymentDate)
      .filter((d): d is Date => Boolean(d && d >= now))
      .sort((a, b) => a.getTime() - b.getTime())[0];

    return {
      totalContributed: payments[0]?.total ?? 0,
      paymentCount,
      activePlans: plans.filter((p) =>
        [
          PlanStatus.ACTIVE,
          PlanStatus.PAYMENT_DUE,
          PlanStatus.OVERDUE,
        ].includes(p.status),
      ).length,
      nextPaymentDate: next ?? null,
    };
  }

  listAll(
    options: PageOptions,
    filters: {
      status?: PlanStatus;
      ownerId?: string;
      packageId?: string;
      search?: string;
      ownerIds?: Types.ObjectId[];
    },
  ) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.ownerId) query.owner = filters.ownerId;
    if (filters.packageId) query.package = filters.packageId;
    if (filters.search) {
      const regex = { $regex: escapeRegex(filters.search), $options: "i" };
      query.$or = [{ "coveredPerson.fullName": regex }, ...(filters.ownerIds?.length ? [{ owner: { $in: filters.ownerIds } }] : [])];
    }
    return Promise.all([
      Plan.find(query)
        .sort({ createdAt: -1 })
        .skip(options.skip)
        .limit(options.limit)
        .populate("owner", "name email")
        .exec(),
      Plan.countDocuments(query).exec(),
    ]);
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
