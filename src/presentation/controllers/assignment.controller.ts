/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import {
  CreateAssignmentDto,
  GradeSubmissionDto,
  SubmitAssignmentDto,
  UpdateAssignmentDto,
} from '../../application/dtos/assignment.dto';
import { Role } from '../../domain/value-objects/role.enum';
import { AssignmentAttachmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment-attachment.orm-entity';
import { AssignmentSubmissionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment-submission.orm-entity';
import { AssignmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/assignment.orm-entity';
import { ClassSessionOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { NotificationOrmEntity } from '../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { SubmissionAttachmentOrmEntity } from '../../infrastructure/persistence/typeorm/entities/submission-attachment.orm-entity';
import { TeacherOrmEntity } from '../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { JwtAuthGuard } from '../../infrastructure/security/jwt-auth.guard';
import { Roles } from '../../infrastructure/security/roles.decorator';
import { RolesGuard } from '../../infrastructure/security/roles.guard';
import {
  MinioService,
  StorageFile,
} from '../../infrastructure/storage/minio.service';

const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);
const filesOptions = {
  limits: { files: 10, fileSize: 15 * 1024 * 1024 },
  fileFilter: (
    _req: any,
    file: StorageFile,
    callback: (error: Error | null, accept: boolean) => void,
  ) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      callback(
        new BadRequestException('Chỉ chấp nhận PDF, JPEG, PNG hoặc WebP'),
        false,
      );
      return;
    }
    callback(null, true);
  },
};

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentController {
  constructor(
    @InjectRepository(AssignmentOrmEntity)
    private readonly assignmentRepo: Repository<AssignmentOrmEntity>,
    @InjectRepository(AssignmentAttachmentOrmEntity)
    private readonly attachmentRepo: Repository<AssignmentAttachmentOrmEntity>,
    @InjectRepository(AssignmentSubmissionOrmEntity)
    private readonly submissionRepo: Repository<AssignmentSubmissionOrmEntity>,
    @InjectRepository(SubmissionAttachmentOrmEntity)
    private readonly submissionAttachmentRepo: Repository<SubmissionAttachmentOrmEntity>,
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
    @InjectRepository(NotificationOrmEntity)
    private readonly notificationRepo: Repository<NotificationOrmEntity>,
    private readonly minioService: MinioService,
  ) {}

  @Get('teacher/summary')
  @Roles(Role.TEACHER)
  async teacherSummary(@Request() req: any) {
    const assignments: any[] = await this.getTeacherAssignments(req.user.sub);
    return {
      totalAssignments: assignments.length,
      submittedCount: assignments.reduce(
        (sum, item) => sum + item.submittedCount,
        0,
      ),
      pendingGradeCount: assignments.reduce(
        (sum, item) => sum + item.pendingGradeCount,
        0,
      ),
      gradedCount: assignments.reduce((sum, item) => sum + item.gradedCount, 0),
    };
  }

  @Get('teacher')
  @Roles(Role.TEACHER)
  async teacherAssignments(@Request() req: any) {
    return { assignments: await this.getTeacherAssignments(req.user.sub) };
  }

  @Get('admin')
  @Roles(Role.ADMIN)
  async adminAssignments() {
    return { assignments: await this.listAssignments() };
  }

  @Get('student')
  @Roles(Role.STUDENT)
  async studentAssignments(@Request() req: any) {
    const student = await this.getStudentByUser(req.user.sub);
    const activeEnrollments = await this.classStudentRepo.find({
      where: { studentId: student.id, status: 'Active' },
    });
    const classIds = activeEnrollments.map((item) => item.classId);
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.classEntity', 'classEntity')
      .leftJoinAndSelect('classEntity.course', 'course')
      .where(
        new Brackets((sub) => {
          if (classIds.length > 0) {
            sub.where(
              '(assignment.status = :published AND assignment.class_id IN (:...classIds))',
              { published: 'published', classIds },
            );
          } else {
            sub.where('1 = 0');
          }
          sub.orWhere(
            `EXISTS (
          SELECT 1 FROM assignment_submissions submission
          WHERE submission.assignment_id = assignment.id AND submission.student_id = :studentId
        )`,
            { studentId: student.id },
          );
        }),
      )
      .orderBy('assignment.due_at', 'ASC', 'NULLS LAST');
    const assignments = await qb.getMany();
    const submissions = assignments.length
      ? await this.submissionRepo.find({
          where: {
            assignmentId: In(assignments.map((item) => item.id)),
            studentId: student.id,
          },
        })
      : [];
    return {
      assignments: await Promise.all(
        assignments.map(async (assignment) => ({
          ...assignment,
          maxScore: Number(assignment.maxScore),
          submission:
            submissions.find((item) => item.assignmentId === assignment.id) ||
            null,
          attachments: await this.getAssignmentAttachments(assignment.id),
        })),
      ),
    };
  }

  @Get('class/:classId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async getClassAssignments(
    @Request() req: any,
    @Param('classId') classId: string,
  ) {
    if (req.user.role !== Role.ADMIN) {
      await this.assertCanManageClass(req.user, classId);
    }
    return { assignments: await this.listAssignments([classId]) };
  }

  @Post('class/:classId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async create(
    @Request() req: any,
    @Param('classId') classId: string,
    @Body() dto: CreateAssignmentDto,
  ) {
    const teacher = await this.assertCanManageClass(req.user, classId);
    const assignment = this.assignmentRepo.create({
      classId,
      createdByTeacherId: teacher?.id || null,
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      dueAt: dto.dueAt ? new Date(dto.dueAt) : null,
      maxScore: dto.maxScore || 10,
      status: dto.status || 'draft',
      publishedAt: dto.status === 'published' ? new Date() : null,
    });
    this.validateDueDate(assignment.dueAt);
    const saved = await this.assignmentRepo.save(assignment);
    if (saved.status === 'published') await this.notifyClass(saved);
    return saved;
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateAssignmentDto,
  ) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.assertCanManageClass(req.user, assignment.classId);
    const wasPublished = assignment.status === 'published';
    if (dto.status === 'draft' && assignment.status !== 'draft') {
      throw new BadRequestException(
        'Không thể chuyển bài đã giao hoặc đã đóng về bản nháp',
      );
    }
    if (
      assignment.status === 'closed' &&
      dto.status &&
      dto.status !== 'closed'
    ) {
      throw new BadRequestException('Bài tập đã đóng không thể mở lại');
    }
    if (dto.title !== undefined) assignment.title = dto.title.trim();
    if (dto.description !== undefined)
      assignment.description = dto.description.trim() || null;
    if (dto.dueAt !== undefined)
      assignment.dueAt = dto.dueAt ? new Date(dto.dueAt) : null;
    if (dto.maxScore !== undefined) assignment.maxScore = dto.maxScore;
    if (dto.status !== undefined) assignment.status = dto.status;
    this.validateDueDate(assignment.dueAt, assignment.status !== 'published');
    if (!wasPublished && assignment.status === 'published')
      assignment.publishedAt = new Date();
    const saved = await this.assignmentRepo.save(assignment);
    if (!wasPublished && saved.status === 'published')
      await this.notifyClass(saved);
    return saved;
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.TEACHER)
  async remove(@Request() req: any, @Param('id') id: string) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.assertCanManageClass(req.user, assignment.classId);
    if (assignment.status !== 'draft') {
      throw new BadRequestException(
        'Chỉ được xóa bài tập đang ở trạng thái nháp',
      );
    }
    const attachments = await this.attachmentRepo.find({
      where: { assignmentId: id },
    });
    await this.assignmentRepo.remove(assignment);
    await Promise.all(
      attachments.map((file) =>
        this.minioService.removeFile(file.objectKey).catch(() => undefined),
      ),
    );
    return { success: true };
  }

  @Post(':id/attachments')
  @Roles(Role.ADMIN, Role.TEACHER)
  @UseInterceptors(FilesInterceptor('files', 10, filesOptions))
  async addAttachments(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFiles() files: StorageFile[],
  ) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.assertCanManageClass(req.user, assignment.classId);
    if (!files?.length) throw new BadRequestException('Chưa chọn file');
    const currentCount = await this.attachmentRepo.count({
      where: { assignmentId: id },
    });
    if (currentCount + files.length > 10)
      throw new BadRequestException('Mỗi bài tập tối đa 10 file');
    for (const file of files) {
      const objectKey = await this.minioService.uploadFile(
        file,
        `assignments/${id}`,
      );
      await this.attachmentRepo.save(
        this.attachmentRepo.create({
          assignmentId: id,
          objectKey,
          fileName: file.originalname,
          mimeType: file.mimetype,
          fileSize: file.size,
        }),
      );
    }
    return { attachments: await this.getAssignmentAttachments(id) };
  }

  @Delete(':id/attachments/:attachmentId')
  @Roles(Role.ADMIN, Role.TEACHER)
  async removeAttachment(
    @Request() req: any,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
  ) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    const attachment = await this.attachmentRepo.findOne({
      where: { id: attachmentId, assignmentId: id },
    });
    if (!assignment || !attachment)
      throw new NotFoundException('Không tìm thấy file');
    await this.assertCanManageClass(req.user, assignment.classId);
    await this.attachmentRepo.remove(attachment);
    await this.minioService
      .removeFile(attachment.objectKey)
      .catch(() => undefined);
    return { success: true };
  }

  @Get(':id/submissions')
  @Roles(Role.ADMIN, Role.TEACHER)
  async submissions(@Request() req: any, @Param('id') id: string) {
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment) throw new NotFoundException('Không tìm thấy bài tập');
    await this.assertCanManageClass(req.user, assignment.classId);
    const [enrollments, submissions] = await Promise.all([
      this.classStudentRepo.find({
        where: { classId: assignment.classId },
        relations: { student: true },
      }),
      this.submissionRepo.find({
        where: { assignmentId: id },
        relations: { student: true },
        order: { submittedAt: 'DESC' },
      }),
    ]);
    const resultList: any[] = [];
    for (const enrollment of enrollments) {
      const student = enrollment.student;
      const studentSubmissions = submissions.filter(
        (item) => item.studentId === student.id,
      );

      if (studentSubmissions.length > 0) {
        for (const submission of studentSubmissions) {
          resultList.push({
            id: submission.id,
            studentId: student.id,
            studentCode: student.studentId,
            studentName: `${student.lastName} ${student.firstName}`.trim(),
            status: submission.status,
            answerText: submission.answerText,
            submittedAt: submission.submittedAt,
            score:
              submission.score === null || submission.score === undefined
                ? null
                : Number(submission.score),
            feedback: submission.feedback,
            attachments: await this.getSubmissionAttachments(submission.id),
            enrollmentStatus: enrollment.status,
          });
        }
      } else {
        resultList.push({
          id: `not-submitted-${student.id}`,
          studentId: student.id,
          studentCode: student.studentId,
          studentName: `${student.lastName} ${student.firstName}`.trim(),
          status: 'not_submitted',
          answerText: null,
          submittedAt: null,
          score: null,
          feedback: null,
          attachments: [],
          enrollmentStatus: enrollment.status,
        });
      }
    }

    return { submissions: resultList };
  }

  @Post(':id/submit')
  @Roles(Role.STUDENT)
  @UseInterceptors(FilesInterceptor('files', 10, filesOptions))
  async submit(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: SubmitAssignmentDto,
    @UploadedFiles() files: StorageFile[],
  ) {
    const student = await this.getStudentByUser(req.user.sub);
    const assignment = await this.assignmentRepo.findOne({ where: { id } });
    if (!assignment || assignment.status === 'draft')
      throw new NotFoundException('Không tìm thấy bài tập');
    if (assignment.status === 'closed')
      throw new BadRequestException('Bài tập đã đóng');
    const enrollment = await this.classStudentRepo.findOne({
      where: {
        classId: assignment.classId,
        studentId: student.id,
        status: 'Active',
      },
    });
    if (!enrollment)
      throw new ForbiddenException(
        'Bạn không còn là học sinh đang học của lớp này',
      );
    if (!dto.answerText?.trim() && !files?.length)
      throw new BadRequestException('Bài nộp phải có nội dung hoặc file');

    const now = new Date();
    let submission = this.submissionRepo.create({
      assignmentId: id,
      studentId: student.id,
    });
    submission.answerText = dto.answerText?.trim() || null;
    submission.submittedAt = now;
    submission.status =
      assignment.dueAt && now > assignment.dueAt ? 'late' : 'submitted';
    submission.score = null;
    submission.feedback = null;
    submission.gradedAt = null;
    submission.gradedByTeacherId = null;
    submission = await this.submissionRepo.save(submission);

    if (files?.length) {
      for (const file of files) {
        const objectKey = await this.minioService.uploadFile(
          file,
          `submissions/${submission.id}`,
        );
        await this.submissionAttachmentRepo.save(
          this.submissionAttachmentRepo.create({
            submissionId: submission.id,
            objectKey,
            fileName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
          }),
        );
      }
    }
    return {
      ...submission,
      attachments: await this.getSubmissionAttachments(submission.id),
    };
  }

  @Patch('submissions/:submissionId/grade')
  @Roles(Role.ADMIN, Role.TEACHER)
  async grade(
    @Request() req: any,
    @Param('submissionId') submissionId: string,
    @Body() dto: GradeSubmissionDto,
  ) {
    const submission = await this.submissionRepo.findOne({
      where: { id: submissionId },
      relations: { assignment: true, student: true },
    });
    if (!submission) throw new NotFoundException('Không tìm thấy bài nộp');
    const teacher = await this.assertCanManageClass(
      req.user,
      submission.assignment.classId,
    );
    if (dto.score > Number(submission.assignment.maxScore)) {
      throw new BadRequestException(
        `Điểm không được vượt quá ${submission.assignment.maxScore}`,
      );
    }
    submission.score = dto.score;
    submission.feedback = dto.feedback?.trim() || null;
    submission.status = 'graded';
    submission.gradedAt = new Date();
    submission.gradedByTeacherId = teacher?.id || null;
    const saved = await this.submissionRepo.save(submission);
    if (submission.student.userId) {
      await this.notificationRepo.save(
        this.notificationRepo.create({
          userId: submission.student.userId,
          type: 'assignment_graded',
          title: 'Bài tập đã được chấm',
          message: `${submission.assignment.title}: ${dto.score}/${submission.assignment.maxScore} điểm`,
          linkPath: '/student/assignments',
          priority: 'important',
          metadata: {
            assignmentId: submission.assignmentId,
            submissionId: submission.id,
          },
        }),
      );
    }
    return saved;
  }

  private validateDueDate(dueAt: Date | null, allowPast = false) {
    if (!allowPast && dueAt && dueAt <= new Date())
      throw new BadRequestException('Hạn nộp phải ở tương lai');
  }

  private async getTeacherByUser(userId: string) {
    const teacher = await this.teacherRepo.findOne({ where: { userId } });
    if (!teacher)
      throw new ForbiddenException('Không tìm thấy hồ sơ giáo viên');
    return teacher;
  }

  private async getStudentByUser(userId: string) {
    const student = await this.studentRepo.findOne({ where: { userId } });
    if (!student) throw new ForbiddenException('Không tìm thấy hồ sơ học sinh');
    return student;
  }

  private async assertCanManageClass(
    user: any,
    classId: string,
  ): Promise<TeacherOrmEntity | null> {
    const classEntity = await this.classRepo.findOne({
      where: { id: classId },
    });
    if (!classEntity) throw new NotFoundException('Không tìm thấy lớp học');
    if (user.role === Role.ADMIN) return null;
    const teacher = await this.getTeacherByUser(user.sub);
    if (classEntity.mainTeacherId === teacher.id) return teacher;
    const sessionCount = await this.sessionRepo.count({
      where: { classId, teacherId: teacher.id },
    });
    if (!sessionCount)
      throw new ForbiddenException('Bạn không phụ trách lớp học này');
    return teacher;
  }

  private async getTeacherAssignments(userId: string): Promise<any[]> {
    const teacher = await this.getTeacherByUser(userId);
    const sessionRows = await this.sessionRepo
      .createQueryBuilder('session')
      .select('DISTINCT session.classId', 'classId')
      .where('session.teacherId = :teacherId', { teacherId: teacher.id })
      .getRawMany<{ classId: string }>();
    const mainClasses = await this.classRepo.find({
      where: { mainTeacherId: teacher.id },
      select: { id: true },
    });
    const classIds = Array.from(
      new Set([
        ...sessionRows.map((row) => row.classId),
        ...mainClasses.map((item) => item.id),
      ]),
    );
    return classIds.length ? this.listAssignments(classIds) : [];
  }

  private async listAssignments(classIds?: string[]): Promise<any[]> {
    const qb = this.assignmentRepo
      .createQueryBuilder('assignment')
      .leftJoinAndSelect('assignment.classEntity', 'classEntity')
      .orderBy('assignment.created_at', 'DESC');
    if (classIds)
      qb.where('assignment.class_id IN (:...classIds)', { classIds });
    const assignments = await qb.getMany();
    return Promise.all(
      assignments.map(async (assignment) => {
        const [activeEnrollments, submissions, attachments] = await Promise.all(
          [
            this.classStudentRepo.find({
              where: { classId: assignment.classId, status: 'Active' },
              select: { studentId: true },
            }),
            this.submissionRepo.find({
              where: { assignmentId: assignment.id },
            }),
            this.getAssignmentAttachments(assignment.id),
          ],
        );
        const totalStudents = new Set([
          ...activeEnrollments.map((item) => item.studentId),
          ...submissions.map((item) => item.studentId),
        ]).size;
        const submittedCount = submissions.length;
        const gradedCount = submissions.filter(
          (item) => item.status === 'graded',
        ).length;
        return {
          ...assignment,
          maxScore: Number(assignment.maxScore),
          className: assignment.classEntity.className,
          classCode: assignment.classEntity.classCode,
          totalStudents,
          submittedCount,
          gradedCount,
          pendingGradeCount: submittedCount - gradedCount,
          attachments,
        };
      }),
    );
  }

  private async notifyClass(assignment: AssignmentOrmEntity) {
    const enrollments = await this.classStudentRepo.find({
      where: { classId: assignment.classId, status: 'Active' },
      relations: { student: true },
    });
    const notifications = enrollments
      .filter((item) => item.student.userId)
      .map((item) =>
        this.notificationRepo.create({
          userId: item.student.userId!,
          type: 'assignment_published',
          title: 'Có bài tập mới',
          message: assignment.title,
          linkPath: '/student/assignments',
          priority: 'important',
          metadata: { assignmentId: assignment.id, classId: assignment.classId },
        }),
      );
    if (notifications.length) await this.notificationRepo.save(notifications);
  }

  private async getAssignmentAttachments(assignmentId: string) {
    const attachments = await this.attachmentRepo.find({
      where: { assignmentId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(
      attachments.map(async (item) => ({
        ...item,
        fileSize: Number(item.fileSize),
        url: await this.minioService.getPresignedUrl(item.objectKey),
      })),
    );
  }

  private async getSubmissionAttachments(submissionId: string) {
    const attachments = await this.submissionAttachmentRepo.find({
      where: { submissionId },
      order: { createdAt: 'ASC' },
    });
    return Promise.all(
      attachments.map(async (item) => ({
        ...item,
        fileSize: Number(item.fileSize),
        url: await this.minioService.getPresignedUrl(item.objectKey),
      })),
    );
  }
}
