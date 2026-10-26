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
import { createHash, randomBytes } from "crypto";
import { env } from "../../../config/application";
import { SignupResponseDto } from "../dto/auth.dto";
import { emailVerificationTemplate } from "../templates/email-verification.template";
import { passwordResetTemplate } from "../templates/password-reset.template";
import { EmailService } from "../../../common/services/email.service";
import {
  PageOptions,
  pageResult,
  PaginatedResult,
} from "../../../common/utils/pagination";

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  // Build the requested result.
  private buildAuthResponse(user: IUser): AuthResponseDto {
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
  async signup(dto: SignupDto): Promise<SignupResponseDto> {
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
      isEmailVerified: false,
      name: dto.name.trim(),
    });
    await this.sendEmailVerification(user);
    return {
      message:
        "Signup completed. Check your email to verify the account before logging in.",
      email: user.email,
    };
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
    if (user.isEmailVerified === false)
      throw new UnauthorizedError("Verify your email before logging in");

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
  async getCustomers(
    options: PageOptions,
    filters: { search?: string; emailVerified?: boolean },
  ): Promise<PaginatedResult<IUser>> {
    const [items, total] = await this.userRepo.findAllCustomers(
      options,
      filters,
    );
    return pageResult(items, total, options);
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    return {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      isSuperAdmin: user.isSuperAdmin,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async verifyEmail(token: string): Promise<{ message: string }> {
    const user = await this.userRepo.findEmailVerificationToken(
      this.hashToken(token),
    );
    if (!user)
      throw new BadRequestError("Verification link is invalid or expired");
    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    await user.save();
    return { message: "Email verified successfully" };
  }

  async resendVerification(email: string): Promise<{ message: string }> {
    const user = await this.userRepo.findByEmail(email);
    if (user && user.isEmailVerified === false)
      await this.sendEmailVerification(user);
    return {
      message: "If the account needs verification, a new link has been sent",
    };
  }

  async requestPasswordReset(email: string): Promise<{ message: string }> {
    const user = await this.userRepo.findByEmail(email);

    if (user) {
      const token = randomBytes(32).toString("hex");

      user.passwordResetTokenHash = this.hashToken(token);

      user.passwordResetExpiresAt = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();

      const url = `${env.FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

      await new EmailService().sendEmail(
        user.email,
        "Reset your Journey Home password",
        passwordResetTemplate(user.name, url),
      );
    }
    return {
      message:
        "If an account exists for that email, password reset instructions have been sent",
    };
  }

  async resetPassword(
    token: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.userRepo.findPasswordResetToken(
      this.hashToken(token),
    );
    if (!user)
      throw new BadRequestError("Password reset link is invalid or expired");
    user.passwordHash = await hashPassword(newPassword);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    await user.save();
    return { message: "Password reset successfully" };
  }

  private hashToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
  }

  private async sendEmailVerification(user: IUser): Promise<void> {
    const token = randomBytes(32).toString("hex");
    user.emailVerificationTokenHash = this.hashToken(token);

    user.emailVerificationExpiresAt = new Date(
      Date.now() + 24 * 60 * 60 * 1000,
    );

    await user.save();
    const url = `${env.FRONTEND_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}`;


    await new EmailService().sendEmail(
      user.email,
      "Verify your Journey Home email",
      emailVerificationTemplate(user.name, url),
    );
  }
}
