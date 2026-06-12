import { Role } from '../value-objects/role.enum';

export class User {
  constructor(
    public id: string,
    public email: string,
    public passwordHash: string,
    public name: string,
    public role: Role,
    public isActive: boolean = true,
    public refreshTokenHash?: string | null,
  ) {}

  isAdmin(): boolean {
    return this.role === Role.ADMIN;
  }

  isTeacher(): boolean {
    return this.role === Role.TEACHER;
  }

  isStudent(): boolean {
    return this.role === Role.STUDENT;
  }
}
