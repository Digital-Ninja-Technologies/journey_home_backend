import {Package,IJourneyPackage } from "../models/package.model";

export class PackageRepository {
  listActive() { return Package.find({ isActive: true }).sort({ createdAt: -1 }).exec(); }

  listAll() { return Package.find().sort({ createdAt: -1 }).exec(); }

  findById(id: string, includeInactive: boolean) {
    return Package.findOne(includeInactive ? { _id: id } : { _id: id, isActive: true }).exec();
  }

  create(data: Partial<IJourneyPackage>) { return Package.create(data); }
  
  update(id: string, data: Partial<IJourneyPackage>) {
    return Package.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }
}
