export class Center {
  constructor(
    public id: string,
    public centerId: string,
    public name: string,
    public phone: string | undefined,
    public email: string | undefined,
    public province: string | undefined,
    public districtWard: string | undefined,
    public primaryAddress: string | undefined,
    public managerName: string | undefined,
    public status: string,
    public createdAt: Date = new Date(),
    public updatedAt: Date = new Date(),
  ) {}
}
