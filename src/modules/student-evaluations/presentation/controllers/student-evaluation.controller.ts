import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtAuthGuard } from '../../../../infrastructure/security/jwt-auth.guard';
import { RolesGuard } from '../../../../infrastructure/security/roles.guard';
import { Roles } from '../../../../infrastructure/security/roles.decorator';
import { Role } from '../../../../domain/value-objects/role.enum';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { TeacherOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { GetSessionEvaluationsUseCase } from '../../application/use-cases/get-session-evaluations.use-case';
import { SaveSessionEvaluationsUseCase } from '../../application/use-cases/save-session-evaluations.use-case';
import { GenerateAiEvaluationCommentUseCase } from '../../application/use-cases/generate-ai-evaluation-comment.use-case';
import {
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../domain/entities/student-session-evaluation.entity';
import { SaveEvaluationsDto } from '../dtos/save-evaluations.dto';
import { GenerateCommentDto, GenerateBatchCommentDto } from '../dtos/generate-comment.dto';

import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';

@ApiTags('Student Evaluations (Đánh giá học sinh 1-chạm & AI)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('classes/sessions/:sessionId/evaluations')
export class StudentEvaluationController {
  constructor(
    private readonly getEvaluationsUseCase: GetSessionEvaluationsUseCase,
    private readonly saveEvaluationsUseCase: SaveSessionEvaluationsUseCase,
    private readonly generateCommentUseCase: GenerateAiEvaluationCommentUseCase,

    @InjectRepository(ClassSessionOrmEntity)
    private readonly sessionRepo: Repository<ClassSessionOrmEntity>,

    @InjectRepository(TeacherOrmEntity)
    private readonly teacherRepo: Repository<TeacherOrmEntity>,

    @InjectRepository(StudentAttendanceOrmEntity)
    private readonly attendanceRepo: Repository<StudentAttendanceOrmEntity>,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Lấy danh sách đánh giá học sinh của buổi học' })
  async getEvaluations(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    await this.validateSessionAccess(sessionId, req);
    const entities = await this.getEvaluationsUseCase.execute(sessionId);

    if (entities && entities.length > 0) {
      return entities.map((e) => {
        let homework: 'done' | 'missing' | 'none' | undefined = undefined;
        if (e.homeworkStatus === HomeworkStatus.COMPLETED) homework = 'done';
        else if (e.homeworkStatus === HomeworkStatus.NOT_DONE) homework = 'missing';

        let participation: 'active' | 'normal' | 'passive' | undefined = undefined;
        if (e.participation === ParticipationStatus.ACTIVE) participation = 'active';
        else if (e.participation === ParticipationStatus.PASSIVE) participation = 'passive';
        else if (e.participation) participation = 'normal';

        let understanding: 'quick' | 'normal' | 'slow' | undefined = undefined;
        if (e.understanding === UnderstandingStatus.UNDERSTOOD) understanding = 'quick';
        else if (e.understanding === UnderstandingStatus.NOT_UNDERSTOOD) understanding = 'slow';
        else if (e.understanding) understanding = 'normal';

        let behavior: 'good' | 'talkative' | 'unfocused' | undefined = undefined;
        if (e.behaviorTags?.includes(BehaviorTag.DISTRACTED)) behavior = 'unfocused';
        else if (e.behaviorTags?.includes(BehaviorTag.TALKATIVE)) behavior = 'talkative';
        else if (e.behaviorTags && e.behaviorTags.length > 0) behavior = 'good';

        return {
          id: e.id,
          classSessionId: e.classSessionId,
          studentId: e.studentId,
          teacherId: e.teacherId,
          homeworkStatus: e.homeworkStatus,
          participation: e.participation,
          understanding: e.understanding,
          behaviorTags: e.behaviorTags,
          score: e.score,
          comment: e.comment,
          evaluationScore: e.score,
          evaluationComment: e.comment,
          isAiGenerated: e.isAiGenerated,
          isApproved: e.isApproved,
          isApprovedByTeacher: e.isApproved,
          criteria: {
            homework,
            participation,
            understanding,
            behavior,
          },
          approvedAt: e.approvedAt,
          createdAt: e.createdAt,
          updatedAt: e.updatedAt,
        };
      });
    }

    // Fallback: Nếu bảng mới chưa có dữ liệu, đọc từ bảng điểm danh cũ
    const attendanceRecords = await this.attendanceRepo.find({
      where: { classSessionId: sessionId },
    });
    return attendanceRecords
      .filter((a) => a.evaluationComment || a.evaluationScore)
      .map((a) => ({
        id: a.id,
        classSessionId: a.classSessionId,
        studentId: a.studentId,
        evaluationScore: a.evaluationScore,
        evaluationComment: a.evaluationComment,
        score: a.evaluationScore,
        comment: a.evaluationComment,
        isAiGenerated: false,
        isApproved: false,
        isApprovedByTeacher: false,
        criteria: {},
        updatedAt: a.updatedAt,
      }));
  }

  @Post()
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Lưu và duyệt đánh giá 1-chạm cho buổi học' })
  async saveEvaluations(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: SaveEvaluationsDto,
  ) {
    const teacher = await this.validateSessionAccess(sessionId, req);
    const normalizedEvaluations = (dto.evaluations || []).map((e) => {
      let hw = e.homeworkStatus;
      let part = e.participation;
      let under = e.understanding;
      let tags = e.behaviorTags;

      if (e.criteria) {
        if (!hw && e.criteria.homework) {
          hw = e.criteria.homework === 'missing' ? HomeworkStatus.NOT_DONE : HomeworkStatus.COMPLETED;
        }
        if (!part && e.criteria.participation) {
          part = e.criteria.participation === 'passive' ? ParticipationStatus.PASSIVE : ParticipationStatus.ACTIVE;
        }
        if (!under && e.criteria.understanding) {
          under = e.criteria.understanding === 'slow' ? UnderstandingStatus.NOT_UNDERSTOOD : UnderstandingStatus.UNDERSTOOD;
        }
        if (!tags && e.criteria.behavior) {
          tags = e.criteria.behavior === 'talkative'
            ? [BehaviorTag.TALKATIVE]
            : e.criteria.behavior === 'unfocused'
            ? [BehaviorTag.DISTRACTED]
            : [BehaviorTag.ATTENTIVE];
        }
      }

      return {
        studentId: e.studentId,
        homeworkStatus: hw,
        participation: part,
        understanding: under,
        behaviorTags: tags,
        score: e.score !== undefined ? e.score : (e.evaluationScore ?? null),
        comment: e.comment !== undefined ? e.comment : (e.evaluationComment ?? null),
        isAiGenerated: e.isAiGenerated,
        isApproved: e.isApproved !== undefined ? e.isApproved : (e.isApprovedByTeacher ?? false),
      };
    });

    const result = await this.saveEvaluationsUseCase.execute({
      classSessionId: sessionId,
      teacherId: teacher?.id || null,
      evaluations: normalizedEvaluations,
    });

    // Đồng bộ sang bảng student_attendance để bảo đảm tương thích ngược
    try {
      for (const item of normalizedEvaluations) {
        const att = await this.attendanceRepo.findOne({
          where: { classSessionId: sessionId, studentId: item.studentId },
        });
        if (att) {
          att.evaluationScore = item.score ?? null;
          att.evaluationComment = item.comment ?? null;
          await this.attendanceRepo.save(att);
        }
      }
    } catch {
      // Non-blocking sync
    }

    return {
      success: true,
      message: `Đã lưu thành công đánh giá cho ${result.savedCount} học sinh`,
      savedCount: result.savedCount,
    };
  }

  @Post('generate-comment')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Sinh nhận xét sư phạm bằng AI cho 1 học sinh' })
  async generateComment(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateCommentDto,
  ) {
    const teacher = await this.validateSessionAccess(sessionId, req);
    const item = this.normalizeGenerateItem(dto, teacher?.id);
    return this.generateCommentUseCase.execute(item);
  }

  @Post('generate-comment-batch')
  @Roles(Role.ADMIN, Role.TEACHER)
  @ApiOperation({ summary: 'Sinh nhận xét sư phạm bằng AI hàng loạt cho cả lớp (tối đa 50)' })
  async generateCommentBatch(
    @Request() req: any,
    @Param('sessionId') sessionId: string,
    @Body() dto: GenerateBatchCommentDto,
  ) {
    const teacher = await this.validateSessionAccess(sessionId, req);
    const rawList = dto.items || dto.students || [];
    const items = rawList.map((it) => this.normalizeGenerateItem(it, teacher?.id));
    const results = await this.generateCommentUseCase.executeBatch(items);
    return { results };
  }

  private normalizeGenerateItem(it: GenerateCommentDto, teacherId?: string) {
    let hw = it.homeworkStatus;
    let part = it.participation;
    let under = it.understanding;
    let tags = it.behaviorTags;

    if (it.criteria) {
      if (!hw && it.criteria.homework) {
        hw = it.criteria.homework === 'missing' ? HomeworkStatus.NOT_DONE : HomeworkStatus.COMPLETED;
      }
      if (!part && it.criteria.participation) {
        part = it.criteria.participation === 'passive' ? ParticipationStatus.PASSIVE : ParticipationStatus.ACTIVE;
      }
      if (!under && it.criteria.understanding) {
        under = it.criteria.understanding === 'slow' ? UnderstandingStatus.NOT_UNDERSTOOD : UnderstandingStatus.UNDERSTOOD;
      }
      if (!tags && it.criteria.behavior) {
        tags = it.criteria.behavior === 'talkative'
          ? [BehaviorTag.TALKATIVE]
          : it.criteria.behavior === 'unfocused'
          ? [BehaviorTag.DISTRACTED]
          : [BehaviorTag.ATTENTIVE];
      }
    }

    return {
      studentId: it.studentId,
      studentName: it.studentName,
      homeworkStatus: hw,
      participation: part,
      understanding: under,
      behaviorTags: tags,
      score: it.score,
      teacherId,
    };
  }

  private async validateSessionAccess(sessionId: string, req: any): Promise<TeacherOrmEntity | null> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: { classEntity: true },
    });

    if (!session) {
      throw new NotFoundException('Không tìm thấy thông tin buổi học');
    }

    const userRoles = req?.user?.roles || [req?.user?.role];
    const isAdmin = userRoles.includes(Role.ADMIN) || req?.user?.role === Role.ADMIN;

    if (isAdmin) {
      return null;
    }

    const teacher = await this.teacherRepo.findOne({
      where: { userId: req?.user?.sub },
    });

    if (!teacher) {
      throw new ForbiddenException('Không tìm thấy thông tin giáo viên của bạn');
    }

    const isSessionTeacher = session.teacherId === teacher.id;
    const isMainTeacher = session.classEntity?.mainTeacherId === teacher.id;
    const isSessionAssistant = session.assistantId === teacher.id;

    if (!isSessionTeacher && !isMainTeacher && !isSessionAssistant) {
      throw new ForbiddenException(
        'Bạn không phải giáo viên được phân công giảng dạy cho buổi học này',
      );
    }

    return teacher;
  }
}
