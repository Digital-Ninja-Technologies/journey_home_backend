import { Types } from "mongoose";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { IJourneyPackage, IPackageSnapshot } from "../models/package.model";
import { PackageRepository } from "../repositories/package.repository";

export class PackageService {
  private repository = new PackageRepository();

  async listActive(): Promise<IJourneyPackage[]> {
    return this.repository.listActive();
  }

  // Returns all records in newest-first order.
  async listAll(): Promise<IJourneyPackage[]> {
    return this.repository.listAll();
  }

  // get one package
  async getPackage(
    id: string,
    includeInactive = false,
  ): Promise<IJourneyPackage> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestError("Invalid package id");

    const pkg = await this.repository.findById(id, includeInactive);
    if (!pkg) throw new NotFoundError("Package not found");
    return pkg;
  }

  async create(
    dto: Partial<IJourneyPackage>,
    adminId: string,
  ): Promise<IJourneyPackage> {
    const newAdminId = new Types.ObjectId(adminId);

    return this.repository.create({
      ...dto,
      currency: (dto.currency || "NGN").toUpperCase(),
      createdBy: newAdminId,
      updatedBy: newAdminId,
    });
  }

  async update(
    id: string,
    dto: Partial<IJourneyPackage>,
    adminId: string,
  ): Promise<IJourneyPackage> {
    if (!Types.ObjectId.isValid(id))
      throw new BadRequestError("Invalid package id");
    const blocked = ["_id", "createdBy", "createdAt", "updatedAt"];

    if (Object.keys(dto).some((key) => blocked.includes(key))) {
      throw new BadRequestError("Protected package fields cannot be updated");
    }

    const newAdminId = new Types.ObjectId(adminId);

    const pkg = await this.repository.update(id, {
      ...dto,
      currency: dto.currency?.toUpperCase(),
      updatedBy: newAdminId,
    });

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
