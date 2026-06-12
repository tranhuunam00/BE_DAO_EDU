export class Teacher {
  constructor(
    public id: string,
    public teacherId: string,
    public firstName: string,
    public lastName: string,
    public gender: string,
    public birthdate: string | undefined,
    public mobile: string | undefined,
    public email: string | undefined,
    public citizenId: string | undefined,
    public type: string,
    public country: string | undefined,
    public province: string | undefined,
    public districtWard: string | undefined,
    public primaryAddress: string | undefined,
    public status: string,
    public userId: string | undefined,
    public avatar: string | undefined = undefined,
    public loginEmail: string | undefined = undefined,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}

  getFullName(): string {
    return `${this.lastName} ${this.firstName}`.trim();
  }
}
