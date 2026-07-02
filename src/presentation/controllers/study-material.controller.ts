import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StudyMaterialOrmEntity } from '../../infrastructure/persistence/typeorm/entities/study-material.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { Role } from '../../domain/value-objects/role.enum';
import { MinioService, StorageFile } from '../../infrastructure/storage/minio.service';

const allowedMimeTypes = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
  'application/x-zip-compressed',
]);

const filesOptions = {
  limits: { files: 1, fileSize: 30 * 1024 * 1024 },
  fileFilter: (
    _req: any,
    file: StorageFile,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new BadRequestException('Định dạng tài liệu không hỗ trợ. Chấp nhận PDF, Word, Excel, PowerPoint, ZIP hoặc hình ảnh.'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

@ApiTags('Study Materials')
@ApiBearerAuth()
@Controller('study-materials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StudyMaterialController {
  constructor(
    @InjectRepository(StudyMaterialOrmEntity)
    private readonly materialRepo: Repository<StudyMaterialOrmEntity>,
    @InjectRepository(ClassOrmEntity)
    private readonly classRepo: Repository<ClassOrmEntity>,
    @InjectRepository(ClassStudentOrmEntity)
    private readonly classStudentRepo: Repository<ClassStudentOrmEntity>,
    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,
    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepo: Repository<TeacherOrmEntity>,
    @InjectRepository(StudentOrmEntity)
    private readonly studentRepo: Repository<StudentOrmEntity>,
    private readonly minioService: MinioService,
  ) {}

  @Get('my-classes')
  async getMyClasses(@Request() req: any) {
    if (req.user.role === Role.ADMIN) {
      const classes = await this.classRepo.find({
        where: { status: 'Active' },
        order: { className: 'ASC' },
      });
      return classes;
    }

    if (req.user.role === Role.TEACHER) {
      const teacher = await this.teacherRepo.findOne({
        where: { userId: req.user.sub },
      });
      if (!teacher) return [];

      const mainClasses = await this.classRepo.find({
        where: { mainTeacherId: teacher.id, status: 'Active' },
      });

      const sessions = await this.sessionRepo
        .createQueryBuilder('s')
        .select('DISTINCT s.class_id', 'classId')
        .where('s.teacher_id = :teacherId', { teacherId: teacher.id })
        .getRawMany();
      const sessionClassIds = sessions.map((s) => s.classId).filter(Boolean);

      const allClassIds = new Set([
        ...mainClasses.map((c) => c.id),
        ...sessionClassIds,
      ]);

      if (allClassIds.size === 0) return [];

      const classes = await this.classRepo.createQueryBuilder('c')
        .where('c.id IN (:...ids)', { ids: Array.from(allClassIds) })
        .orderBy('c.class_name', 'ASC')
        .getMany();
      return classes;
    }

    if (req.user.role === Role.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: req.user.sub },
      });
      if (!student) return [];

      const classStudents = await this.classStudentRepo.find({
        where: { studentId: student.id, status: 'Active' },
        relations: { classEntity: true },
      });

      return classStudents
        .map((cs) => cs.classEntity)
        .filter((c) => c !== null && c.status === 'Active');
    }

    return [];
  }

  @Post()
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FileInterceptor('file', filesOptions))
  async uploadMaterial(
    @Request() req: any,
    @Body() body: { classId: string; title: string; description?: string },
    @UploadedFile() file: any,
  ) {
    if (!body.classId) throw new BadRequestException('classId là bắt buộc');
    if (!body.title) throw new BadRequestException('title là bắt buộc');
    if (!file) throw new BadRequestException('Chưa tải file lên');

    await this.assertCanAccessClass(req.user, body.classId);

    const objectKey = await this.minioService.uploadFile(
      file,
      `materials/${body.classId}`,
    );

    const material = this.materialRepo.create({
      classId: body.classId,
      title: body.title,
      description: body.description || null,
      fileName: file.originalname,
      objectKey,
      mimeType: file.mimetype,
      fileSize: file.size,
      uploadedByUserId: req.user.sub,
    });

    await this.materialRepo.save(material);
    return material;
  }

  @Get('class/:classId')
  async listMaterials(
    @Request() req: any,
    @Param('classId') classId: string,
  ) {
    await this.assertCanAccessClass(req.user, classId);

    const materials = await this.materialRepo.find({
      where: { classId },
      order: { createdAt: 'DESC' },
    });

    const results = [];
    for (const item of materials) {
      const url = await this.minioService.getPresignedUrl(item.objectKey);
      results.push({
        ...item,
        url,
      });
    }

    return results;
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  async deleteMaterial(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    const material = await this.materialRepo.findOne({ where: { id } });
    if (!material) throw new NotFoundException('Không tìm thấy tài liệu');

    if (req.user.role !== Role.ADMIN && material.uploadedByUserId !== req.user.sub) {
      throw new ForbiddenException('Bạn không có quyền xóa tài liệu này');
    }

    await this.minioService.removeFile(material.objectKey).catch(() => undefined);
    await this.materialRepo.remove(material);

    return { success: true };
  }

  private async assertCanAccessClass(user: any, classId: string) {
    if (user.role === Role.ADMIN) return;
    if (user.role === Role.TEACHER) {
      const teacher = await this.teacherRepo.findOne({
        where: { userId: user.sub },
      });
      if (!teacher) throw new ForbiddenException('Không tìm thấy thông tin giáo viên');
      
      const isMainTeacher = await this.classRepo.findOne({
        where: { id: classId, mainTeacherId: teacher.id },
      });
      if (isMainTeacher) return;

      const hasSession = await this.sessionRepo.findOne({
        where: { classId, teacherId: teacher.id },
      });
      if (hasSession) return;

      throw new ForbiddenException('Bạn không giảng dạy lớp học này');
    }

    if (user.role === Role.STUDENT) {
      const student = await this.studentRepo.findOne({
        where: { userId: user.sub },
      });
      if (!student) throw new ForbiddenException('Không tìm thấy thông tin học sinh');

      const isEnrolled = await this.classStudentRepo.findOne({
        where: { classId, studentId: student.id, status: 'Active' },
      });
      if (!isEnrolled) throw new ForbiddenException('Bạn không tham gia lớp học này');
      return;
    }

    throw new ForbiddenException('Không có quyền truy cập');
  }
}
