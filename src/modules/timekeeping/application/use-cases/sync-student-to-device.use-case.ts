import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';

@Injectable()
export class SyncStudentToDeviceUseCase {
  constructor(
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepository: Repository<StudentOrmEntity>,
  ) {}

  async execute(studentId: string, status?: boolean): Promise<boolean> {
    const student = await this.studentRepository.findOne({ where: { id: studentId } });
    if (!student) {
      throw new NotFoundException(`Học sinh không tồn tại trên hệ thống.`);
    }

    const newStatus = status !== undefined ? status : !student.isSyncedToDevice;
    student.isSyncedToDevice = newStatus;
    await this.studentRepository.save(student);
    return newStatus;
  }
}
