import { ClientSession, Types } from "mongoose";
import { Plan, PlanStatus } from "../../plans/models/plan.model";
import { IServiceDocument, IServiceRequest, ServiceDocument, ServiceDocumentStatus, ServiceRequest, ServiceRequestStatus } from "../models/service-request.model";

export class ServiceRequestRepository {
  findPlanForOwner(planId: string, ownerId: string) { return Plan.findOne({ _id: planId, owner: ownerId }).exec(); }
  setPlanStatus(id: Types.ObjectId, status: PlanStatus) { return Plan.updateOne({ _id: id }, { $set: { status } }).exec(); }
  create(data: Partial<IServiceRequest>) { return ServiceRequest.create(data); }
  listMine(ownerId: string) { return ServiceRequest.find({ owner: ownerId }).sort({ createdAt: -1 }).exec(); }
  listAll(status?: ServiceRequestStatus) { return ServiceRequest.find(status ? { status } : {}).sort({ createdAt: -1 }).exec(); }
  findRequest(query: Record<string, unknown>) { return ServiceRequest.findOne(query).exec(); }
  findRequestById(id: string) { return ServiceRequest.findById(id).exec(); }
  findDocument(query: Record<string, unknown>) { return ServiceDocument.findOne(query).exec(); }
  listDocuments(requestId: Types.ObjectId) { return ServiceDocument.find({ serviceRequest: requestId }).sort({ createdAt: -1 }).exec(); }
  listCurrentDocuments(requestId: Types.ObjectId) { return ServiceDocument.find({ serviceRequest: requestId, replacedBy: { $exists: false } }).exec(); }
  async createDocument(data: Partial<IServiceDocument>, session: ClientSession): Promise<IServiceDocument> {
    const [created] = await ServiceDocument.create([data], { session });
    return created;
  }
  markDocumentReplaced(id: Types.ObjectId, replacementId: Types.ObjectId, session: ClientSession) {
    return ServiceDocument.updateOne({ _id: id }, { $set: { replacedBy: replacementId } }, { session }).exec();
  }
  resetForResubmission(id: Types.ObjectId, session: ClientSession) {
    return ServiceRequest.updateOne({ _id: id }, { $set: { status: ServiceRequestStatus.SUBMITTED, moreInfoReason: undefined, resubmittedAt: new Date() } }, { session }).exec();
  }
  saveRequest(request: IServiceRequest) { return request.save(); }
  saveDocument(document: IServiceDocument) { return document.save(); }
  updateRequest(id: string, update: Record<string, unknown>) { return ServiceRequest.findByIdAndUpdate(id, update, { new: true }).exec(); }
}
