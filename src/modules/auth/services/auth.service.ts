import { UserRepository } from '../repositories/auth.repository';
import { AddAdminDto, AdminResponseDto, AuthResponseDto, ChangePasswordDto, LoginDto, SignupDto } from '../dto/auth.dto';
import { UnauthorizedError } from '../../../common/errors/UnauthorizedError';
import { NotFoundError } from '../../../common/errors/NotFoundError';
import { ConflictError } from '../../../common/errors/ConflictError';
import { ForbiddenError } from '../../../common/errors/ForbiddenError';
import { BadRequestError } from '../../../common/errors/BadRequestError';
import { comparePassword, hashPassword } from '../../../common/utils/password';
import { generateAccessToken } from '../../../common/utils/jwt';
import { UserRole } from '../models/auth.model';

export class AuthService {
  private userRepo: UserRepository;

  constructor() {
    this.userRepo = new UserRepository();
  }

  private buildAuthResponse(user: any): AuthResponseDto {
    const isSuperAdmin = Boolean(user.isSuperAdmin || user.role === UserRole.SUPER_ADMIN);
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

  async signup(dto: SignupDto): Promise<AuthResponseDto> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('User with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const user = await this.userRepo.create({
      email: dto.email.toLowerCase(),
      passwordHash,
      role: UserRole.CUSTOMER,
      isSuperAdmin: false,
      name: dto.name.trim(),
    });

    return this.buildAuthResponse(user);
  }

  async login(loginData: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepo.findByEmail(loginData.email);
    if (!user || !user.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isMatch = await comparePassword(loginData.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async loginAdmin(loginData: LoginDto): Promise<AuthResponseDto> {
    const { email, password } = loginData;

    // Find admin by email
    const admin = await this.userRepo.findAdminByEmail(email);
    if (!admin) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Ensure admin has a passwordHash (should always be set)
    if (!admin.passwordHash) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Compare password
    const isMatch = await comparePassword(password, admin.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError('Invalid email or password');
    }

    return this.buildAuthResponse(admin);
  }

  async addAdmin(dto: AddAdminDto): Promise<AdminResponseDto> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError('Admin with this email already exists');
    }

    const passwordHash = await hashPassword(dto.password);
    const name = dto.name && dto.name.trim().length > 0
      ? dto.name.trim()
      : dto.email.split('@')[0];

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

  async deleteAdmin(adminId: string, requesterId: string): Promise<{ id: string; email: string }> {
    if (adminId === requesterId) {
      throw new ForbiddenError('You cannot delete your own account');
    }

    const targetAdmin = await this.userRepo.findById(adminId);
    if (!targetAdmin) {
      throw new NotFoundError('Admin not found');
    }

    if (targetAdmin.isSuperAdmin || targetAdmin.role === UserRole.SUPER_ADMIN) {
      throw new ForbiddenError('Super Admin account cannot be deleted');
    }

    await this.userRepo.deleteById(adminId);

    return {
      id: targetAdmin._id.toString(),
      email: targetAdmin.email,
    };
  }

  async changePassword(dto: ChangePasswordDto, requesterId: string): Promise<{ id: string; email: string }> {
    let targetAdmin = null;

    if (dto.adminId) {
      targetAdmin = await this.userRepo.findById(dto.adminId);
    } else if (dto.email) {
      targetAdmin = await this.userRepo.findByEmail(dto.email);
    } else {
      targetAdmin = await this.userRepo.findById(requesterId);
    }

    if (!targetAdmin) {
      throw new NotFoundError('Target admin user not found');
    }

    const newPasswordHash = await hashPassword(dto.newPassword);
    await this.userRepo.update(targetAdmin._id.toString(), { passwordHash: newPasswordHash });

    return {
      id: targetAdmin._id.toString(),
      email: targetAdmin.email,
    };
  }

  async getAdmins(): Promise<AdminResponseDto[]> {
    const admins = await this.userRepo.findAllAdmins();
    return admins.map((admin) => ({
      id: admin._id,
      email: admin.email,
      name: admin.name,
      role: admin.role,
      isSuperAdmin: Boolean(admin.isSuperAdmin || admin.role === UserRole.SUPER_ADMIN),
      createdAt: admin.createdAt,
    }));
  }
}
