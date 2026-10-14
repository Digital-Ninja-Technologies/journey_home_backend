import { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { JourneyPackage, IJourneyPackage, IPackageSnapshot } from "../models/package.model";

export class PackageService {
  async listActive(): Promise<IJourneyPackage[]> {
    return JourneyPackage.find({ isActive: true }).sort({ createdAt: -1 }).exec();
  }

  async listAll(): Promise<IJourneyPackage[]> {
    return JourneyPackage.find().sort({ createdAt: -1 }).exec();
  }

  async getPackage(id: string, includeInactive = false): Promise<IJourneyPackage> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestError("Invalid package id");
    const query = includeInactive ? { _id: id } : { _id: id, isActive: true };
    const pkg = await JourneyPackage.findOne(query).exec();
    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }

  async create(dto: Partial<IJourneyPackage>, adminId: string): Promise<IJourneyPackage> {
    return JourneyPackage.create({
      ...dto,
      currency: (dto.currency || "NGN").toUpperCase(),
      createdBy: adminId,
      updatedBy: adminId,
    });
  }

  async update(id: string, dto: Partial<IJourneyPackage>, adminId: string): Promise<IJourneyPackage> {
    if (!Types.ObjectId.isValid(id)) throw new BadRequestError("Invalid package id");
    const blocked = ["_id", "createdBy", "createdAt", "updatedAt"];
    if (Object.keys(dto).some((key) => blocked.includes(key))) {
      throw new BadRequestError("Protected package fields cannot be updated");
    }
    const pkg = await JourneyPackage.findByIdAndUpdate(
      id,
      { ...dto, currency: dto.currency?.toUpperCase(), updatedBy: adminId },
      { new: true, runValidators: true },
    ).exec();
    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }

  toSnapshot(pkg: IJourneyPackage): IPackageSnapshot {
    return {
      packageId: pkg._id,
      name: pkg.name,
      description: pkg.description,
      photographyIncluded: pkg.photographyIncluded,
      videographyIncluded: pkg.videographyIncluded,
      coverageDetails: pkg.coverageDetails,
      deliverables: pkg.deliverables || [],
      monthlyContributionMinor: pkg.monthlyContributionMinor,
      currency: pkg.currency,
    };
  }
}
