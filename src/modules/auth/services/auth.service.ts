import { UserRepository } from "../repositories/auth.repository";
import {
  AddAdminDto,
  AdminResponseDto,
  AuthResponseDto,
  ChangePasswordDto,
  ChangePasswordResponse,
  LoginDto,
  SignupDto,
} from "../dto/auth.dto";
import { UnauthorizedError } from "../../../common/errors/UnauthorizedError";
import { NotFoundError } from "../../../common/errors/NotFoundError";
import { ConflictError } from "../../../common/errors/ConflictError";
import { ForbiddenError } from "../../../common/errors/ForbiddenError";
import { BadRequestError } from "../../../common/errors/BadRequestError";
import { comparePassword, hashPassword } from "../../../common/utils/password";
import { generateAccessToken } from "../../../common/utils/jwt";
import { IUser, UserRole } from "../models/auth.model";

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  // Build the requested result.
  private buildAuthResponse(user: any): AuthResponseDto {
    const isSuperAdmin = Boolean(
      user.isSuperAdmin || user.role === UserRole.SUPER_ADMIN,
    );
    // Stores the result of generateAccessToken in token.
    const token = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      isSuperAdmin,
    });

    return {
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        role: user.role,
        isSuperAdmin,
      },
      token,
    };
  }

  // Registers a new user
  async signup(dto: SignupDto): Promise<AuthResponseDto> {
    // check if user exists
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("User with this email already exists");
    }

    // hash password
    const passwordHash = await hashPassword(dto.password);
    // create the user
    const user = await this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role: dto.role,
      isSuperAdmin: dto.role === UserRole.SUPER_ADMIN ? true : false,
      name: dto.name.trim(),
    });

    return this.buildAuthResponse(user);
  }

  // Authenticates a user and returns the  session data.
  async login(loginData: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepo.findByEmail(loginData.email);

    if (!user || !user.passwordHash) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const isMatch = await comparePassword(
      loginData.password,
      user.passwordHash,
    );
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password");
    }

    return this.buildAuthResponse(user);
  }

  // Creates an administrator account
  async addAdmin(dto: AddAdminDto): Promise<AdminResponseDto> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError("Admin with this email already exists");
    }

    const passwordHash = await hashPassword(dto.password);
    const name =
      dto.name && dto.name.trim().length > 0
        ? dto.name.trim()
        : dto.email.split("@")[0];

    const newAdmin = await this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role: UserRole.ADMIN,
      isSuperAdmin: false,
      name,
    });

    return {
      id: newAdmin._id,
      email: newAdmin.email,
      name: newAdmin.name,
      role: newAdmin.role,
      isSuperAdmin: newAdmin.isSuperAdmin,
      password: dto.password,
      createdAt: newAdmin.createdAt,
    };
  }

  // Removes the selected administrator account.
  async deleteAdmin(
    adminId: string,
    requesterId: string,
  ): Promise<{ id: string; email: string }> {
    // check if the person is trying to delete their account
    if (adminId === requesterId) {
      throw new ForbiddenError("You cannot delete your own account");
    }

    const targetAdmin = await this.userRepo.findById(adminId);
    if (!targetAdmin) {
      throw new NotFoundError("Admin not found");
    }

    // prevenets super admin from being deleted
    if (targetAdmin.isSuperAdmin || targetAdmin.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenError("Super Admin account cannot be deleted");
    }

    await this.userRepo.deleteById(adminId);

    return {
      id: targetAdmin._id.toString(),
      email: targetAdmin.email,
    };
  }

  // Validates the password change and saves the new password.
  async changePassword(
    userId: string,
    dto: ChangePasswordDto,
  ): Promise<ChangePasswordResponse> {
    const user = await this.userRepo.findById(userId);

    if (!user) {
      throw new NotFoundError("User not found");
    }

    const correctPasswrd = await comparePassword(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!correctPasswrd) {
      throw new BadRequestError("Current password is incorrect");
    }

    const newPasswordHash = await hashPassword(dto.newPassword);

    await this.userRepo.update(userId, { passwordHash: newPasswordHash });

    return {
      message: "Password changed successfully",
    };
  }

  // Returns the administrator accounts.
  async getAdmins(): Promise<AdminResponseDto[]> {
    const admins = await this.userRepo.findAllAdmins();

    return admins.map((admin) => ({
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isSuperAdmin: Boolean(
        admin.isSuperAdmin || admin.role === UserRole.SUPER_ADMIN,
      ),
      createdAt: admin.createdAt,
    }));
  }

  // Returns the customer accounts.
  async getCustomers(): Promise<IUser[]> {
    const customers = await this.userRepo.findAllCustomers();
    return customers;
  }
}
