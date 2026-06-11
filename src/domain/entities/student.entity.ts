export class Student {
  constructor(
    public id: string,
    public firstName: string,
    public lastName: string,
    public nickName: string | undefined,
    public gender: string,
    public mobile: string,
    public email: string | undefined,
    public birthdate: string,
    public parentName: string | undefined,
    public relationship: string | undefined,
    public citizenId: string | undefined,
    public status: string, // e.g. "Waiting for class", "Studying", "Suspended"
    public primaryAddress: string,
    public description: string | undefined,
    public createdAt: Date = new Date(),
  ) {}

  getFullName(): string {
    return `${this.lastName} ${this.firstName}`.trim();
  }
}
