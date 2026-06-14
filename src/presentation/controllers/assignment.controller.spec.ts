/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AssignmentController } from './assignment.controller';
import { Role } from '../../domain/value-objects/role.enum';

describe('AssignmentController edge cases', () => {
  const createController = (overrides: Record<string, any> = {}) => {
    const repos = {
      assignmentRepo: {
        findOne: jest.fn(),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ id: 'assignment-1', ...value })),
        remove: jest.fn(),
      },
      attachmentRepo: {
        count: jest.fn(),
        find: jest.fn().mockResolvedValue([]),
      },
      submissionRepo: {
        findOne: jest.fn(),
        create: jest.fn((value) => value),
        save: jest.fn(async (value) => ({ id: 'submission-1', ...value })),
      },
      submissionAttachmentRepo: {
        find: jest.fn().mockResolvedValue([]),
        remove: jest.fn(),
        create: jest.fn((v) => v),
        save: jest.fn(),
      },
      classRepo: { findOne: jest.fn(), find: jest.fn() },
      classStudentRepo: {
        findOne: jest.fn(),
        find: jest.fn(),
        count: jest.fn(),
      },
      sessionRepo: { count: jest.fn(), createQueryBuilder: jest.fn() },
      teacherRepo: { findOne: jest.fn() },
      studentRepo: { findOne: jest.fn() },
      notificationRepo: { create: jest.fn((v) => v), save: jest.fn() },
      minioService: {
        uploadFile: jest.fn(),
        removeFile: jest.fn(),
        getPresignedUrl: jest.fn(),
      },
      ...overrides,
    };
    const controller = new AssignmentController(
      repos.assignmentRepo as any,
      repos.attachmentRepo as any,
      repos.submissionRepo as any,
      repos.submissionAttachmentRepo as any,
      repos.classRepo as any,
      repos.classStudentRepo as any,
      repos.sessionRepo as any,
      repos.teacherRepo as any,
      repos.studentRepo as any,
      repos.notificationRepo as any,
      repos.minioService as any,
    );
    return { controller, repos };
  };

  const publishedAssignment = {
    id: 'assignment-1',
    classId: 'class-1',
    title: 'Bài tập 1',
    status: 'published',
    dueAt: new Date(Date.now() + 60_000),
    maxScore: 10,
  };

  it('rejects a submission after the student has left the class', async () => {
    const { controller, repos } = createController();
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    repos.assignmentRepo.findOne.mockResolvedValue(publishedAssignment);
    repos.classStudentRepo.findOne.mockResolvedValue(null);

    await expect(
      controller.submit(
        { user: { sub: 'user-1', role: Role.STUDENT } },
        'assignment-1',
        { answerText: 'Bài làm' },
        [],
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows submission after the student rejoins an active class', async () => {
    const { controller, repos } = createController();
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    repos.assignmentRepo.findOne.mockResolvedValue(publishedAssignment);
    repos.classStudentRepo.findOne.mockResolvedValue({ status: 'Active' });
    repos.submissionRepo.findOne.mockResolvedValue(null);

    const result = await controller.submit(
      { user: { sub: 'user-1', role: Role.STUDENT } },
      'assignment-1',
      { answerText: 'Bài làm mới' },
      [],
    );

    expect(result.status).toBe('submitted');
    expect(repos.submissionRepo.save).toHaveBeenCalled();
  });

  it('clears the old grade and marks a resubmission late', async () => {
    const { controller, repos } = createController();
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    repos.assignmentRepo.findOne.mockResolvedValue({
      ...publishedAssignment,
      dueAt: new Date(Date.now() - 60_000),
    });
    repos.classStudentRepo.findOne.mockResolvedValue({ status: 'Active' });
    repos.submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      assignmentId: 'assignment-1',
      studentId: 'student-1',
      score: 9,
      feedback: 'Tốt',
      status: 'graded',
    });

    const result = await controller.submit(
      { user: { sub: 'user-1', role: Role.STUDENT } },
      'assignment-1',
      { answerText: 'Nộp lại' },
      [],
    );

    expect(result.status).toBe('late');
    expect(result.score).toBeNull();
    expect(result.feedback).toBeNull();
  });

  it('rejects a score above the assignment maximum', async () => {
    const { controller, repos } = createController();
    repos.submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      assignment: publishedAssignment,
      student: { userId: 'student-user' },
    });
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1' });

    await expect(
      controller.grade(
        { user: { sub: 'admin-user', role: Role.ADMIN } },
        'submission-1',
        { score: 11 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a teacher who does not manage the class', async () => {
    const { controller, repos } = createController();
    repos.submissionRepo.findOne.mockResolvedValue({
      id: 'submission-1',
      assignment: publishedAssignment,
      student: { userId: 'student-user' },
    });
    repos.classRepo.findOne.mockResolvedValue({
      id: 'class-1',
      mainTeacherId: 'other-teacher',
    });
    repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-1' });
    repos.sessionRepo.count.mockResolvedValue(0);

    await expect(
      controller.grade(
        { user: { sub: 'teacher-user', role: Role.TEACHER } },
        'submission-1',
        { score: 8 },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows a teacher to delete a draft assignment', async () => {
    const { controller, repos } = createController();
    repos.assignmentRepo.findOne.mockResolvedValue({
      ...publishedAssignment,
      status: 'draft',
    });
    repos.classRepo.findOne.mockResolvedValue({
      id: 'class-1',
      mainTeacherId: 'teacher-1',
    });
    repos.teacherRepo.findOne.mockResolvedValue({ id: 'teacher-1' });

    const result = await controller.remove(
      { user: { sub: 'teacher-user', role: Role.TEACHER } },
      'assignment-1',
    );

    expect(result).toEqual({ success: true });
    expect(repos.assignmentRepo.remove).toHaveBeenCalled();
  });

  it('rejects moving a published assignment back to draft', async () => {
    const { controller, repos } = createController();
    repos.assignmentRepo.findOne.mockResolvedValue({ ...publishedAssignment });
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1' });

    await expect(
      controller.update(
        { user: { sub: 'admin-user', role: Role.ADMIN } },
        'assignment-1',
        { status: 'draft' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects submissions after an assignment is closed', async () => {
    const { controller, repos } = createController();
    repos.studentRepo.findOne.mockResolvedValue({ id: 'student-1' });
    repos.assignmentRepo.findOne.mockResolvedValue({
      ...publishedAssignment,
      status: 'closed',
    });

    await expect(
      controller.submit(
        { user: { sub: 'user-1', role: Role.STUDENT } },
        'assignment-1',
        { answerText: 'Bài làm' },
        [],
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects reopening a closed assignment', async () => {
    const { controller, repos } = createController();
    repos.assignmentRepo.findOne.mockResolvedValue({
      ...publishedAssignment,
      status: 'closed',
    });
    repos.classRepo.findOne.mockResolvedValue({ id: 'class-1' });

    await expect(
      controller.update(
        { user: { sub: 'admin-user', role: Role.ADMIN } },
        'assignment-1',
        { status: 'published' },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
