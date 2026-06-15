import {
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CreateHolidayDto,
  UpdateHolidayDto,
} from '../../application/dtos/holiday.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import {
  DeleteHolidayUseCase,
  ListHolidaysUseCase,
  SaveHolidayUseCase,
} from '../../modules/academics/application/use-cases/manage-holidays.use-cases';

@Controller('holidays')
@UseGuards(JwtAuthGuard, RolesGuard)
export class HolidayController {
  constructor(
    private readonly listHolidays: ListHolidaysUseCase,
    private readonly saveHoliday: SaveHolidayUseCase,
    private readonly deleteHoliday: DeleteHolidayUseCase,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  findAll(@Query('from') from?: string, @Query('to') to?: string) {
    return this.listHolidays.execute(from, to);
  }

  @Post()
  @Roles(Role.ADMIN)
  async create(@Body() dto: CreateHolidayDto) {
    return this.handle(() =>
      this.saveHoliday.execute({
        date: dto.date,
        name: dto.name,
        description: dto.description,
      }),
    );
  }

  @Put(':id')
  @Roles(Role.ADMIN)
  async update(@Param('id') id: string, @Body() dto: UpdateHolidayDto) {
    const current = await this.listHolidays.execute();
    const holiday = current.find((item) => item.id === id);
    if (!holiday) throw new NotFoundException('Không tìm thấy ngày nghỉ.');
    return this.handle(() =>
      this.saveHoliday.execute({
        id,
        date: dto.date ?? holiday.date,
        name: dto.name ?? holiday.name,
        description:
          dto.description === undefined ? holiday.description : dto.description,
      }),
    );
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  async remove(@Param('id') id: string) {
    await this.handle(() => this.deleteHoliday.execute(id));
    return { message: 'Đã xóa ngày nghỉ.' };
  }

  private async handle<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      if (!(error instanceof Error)) throw error;
      if (error.message === 'HOLIDAY_NOT_FOUND') {
        throw new NotFoundException('Không tìm thấy ngày nghỉ.');
      }
      if (error.message === 'HOLIDAY_DATE_EXISTS') {
        throw new ConflictException('Ngày này đã được cài đặt là ngày nghỉ.');
      }
      throw error;
    }
  }
}
