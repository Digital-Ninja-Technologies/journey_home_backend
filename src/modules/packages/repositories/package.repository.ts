import { JourneyPackage, IJourneyPackage } from "../models/package.model";

export class PackageRepository {
  listActive() { return JourneyPackage.find({ isActive: true }).sort({ createdAt: -1 }).exec(); }

  listAll() { return JourneyPackage.find().sort({ createdAt: -1 }).exec(); }

  findById(id: string, includeInactive: boolean) {
    return JourneyPackage.findOne(includeInactive ? { _id: id } : { _id: id, isActive: true }).exec();
  }

  create(data: Partial<IJourneyPackage>) { return JourneyPackage.create(data); }
  
  update(id: string, data: Partial<IJourneyPackage>) {
    return JourneyPackage.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }
}
