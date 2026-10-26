import { ClientSession, Types } from "mongoose";
import { Plan, PlanStatus } from "../../plans/models/plan.model";
import { User } from "../../auth/models/auth.model";
import { PageOptions } from "../../../common/utils/pagination";
import {
  IServiceDocument,
  IServiceRequest,
  ServiceDocument,
  ServiceDocumentStatus,
  ServiceRequest,
  ServiceRequestStatus,
} from "../models/service-request.model";

export class ServiceRequestRepository {
  findPlanForOwner(planId: string, ownerId: string) {
    return Plan.findOne({ _id: planId, owner: ownerId }).exec();
  }

  setPlanStatus(id: Types.ObjectId, status: PlanStatus) {
    return Plan.updateOne({ _id: id }, { $set: { status } }).exec();
  }

  create(data: Partial<IServiceRequest>) {
    return ServiceRequest.create(data);
  }

  listMine(ownerId: string) {
    return ServiceRequest.find({ owner: ownerId })
      .sort({ createdAt: -1 })
      .exec();
  }

  listAll(options: PageOptions, filters: { status?: ServiceRequestStatus; ownerId?: string; planId?: string; from?: Date; to?: Date; search?: string }) {
    const query: Record<string, unknown> = {};
    if (filters.status) query.status = filters.status;
    if (filters.ownerId) query.owner = filters.ownerId;
    if (filters.planId) query.plan = filters.planId;
    if (filters.from || filters.to) query.createdAt = { ...(filters.from ? { $gte: filters.from } : {}), ...(filters.to ? { $lte: filters.to } : {}) };
    if (filters.search) {
      const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const users = await User.find({ $or: [{ name: { $regex: escaped, $options: "i" } }, { email: { $regex: escaped, $options: "i" } }] }).select("_id").lean();
      query.$or = [{ "coveredPersonSnapshot.fullName": { $regex: escaped, $options: "i" } }, { burialLocation: { $regex: escaped, $options: "i" } }, { owner: { $in: users.map(user => user._id) } }];
    }
    return Promise.all([ServiceRequest.find(query).sort({ createdAt: -1 }).skip(options.skip).limit(options.limit).populate("owner", "name email").populate("plan", "packageDetails").exec(), ServiceRequest.countDocuments(query).exec()]);
  }

  findRequest(query: Record<string, unknown>) {
    return ServiceRequest.findOne(query).exec();
  }
  findRequestById(id: string) {
    return ServiceRequest.findById(id).exec();
  }

  findDocument(query: Record<string, unknown>) {
    return ServiceDocument.findOne(query).exec();
  }

  listDocuments(requestId: Types.ObjectId) {
    return ServiceDocument.find({ serviceRequest: requestId })
      .sort({ createdAt: -1 })
      .exec();
  }

  listCurrentDocuments(requestId: Types.ObjectId) {
    return ServiceDocument.find({
      serviceRequest: requestId,
      replacedBy: { $exists: false },
    }).exec();
  }

  async createDocument(
    data: Partial<IServiceDocument>,
    session: ClientSession,
  ): Promise<IServiceDocument> {
    const [created] = await ServiceDocument.create([data], { session });
    return created;
  }

  markDocumentReplaced(
    id: Types.ObjectId,
    replacementId: Types.ObjectId,
    session: ClientSession,
  ) {
    return ServiceDocument.updateOne(
      { _id: id },
      { $set: { replacedBy: replacementId } },
      { session },
    ).exec();
  }

  resetForResubmission(id: Types.ObjectId, session: ClientSession) {
    return ServiceRequest.updateOne(
      { _id: id },
      {
        $set: {
          status: ServiceRequestStatus.SUBMITTED,
          moreInfoReason: undefined,
          resubmittedAt: new Date(),
        },
      },
      { session },
    ).exec();
  }

  saveRequest(request: IServiceRequest) {
    return request.save();
  }

  saveDocument(document: IServiceDocument) {
    return document.save();
  }
  
  updateRequest(id: string, update: Record<string, unknown>) {
    return ServiceRequest.findByIdAndUpdate(id, update, { new: true }).exec();
  }
}
