import { User, IUser, UserRole } from '../models/auth.model';
import { NotFoundError } from '../../../common/errors/NotFoundError';
import { PageOptions, escapeRegex } from '../../../common/utils/pagination';

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id).exec();
  }

  findEmailVerificationToken(hash: string) {
    return User.findOne({ emailVerificationTokenHash: hash, emailVerificationExpiresAt: { $gt: new Date() } }).select("+emailVerificationTokenHash +emailVerificationExpiresAt").exec();
  }

  findPasswordResetToken(hash: string) {
    return User.findOne({ passwordResetTokenHash: hash, passwordResetExpiresAt: { $gt: new Date() } }).select("+passwordResetTokenHash +passwordResetExpiresAt").exec();
  }

  async findAdminByEmail(email: string): Promise<IUser | null> {
    return User.findOne({
      email: email.toLowerCase(),
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    }).exec();
  }

  async findCustomerByEmail(email: string): Promise<IUser | null> {
    return User.findOne({
      email: email.toLowerCase(),
      role: UserRole.CUSTOMER,
    }).exec();
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return user.save();
  }

  async update(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, updateData, { new: true }).exec();
  }

  async deleteById(id: string): Promise<IUser | null> {
    return User.findByIdAndDelete(id).exec();
  }

  async findAllAdmins(): Promise<IUser[]> {
    return User.find({
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    })
      .select("-passwordHash")
      .sort({ createdAt: -1 })
      .exec();
  }

  async adminExists(): Promise<boolean> {
    const count = await User.countDocuments({
      role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] },
    }).exec();
    return count > 0;
  }

  async findAllCustomers(options: PageOptions, filters: { search?: string; emailVerified?: boolean }): Promise<[IUser[], number]> {
    const query: Record<string, unknown> = { role: UserRole.CUSTOMER };
    if (filters.emailVerified !== undefined) query.isEmailVerified = filters.emailVerified;
    if (filters.search) { const search = escapeRegex(filters.search); query.$or = [{ email: { $regex: search, $options: "i" } }, { name: { $regex: search, $options: "i" } }]; }
    return Promise.all([User.find(query).select("-passwordHash -emailVerificationTokenHash -passwordResetTokenHash").sort({ createdAt: -1 }).skip(options.skip).limit(options.limit).exec(), User.countDocuments(query).exec()]);
  }
}
