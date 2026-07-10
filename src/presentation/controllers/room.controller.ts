import { Controller, Get, Post, Put, Body, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RoomOrmEntity } from '../../infrastructure/persistence/typeorm/entities/room.orm-entity';

@ApiTags('Rooms')
@Controller('rooms')
export class RoomController {
  constructor(
    @InjectRepository(RoomOrmEntity)
    private readonly roomRepo: Repository<RoomOrmEntity>,
  ) {}



  @Get()
  @ApiOperation({ summary: 'Lấy danh sách phòng học' })
  async findAll(@Query('centerId') centerId?: string, @Query('status') status?: string) {
    const where: any = {};
    if (centerId) where.centerId = centerId;
    if (status) where.status = status;
    return this.roomRepo.find({ where, order: { name: 'ASC' } });
  }

  @Post()
  @ApiOperation({ summary: 'Tạo phòng học mới' })
  async create(@Body() body: { centerId: string; name: string; capacity?: number }) {
    const room = this.roomRepo.create({
      centerId: body.centerId,
      name: body.name,
      capacity: body.capacity || 30,
      status: 'Active',
    });
    return this.roomRepo.save(room);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật phòng học' })
  async update(@Param('id') id: string, @Body() body: { name?: string; capacity?: number; status?: string }) {
    const room = await this.roomRepo.findOneOrFail({ where: { id } });
    if (body.name !== undefined) room.name = body.name;
    if (body.capacity !== undefined) room.capacity = body.capacity;
    if (body.status !== undefined) room.status = body.status;
    return this.roomRepo.save(room);
  }
}
