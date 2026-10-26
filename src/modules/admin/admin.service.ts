import { PageOptions, pageResult } from "../../common/utils/pagination";
import { User, UserRole } from "../auth/models/auth.model";
import { Plan, PlanStatus } from "../plans/models/plan.model";
import { Payment, PaymentStatus } from "../payments/models/payment.model";
import {
  ServiceRequest,
  ServiceRequestStatus,
} from "../service-requests/models/service-request.model";

const runningStatuses = [PlanStatus.ACTIVE];

const reviewStatuses = [
  ServiceRequestStatus.SUBMITTED,
  ServiceRequestStatus.UNDER_REVIEW,
  ServiceRequestStatus.DOCS_VERIFIED,
];

export class AdminDashboardService {
  async overview(startDate?: Date, endDate?: Date) {
    const now = new Date();

    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );

    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const paymentWindow =
      startDate || endDate
        ? {
            ...(startDate ? { $gte: startDate } : {}),
            ...(endDate ? { $lte: endDate } : {}),
          }
        : undefined;
    const [
      totalUsers,
      newUsers,
      activePlans,
      overduePlans,
      pendingFirstPayment,
      completedPlans,
      contributed,
      monthlyContributed,
      monthlyCommitments,
      requestCounts,
      reviewQueue,
    ] = await Promise.all([
      User.countDocuments({ role: UserRole.CUSTOMER }),

      User.countDocuments({
        role: UserRole.CUSTOMER,
        createdAt: { $gte: monthStart, $lt: monthEnd },
      }),

      Plan.countDocuments({ status: { $in: runningStatuses } }),

      Plan.countDocuments({ status: PlanStatus.OVERDUE }),

      Plan.countDocuments({ status: PlanStatus.PENDING }),

      Plan.countDocuments({ status: PlanStatus.COMPLETED }),

      Payment.aggregate([
        {
          $match: {
            status: PaymentStatus.SUCCESSFUL,
            ...(paymentWindow ? { createdAt: paymentWindow } : {}),
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Payment.aggregate([
        {
          $match: {
            status: PaymentStatus.SUCCESSFUL,
            createdAt: { $gte: monthStart, $lt: monthEnd },
          },
        },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      Plan.aggregate([
        { $match: { status: { $in: runningStatuses } } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]),

      ServiceRequest.aggregate([
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),

      ServiceRequest.find({ status: { $in: reviewStatuses } })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("owner", "name email")
        .populate("plan", "packageDetails.name")
        .lean(),
    ]);

    const counts = Object.fromEntries(
      requestCounts.map((row: { _id: string; count: number }) => [
        row._id,
        row.count,
      ]),
    );

    const lifetimeContributed =
      startDate || endDate
        ? await Payment.aggregate([
            { $match: { status: PaymentStatus.SUCCESSFUL } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
          ])
        : contributed;
    const total = lifetimeContributed[0]?.total ?? 0;

    return {
      users: { total: totalUsers, newThisMonth: newUsers },

      plans: {
        active: activePlans,
        overdue: overduePlans,
        pendingFirstPayment,
        completed: completedPlans,
      },

      contributions: {
        totalContributed: total,
        selectedPeriodContributed: contributed[0]?.total ?? 0,

        monthlyContributed: monthlyContributed[0]?.total ?? 0,

        monthlyCommitments: monthlyCommitments[0]?.total ?? 0,

        averagePerActivePlan: activePlans ? Math.round(total / activePlans) : 0,
        activePlanCount: activePlans,
      },

      serviceRequests: {
        new: counts[ServiceRequestStatus.SUBMITTED] ?? 0,

        inReview:
          (counts[ServiceRequestStatus.UNDER_REVIEW] ?? 0) +
          (counts[ServiceRequestStatus.DOCS_VERIFIED] ?? 0),
        
        awaitingCustomer: counts[ServiceRequestStatus.MORE_INFO_REQUIRED] ?? 0,

        approved: counts[ServiceRequestStatus.APPROVED] ?? 0,

        closed:
          (counts[ServiceRequestStatus.CLOSED] ?? 0) +
          (counts[ServiceRequestStatus.REJECTED] ?? 0) +
          (counts[ServiceRequestStatus.CANCELLED] ?? 0),
        
        pendingVerification: reviewStatuses.reduce(
          (sum, status) => sum + (counts[status] ?? 0),
          0,
        ),
      },
      needsReview: reviewQueue,
      period: { startDate: startDate ?? null, endDate: endDate ?? null },
    };
  }

  async users(options: PageOptions, search?: string) {
    const match: Record<string, any> = { role: UserRole.CUSTOMER };
    if (search)
      match.$or = [
        {
          name: {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        },

        {
          email: {
            $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            $options: "i",
          },
        },
      ];
    
    const [items, total] = await Promise.all([
      User.aggregate([
        { $match: match },
        { $sort: { createdAt: -1 } },
        { $skip: options.skip },
        { $limit: options.limit },
        {
          $lookup: {
            from: "plans",
            localField: "_id",
            foreignField: "owner",
            as: "plans",
          },
        },
        {
          $lookup: {
            from: "servicerequests",
            localField: "_id",
            foreignField: "owner",
            as: "requests",
          },
        },
        {
          $project: { name: 1, email: 1, createdAt: 1, plans: 1, requests: 1 },
        },
        {
          $addFields: {
            planCount: { $size: "$plans" },
            totalSaved: { $sum: "$plans.totalContributedAmount" },
            activePlanCount: {
              $size: {
                $filter: {
                  input: "$plans",
                  as: "plan",
                  cond: { $eq: ["$$plan.status", PlanStatus.ACTIVE] },
                },
              },
            },
            hasPendingRequest: {
              $gt: [
                {
                  $size: {
                    $filter: {
                      input: "$requests",
                      as: "request",
                      cond: { $in: ["$$request.status", reviewStatuses] },
                    },
                  },
                },
                0,
              ],
            },
          },
        },
        {
          $project: {
            name: 1,
            email: 1,
            createdAt: 1,
            planCount: 1,
            totalSaved: 1,
            activePlanCount: 1,
            status: {
              $cond: [
                "$hasPendingRequest",
                "Request_Pending",
                {
                  $cond: [
                    { $gt: ["$activePlanCount", 0] },
                    "Active_Plan",
                    "No_Active_Plan",
                  ],
                },
              ],
            },
          },
        },
      ]).exec(),
      User.countDocuments(match),
    ]);
    return pageResult(items, total, options);
  }
}
