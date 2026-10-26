import { Package, IJourneyPackage } from "../models/package.model";
import { PageOptions, escapeRegex } from "../../../common/utils/pagination";
import { ClientSession } from "mongoose";

export class PackageRepository {
  listActive() {
    return Package.find({
      isActive: true,
      paystackPlanCode: { $exists: true, $ne: null },
    })
      .sort({ createdAt: -1 })
      .exec();
  }

  listAll(options: PageOptions, filters: { isActive?: boolean; search?: string }) {
    const query: Record<string, unknown> = {};
    if (filters.isActive !== undefined) query.isActive = filters.isActive;
    if (filters.search) { const search = escapeRegex(filters.search); query.$or = [{ name: { $regex: search, $options: "i" } }, { description: { $regex: search, $options: "i" } }]; }
    return Promise.all([
      Package.find(query).sort({ createdAt: -1 }).skip(options.skip).limit(options.limit).exec(),
      Package.countDocuments(query).exec(),
    ]);
  }

  findById(id: string, includeInactive: boolean) {
    return Package.findOne(
      includeInactive ? { _id: id } : { _id: id, isActive: true },
    ).exec();
  }

  create(data: Partial<IJourneyPackage>) {
    return Package.create(data);
  }

  async createWithSession(data: Partial<IJourneyPackage>, session: ClientSession) {
    const [created] = await Package.create([data], { session });
    return created;
  }

  update(id: string, data: Partial<IJourneyPackage>) {
    return Package.findByIdAndUpdate(id, data, {
      new: true,
      runValidators: true,
    }).exec();
  }
}
