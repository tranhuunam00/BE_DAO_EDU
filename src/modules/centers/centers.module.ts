import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddCenterUseCase } from '../../application/use-cases/add-center.use-case';
import { GetCenterByIdUseCase } from '../../application/use-cases/get-center-by-id.use-case';
import { GetCentersUseCase } from '../../application/use-cases/get-centers.use-case';
import { UpdateCenterUseCase } from '../../application/use-cases/update-center.use-case';
import { ICenterRepository } from '../../domain/repositories/center-repository.interface';
import { CenterOrmEntity } from '../../infrastructure/persistence/typeorm/entities/center.orm-entity';
import { RoomOrmEntity } from '../../infrastructure/persistence/typeorm/entities/room.orm-entity';
import { TypeOrmCenterRepository } from '../../infrastructure/persistence/typeorm/repositories/typeorm-center.repository';
import { CenterController } from '../../presentation/controllers/center.controller';
import { RoomController } from '../../presentation/controllers/room.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CenterOrmEntity, RoomOrmEntity])],
  controllers: [CenterController, RoomController],
  providers: [
    AddCenterUseCase,
    GetCentersUseCase,
    GetCenterByIdUseCase,
    UpdateCenterUseCase,
    { provide: ICenterRepository, useClass: TypeOrmCenterRepository },
  ],
})
export class CentersModule {}
