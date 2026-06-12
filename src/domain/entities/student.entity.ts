export class Student {
  constructor(
    public id: string,
    public studentId: string,
    public firstName: string,
    public lastName: string,
    public nickName: string | undefined,
    public gender: string,
    public mobile: string,
    public email: string | undefined,
    public birthdate: string,
    public parentGuardian1: string | undefined,
    public parentGuardian2: string | undefined,
    public parent1CitizenId: string | undefined,
    public parent2CitizenId: string | undefined,
    public studentCitizenId: string | undefined,
    public relationship1: string | undefined,
    public relationship2: string | undefined,
    public otherPhone1: string | undefined,
    public otherPhone2: string | undefined,
    public description: string | undefined,
    public country: string | undefined,
    public province: string | undefined,
    public districtWard: string | undefined,
    public primaryAddress: string,
    public oldAddress: string | undefined,
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
