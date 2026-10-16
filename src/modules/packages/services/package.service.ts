// Imports Types from mongoose.
import { Types } from "mongoose";
// Imports BadRequestError from ../../../common/errors/BadRequestError.
import { BadRequestError } from "../../../common/errors/BadRequestError";
// Imports NotFoundError from ../../../common/errors/NotFoundError.
import { NotFoundError } from "../../../common/errors/NotFoundError";
// Imports IJourneyPackage, IPackageSnapshot from ../models/package.model.
import { IJourneyPackage, IPackageSnapshot } from "../models/package.model";
// Imports PackageRepository from ../repositories/package.repository.
import { PackageRepository } from "../repositories/package.repository";

// Declares the service class that groups related application operations.
export class PackageService {
  // Provides the next part of the surrounding operation.
  private repository = new PackageRepository();
  // Returns active packages in newest-first order.
  // Declares a function or method used by this service.
  async listActive(): Promise<IJourneyPackage[]> {
    // Returns this.repository.listActive() to the caller.
    return this.repository.listActive();
  // Closes the current block.
  }

  // Returns all records in newest-first order.
  // Declares a function or method used by this service.
  async listAll(): Promise<IJourneyPackage[]> {
    // Returns this.repository.listAll() to the caller.
    return this.repository.listAll();
  // Closes the current block.
  }

  // Returns a package after validating its identifier and availability.
  // Declares a function or method used by this service.
  async getPackage(
    // Declares the id property with type or value string,.
    id: string,
    // Updates includeInactive with the value on the right-hand side.
    includeInactive = false,
  // Provides the next part of the surrounding operation.
  ): Promise<IJourneyPackage> {
    // Runs the following branch when !Types.ObjectId.isValid(id) is true.
    if (!Types.ObjectId.isValid(id))
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Invalid package id");
    // Stores the result of this.repository.findById in pkg.
    const pkg = await this.repository.findById(id, includeInactive);
    // Runs the following branch when !pkg) throw new NotFoundError("Package not found" is true.
    if (!pkg) throw new NotFoundError("Package not found");
    // Returns pkg to the caller.
    return pkg;
  // Closes the current block.
  }

  // Creates the requested record and coordinates its related work.
  // Declares a function or method used by this service.
  async create(
    // Declares the dto property with type or value Partial<IJourneyPackage>,.
    dto: Partial<IJourneyPackage>,
    // Declares the adminId property with type or value string,.
    adminId: string,
  // Provides the next part of the surrounding operation.
  ): Promise<IJourneyPackage> {
    // Stores the result of Types.ObjectId in newAdminId.
    const newAdminId = new Types.ObjectId(adminId);
    // Returns this.repository.create({ to the caller.
    return this.repository.create({
      // Provides the next part of the surrounding operation.
      ...dto,
      // Declares the currency property with type or value (dto.currency || "NGN").toUpperCase(),.
      currency: (dto.currency || "NGN").toUpperCase(),
      // Declares the createdBy property with type or value newAdminId,.
      createdBy: newAdminId,
      // Declares the updatedBy property with type or value newAdminId,.
      updatedBy: newAdminId,
    // Closes the current block.
    });
  // Closes the current block.
  }

  // Updates the matching record.
  // Declares a function or method used by this service.
  async update(
    // Declares the id property with type or value string,.
    id: string,
    // Declares the dto property with type or value Partial<IJourneyPackage>,.
    dto: Partial<IJourneyPackage>,
    // Declares the adminId property with type or value string,.
    adminId: string,
  // Provides the next part of the surrounding operation.
  ): Promise<IJourneyPackage> {
    // Runs the following branch when !Types.ObjectId.isValid(id) is true.
    if (!Types.ObjectId.isValid(id))
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Invalid package id");
    // Defines blocked using the value on the right-hand side.
    const blocked = ["_id", "createdBy", "createdAt", "updatedAt"];

    // Runs the following branch when Object.keys(dto).some((key) => blocked.includes(key)) is true.
    if (Object.keys(dto).some((key) => blocked.includes(key))) {
      // Raises BadRequestError to report an invalid or failed operation.
      throw new BadRequestError("Protected package fields cannot be updated");
    // Closes the current block.
    }

    // Stores the result of Types.ObjectId in newAdminId.
    const newAdminId = new Types.ObjectId(adminId);

    // Stores the result of this.repository.update in pkg.
    const pkg = await this.repository.update(id, {
      // Provides the next part of the surrounding operation.
      ...dto,
      // Declares the currency property with type or value dto.currency?.toUpperCase(),.
      currency: dto.currency?.toUpperCase(),
      // Declares the updatedBy property with type or value newAdminId,.
      updatedBy: newAdminId,
    // Closes the current block.
    });

    // Runs the following branch when !pkg) throw new NotFoundError("Package not found" is true.
    if (!pkg) throw new NotFoundError("Package not found");
    // Returns pkg to the caller.
    return pkg;
  // Closes the current block.
  }

  // Copies package details into the plan snapshot format.
  // Calls toSnapshot to perform the next step.
  toSnapshot(pkg: IJourneyPackage): IPackageSnapshot {
    // Returns { to the caller.
    return {
      // Declares the packageId property with type or value pkg._id,.
      packageId: pkg._id,
      // Declares the name property with type or value pkg.name,.
      name: pkg.name,
      // Declares the description property with type or value pkg.description,.
      description: pkg.description,
      // Declares the photographyIncluded property with type or value pkg.photographyIncluded,.
      photographyIncluded: pkg.photographyIncluded,
      // Declares the videographyIncluded property with type or value pkg.videographyIncluded,.
      videographyIncluded: pkg.videographyIncluded,
      // Declares the coverageDetails property with type or value pkg.coverageDetails,.
      coverageDetails: pkg.coverageDetails,
      // Declares the deliverables property with type or value pkg.deliverables || [],.
      deliverables: pkg.deliverables || [],
      // Declares the monthlyContributionMinor property with type or value pkg.monthlyContributionMinor,.
      monthlyContributionMinor: pkg.monthlyContributionMinor,
      // Declares the currency property with type or value pkg.currency,.
      currency: pkg.currency,
    // Closes the current block.
    };
  // Closes the current block.
  }
// Closes the current block.
}
