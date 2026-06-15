import { Injectable } from '@nestjs/common';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { ClassSessionOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-session.orm-entity';
import { ClassStudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class-student.orm-entity';
import { ClassOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/class.orm-entity';
import { LeaveRequestOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/leave-request.orm-entity';
import { NotificationOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/notification.orm-entity';
import { StudentAttendanceOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-attendance.orm-entity';
import { StudentOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student.orm-entity';
import { TeacherOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/teacher.orm-entity';
import { LeaveRequest } from '../../domain/entities/leave-request';
import { LeaveRequestError } from '../../domain/errors/leave-request.error';
import {
  LeaveRequestListFilter,
  LeaveRequestPersistencePort,
  LeaveRequestView,
  LeaveSessionDetails,
} from '../../application/ports/leave-request-persistence.port';
import { LeaveRequestMapper } from './leave-request.mapper';

@Injectable()
export class TypeOrmLeaveRequestPersistenceAdapter implements LeaveRequestPersistencePort {
  constructor(private readonly dataSource: DataSource) {}

  async findStudentIdByUserId(userId: string): Promise<string | null> {
    const student = await this.repository(StudentOrmEntity).findOne({
      where: { userId },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  async findSession(sessionId: string): Promise<LeaveSessionDetails | null> {
    const session = await this.repository(ClassSessionOrmEntity).findOne({
      where: { id: sessionId },
      relations: { classEntity: true },
    });
    if (!session) return null;
    return {
      id: session.id,
      classId: session.classId,
      className: session.classEntity.className,
      date: session.date,
      startTime: session.startTime,
      endTime: session.endTime,
      status: session.status,
      attendanceLocked: session.attendanceLocked,
      teacherId: session.teacherId,
      mainTeacherId: session.classEntity.mainTeacherId,
    };
  }

  async isStudentEnrolled(
    classId: string,
    studentId: string,
  ): Promise<boolean> {
    return (
      (await this.repository(ClassStudentOrmEntity).count({
        where: { classId, studentId, status: 'Active' },
      })) > 0
    );
  }

  async hasActiveRequest(
    sessionId: string,
    studentId: string,
  ): Promise<boolean> {
    return (
      (await this.repository(LeaveRequestOrmEntity).count({
        where: {
          classSessionId: sessionId,
          studentId,
          status: In(['pending', 'approved']),
        },
      })) > 0
    );
  }

  async findById(id: string): Promise<LeaveRequest | null> {
    const entity = await this.repository(LeaveRequestOrmEntity).findOneBy({
      id,
    });
    return entity ? LeaveRequestMapper.toDomain(entity) : null;
  }

  async findViewById(id: string): Promise<LeaveRequestView | null> {
    const views = await this.buildViewQuery()
      .andWhere('leave.id = :id', { id })
      .getMany();
    return views[0] ? this.toView(views[0]) : null;
  }

  async listForStudent(
    studentId: string,
    filter: LeaveRequestListFilter,
  ): Promise<LeaveRequestView[]> {
    const query = this.buildViewQuery().andWhere(
      'leave.student_id = :studentId',
      { studentId },
    );
    this.applyFilter(query, filter);
    return (await query.getMany()).map((entity) => this.toView(entity));
  }

  async listForManager(
    actorUserId: string,
    actorRole: string,
    filter: LeaveRequestListFilter,
  ): Promise<LeaveRequestView[]> {
    const query = this.buildViewQuery();
    if (actorRole !== 'ADMIN') {
      const classIds = await this.findManagedClassIds(actorUserId);
      if (!classIds.length) return [];
      query.andWhere('session.class_id IN (:...classIds)', { classIds });
    }
    this.applyFilter(query, filter);
    return (await query.getMany()).map((entity) => this.toView(entity));
  }

  async canManageClass(
    actorUserId: string,
    actorRole: string,
    classId: string,
  ): Promise<boolean> {
    if (actorRole === 'ADMIN') return true;
    const teacher = await this.repository(TeacherOrmEntity).findOne({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!teacher) return false;
    const classEntity = await this.repository(ClassOrmEntity).findOne({
      where: { id: classId },
      select: { mainTeacherId: true },
    });
    if (classEntity?.mainTeacherId === teacher.id) return true;
    return (
      (await this.repository(ClassSessionOrmEntity).count({
        where: { classId, teacherId: teacher.id },
      })) > 0
    );
  }

  async saveSubmitted(
    request: LeaveRequest,
    session: LeaveSessionDetails,
  ): Promise<LeaveRequest> {
    return this.dataSource.transaction(async (manager) => {
      const saved = await manager
        .getRepository(LeaveRequestOrmEntity)
        .save(LeaveRequestMapper.toOrm(request));
      await this.notifyTeachers(manager, request, session);
      return LeaveRequestMapper.toDomain(saved);
    });
  }

  async saveDecision(
    request: LeaveRequest,
    session: LeaveSessionDetails,
  ): Promise<LeaveRequest> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(LeaveRequestOrmEntity);
      const existing = await repository.findOne({
        where: { id: request.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing) {
        throw new LeaveRequestError(
          'LEAVE_REQUEST_NOT_FOUND',
          'Không tìm thấy đơn xin nghỉ.',
        );
      }
      this.assertPending(existing);
      const saved = await repository.save(
        LeaveRequestMapper.toOrm(request, existing),
      );

      if (request.status === 'approved') {
        const attendanceRepo = manager.getRepository(
          StudentAttendanceOrmEntity,
        );
        let attendance = await attendanceRepo.findOne({
          where: {
            classSessionId: request.classSessionId,
            studentId: request.studentId,
          },
        });
        attendance ??= attendanceRepo.create({
          classSessionId: request.classSessionId,
          studentId: request.studentId,
        });
        attendance.isPresent = false;
        attendance.reason = `Nghỉ có phép: ${request.reason}`;
        await attendanceRepo.save(attendance);
      }

      await this.notifyStudent(manager, request, session);
      return LeaveRequestMapper.toDomain(saved);
    });
  }

  async saveCancellation(request: LeaveRequest): Promise<LeaveRequest> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(LeaveRequestOrmEntity);
      const existing = await repository.findOne({
        where: { id: request.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!existing) {
        throw new LeaveRequestError(
          'LEAVE_REQUEST_NOT_FOUND',
          'Không tìm thấy đơn xin nghỉ.',
        );
      }
      this.assertPending(existing);
      return LeaveRequestMapper.toDomain(
        await repository.save(LeaveRequestMapper.toOrm(request, existing)),
      );
    });
  }

  private repository<T extends object>(entity: new () => T): Repository<T> {
    return this.dataSource.getRepository(entity);
  }

  private buildViewQuery() {
    return this.repository(LeaveRequestOrmEntity)
      .createQueryBuilder('leave')
      .innerJoinAndSelect('leave.student', 'student')
      .innerJoinAndSelect('leave.classSession', 'session')
      .innerJoinAndSelect('session.classEntity', 'classEntity')
      .orderBy('leave.submitted_at', 'DESC');
  }

  private applyFilter(
    query: ReturnType<TypeOrmLeaveRequestPersistenceAdapter['buildViewQuery']>,
    filter: LeaveRequestListFilter,
  ) {
    if (filter.status) {
      query.andWhere('leave.status = :status', { status: filter.status });
    }
    if (filter.classId) {
      query.andWhere('session.class_id = :classId', {
        classId: filter.classId,
      });
    }
  }

  private toView(entity: LeaveRequestOrmEntity): LeaveRequestView {
    return {
      id: entity.id,
      studentId: entity.studentId,
      studentCode: entity.student.studentId,
      studentName:
        `${entity.student.lastName} ${entity.student.firstName}`.trim(),
      classSessionId: entity.classSessionId,
      classId: entity.classSession.classId,
      className: entity.classSession.classEntity.className,
      sessionDate: entity.classSession.date,
      startTime: entity.classSession.startTime,
      endTime: entity.classSession.endTime,
      reason: entity.reason,
      status: entity.status as LeaveRequestView['status'],
      submittedAt: entity.submittedAt,
      reviewedAt: entity.reviewedAt,
      reviewedByUserId: entity.reviewedByUserId,
      reviewNote: entity.reviewNote,
      cancelledAt: entity.cancelledAt,
    };
  }

  private async findManagedClassIds(actorUserId: string): Promise<string[]> {
    const teacher = await this.repository(TeacherOrmEntity).findOne({
      where: { userId: actorUserId },
      select: { id: true },
    });
    if (!teacher) return [];
    const [mainClasses, sessionRows] = await Promise.all([
      this.repository(ClassOrmEntity).find({
        where: { mainTeacherId: teacher.id },
        select: { id: true },
      }),
      this.repository(ClassSessionOrmEntity)
        .createQueryBuilder('session')
        .select('DISTINCT session.class_id', 'classId')
        .where('session.teacher_id = :teacherId', { teacherId: teacher.id })
        .getRawMany<{ classId: string }>(),
    ]);
    return Array.from(
      new Set([
        ...mainClasses.map((item) => item.id),
        ...sessionRows.map((item) => item.classId),
      ]),
    );
  }

  private async notifyTeachers(
    manager: EntityManager,
    request: LeaveRequest,
    session: LeaveSessionDetails,
  ) {
    const teacherIds = Array.from(
      new Set(
        [session.teacherId, session.mainTeacherId].filter((id): id is string =>
          Boolean(id),
        ),
      ),
    );
    if (!teacherIds.length) return;
    const teachers = await manager.getRepository(TeacherOrmEntity).find({
      where: { id: In(teacherIds) },
      select: { userId: true },
    });
    const userIds = Array.from(
      new Set(
        teachers
          .map((teacher) => teacher.userId)
          .filter((id): id is string => Boolean(id)),
      ),
    );
    if (!userIds.length) return;
    await manager.getRepository(NotificationOrmEntity).save(
      userIds.map((userId) =>
        manager.getRepository(NotificationOrmEntity).create({
          userId,
          type: 'leave_request_submitted',
          title: 'Có đơn xin nghỉ mới',
          message: `${session.className} - ${session.date}`,
          linkPath: '/teacher/leave-requests',
        }),
      ),
    );
  }

  private async notifyStudent(
    manager: EntityManager,
    request: LeaveRequest,
    session: LeaveSessionDetails,
  ) {
    const student = await manager.getRepository(StudentOrmEntity).findOne({
      where: { id: request.studentId },
      select: { userId: true },
    });
    if (!student?.userId) return;
    const approved = request.status === 'approved';
    await manager.getRepository(NotificationOrmEntity).save(
      manager.getRepository(NotificationOrmEntity).create({
        userId: student.userId,
        type: approved ? 'leave_request_approved' : 'leave_request_rejected',
        title: approved
          ? 'Đơn xin nghỉ đã được duyệt'
          : 'Đơn xin nghỉ đã bị từ chối',
        message: `${session.className} - ${session.date}`,
        linkPath: '/student/leave-requests',
      }),
    );
  }

  private assertPending(entity: LeaveRequestOrmEntity) {
    if (entity.status !== 'pending') {
      throw new LeaveRequestError(
        'LEAVE_REQUEST_NOT_PENDING',
        'Chỉ có thể xử lý đơn xin nghỉ đang chờ duyệt.',
      );
    }
  }
}
