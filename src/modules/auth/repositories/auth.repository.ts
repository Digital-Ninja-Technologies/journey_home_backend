import { User, IUser, UserRole } from '../models/auth.model';
import { NotFoundError } from '../../../common/errors/NotFoundError';

export class UserRepository {
  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<IUser | null> {
    return User.findById(id).exec();
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
}
