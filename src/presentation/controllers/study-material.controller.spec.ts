/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { StudyMaterialController } from './study-material.controller';
import { Role } from '../../domain/value-objects/role.enum';

describe('StudyMaterialController', () => {
  // ─── Helpers ────────────────────────────────────────────────────────────────

  const makeRepos = (overrides: Partial<any> = {}) => ({
    materialRepo: {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((v) => ({ id: 'mat-1', createdAt: new Date(), ...v })),
      save: jest.fn(async (v) => v),
      remove: jest.fn().mockResolvedValue(undefined),
      ...overrides.materialRepo,
    },
    classRepo: {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      })),
      ...overrides.classRepo,
    },
    classStudentRepo: {
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides.classStudentRepo,
    },
    sessionRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn(() => ({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([]),
      })),
      ...overrides.sessionRepo,
    },
    teacherRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides.teacherRepo,
    },
    studentRepo: {
      findOne: jest.fn().mockResolvedValue(null),
      ...overrides.studentRepo,
    },
    minioService: {
      uploadFile: jest.fn().mockResolvedValue('materials/class-1/file.pdf'),
      getPresignedUrl: jest.fn().mockResolvedValue('https://minio.example.com/file.pdf'),
      removeFile: jest.fn().mockResolvedValue(undefined),
      ...overrides.minioService,
    },
  });

  const makeController = (overrides: Partial<any> = {}) => {
    const repos = makeRepos(overrides);
    const ctrl = new StudyMaterialController(
      repos.materialRepo as any,
      repos.classRepo as any,
      repos.classStudentRepo as any,
      repos.sessionRepo as any,
      repos.teacherRepo as any,
      repos.studentRepo as any,
      repos.minioService as any,
    );
    return { ctrl, repos };
  };

  const adminUser = { sub: 'user-admin', role: Role.ADMIN };
  const teacherUser = { sub: 'user-teacher', role: Role.TEACHER };
  const studentUser = { sub: 'user-student', role: Role.STUDENT };

  const mockClass = { id: 'class-1', className: 'Toán 6', classCode: 'TOAN6', status: 'Active' };
  const mockTeacher = { id: 'teacher-1', userId: 'user-teacher' };
  const mockStudent = { id: 'student-1', userId: 'user-student' };
  const mockMaterial = {
    id: 'mat-1',
    classId: 'class-1',
    title: 'Bài giảng tuần 1',
    description: null,
    fileName: 'bai-giang.pdf',
    objectKey: 'materials/class-1/bai-giang.pdf',
    mimeType: 'application/pdf',
    fileSize: 1024 * 1024,
    uploadedByUserId: 'user-teacher',
    createdAt: new Date(),
  };

  // ─── getMyClasses ────────────────────────────────────────────────────────────

  describe('getMyClasses', () => {
    it('ADMIN: returns all active classes', async () => {
      const { ctrl, repos } = makeController();
      repos.classRepo.find.mockResolvedValue([mockClass]);

      const result = await ctrl.getMyClasses({ user: adminUser });

      expect(repos.classRepo.find).toHaveBeenCalledWith({ where: { status: 'Active' }, order: { className: 'ASC' } });
      expect(result).toEqual([mockClass]);
    });

    it('TEACHER: returns classes where teacher is main teacher or has sessions', async () => {
      const { ctrl, repos } = makeController();
      repos.teacherRepo.findOne.mockResolvedValue(mockTeacher);
      repos.classRepo.find.mockResolvedValue([mockClass]);
      repos.sessionRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue([{ classId: 'class-2' }]),
      });
      repos.classRepo.createQueryBuilder.mockReturnValue({
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([mockClass]),
      });

      const result = await ctrl.getMyClasses({ user: teacherUser });
      expect(result).toEqual([mockClass]);
    });

    it('TEACHER: returns [] if teacher profile not found', async () => {
      const { ctrl } = makeController();
      const result = await ctrl.getMyClasses({ user: teacherUser });
      expect(result).toEqual([]);
    });

    it('STUDENT: returns enrolled active classes', async () => {
      const { ctrl, repos } = makeController();
      repos.studentRepo.findOne.mockResolvedValue(mockStudent);
      repos.classStudentRepo.find.mockResolvedValue([
        { studentId: 'student-1', classEntity: mockClass, status: 'Active' },
      ]);

      const result = await ctrl.getMyClasses({ user: studentUser });
      expect(result).toContain(mockClass);
    });

    it('STUDENT: returns [] if student profile not found', async () => {
      const { ctrl } = makeController();
      const result = await ctrl.getMyClasses({ user: studentUser });
      expect(result).toEqual([]);
    });
  });

  // ─── listMaterials ───────────────────────────────────────────────────────────

  describe('listMaterials', () => {
    it('ADMIN: returns all materials for a class with presigned URLs', async () => {
      const { ctrl, repos } = makeController();
      repos.materialRepo.find.mockResolvedValue([mockMaterial]);
      repos.minioService.getPresignedUrl.mockResolvedValue('https://minio.example.com/file.pdf');

      const result = await ctrl.listMaterials({ user: adminUser }, 'class-1');

      expect(repos.materialRepo.find).toHaveBeenCalledWith({
        where: { classId: 'class-1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe('https://minio.example.com/file.pdf');
    });

    it('STUDENT: throws ForbiddenException if not enrolled in class', async () => {
      const { ctrl, repos } = makeController();
      repos.studentRepo.findOne.mockResolvedValue(mockStudent);
      // classStudentRepo.findOne returns null → not enrolled

      await expect(ctrl.listMaterials({ user: studentUser }, 'class-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('STUDENT: can list materials if enrolled', async () => {
      const { ctrl, repos } = makeController();
      repos.studentRepo.findOne.mockResolvedValue(mockStudent);
      repos.classStudentRepo.findOne.mockResolvedValue({ classId: 'class-1', studentId: 'student-1', status: 'Active' });
      repos.materialRepo.find.mockResolvedValue([mockMaterial]);

      const result = await ctrl.listMaterials({ user: studentUser }, 'class-1');
      expect(result).toHaveLength(1);
    });
  });

  // ─── uploadMaterial ──────────────────────────────────────────────────────────

  describe('uploadMaterial', () => {
    const mockFile = {
      originalname: 'bai-giang.pdf',
      mimetype: 'application/pdf',
      size: 1024 * 1024,
      buffer: Buffer.from('mock-content'),
    };

    it('throws BadRequestException when classId is missing', async () => {
      const { ctrl } = makeController();

      await expect(
        ctrl.uploadMaterial({ user: adminUser }, { classId: '', title: 'Test' } as any, mockFile as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when title is missing', async () => {
      const { ctrl } = makeController();

      await expect(
        ctrl.uploadMaterial({ user: adminUser }, { classId: 'class-1', title: '' } as any, mockFile as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when file is missing', async () => {
      const { ctrl } = makeController();

      await expect(
        ctrl.uploadMaterial({ user: adminUser }, { classId: 'class-1', title: 'Test' } as any, null as any)
      ).rejects.toThrow(BadRequestException);
    });

    it('ADMIN: uploads material and saves to DB', async () => {
      const { ctrl, repos } = makeController();
      repos.minioService.uploadFile.mockResolvedValue('materials/class-1/bai-giang.pdf');

      const result = await ctrl.uploadMaterial(
        { user: adminUser },
        { classId: 'class-1', title: 'Bài giảng tuần 1', description: 'Nội dung tuần đầu' },
        mockFile as any,
      );

      expect(repos.minioService.uploadFile).toHaveBeenCalledWith(mockFile, 'materials/class-1');
      expect(repos.materialRepo.create).toHaveBeenCalled();
      expect(repos.materialRepo.save).toHaveBeenCalled();
      expect(result).toHaveProperty('objectKey', 'materials/class-1/bai-giang.pdf');
    });

    it('TEACHER: throws ForbiddenException if not teaching the class', async () => {
      const { ctrl, repos } = makeController();
      repos.teacherRepo.findOne.mockResolvedValue(mockTeacher);
      // classRepo.findOne returns null → not main teacher
      // sessionRepo.findOne returns null → no sessions either

      await expect(
        ctrl.uploadMaterial({ user: teacherUser }, { classId: 'class-1', title: 'Test' }, mockFile as any)
      ).rejects.toThrow(ForbiddenException);
    });

    it('TEACHER: can upload if is main teacher of class', async () => {
      const { ctrl, repos } = makeController();
      repos.teacherRepo.findOne.mockResolvedValue(mockTeacher);
      repos.classRepo.findOne.mockResolvedValue(mockClass); // is main teacher
      repos.minioService.uploadFile.mockResolvedValue('materials/class-1/file.pdf');

      const result = await ctrl.uploadMaterial(
        { user: teacherUser },
        { classId: 'class-1', title: 'Bài giảng' },
        mockFile as any,
      );

      expect(result).toHaveProperty('classId', 'class-1');
    });
  });

  // ─── deleteMaterial ──────────────────────────────────────────────────────────

  describe('deleteMaterial', () => {
    it('throws NotFoundException if material does not exist', async () => {
      const { ctrl } = makeController();

      await expect(ctrl.deleteMaterial({ user: adminUser }, 'non-existent-id'))
        .rejects.toThrow(NotFoundException);
    });

    it('ADMIN: can delete any material', async () => {
      const { ctrl, repos } = makeController();
      repos.materialRepo.findOne.mockResolvedValue(mockMaterial);

      const result = await ctrl.deleteMaterial({ user: adminUser }, 'mat-1');

      expect(repos.minioService.removeFile).toHaveBeenCalledWith(mockMaterial.objectKey);
      expect(repos.materialRepo.remove).toHaveBeenCalledWith(mockMaterial);
      expect(result).toEqual({ success: true });
    });

    it('TEACHER: throws ForbiddenException if not the uploader', async () => {
      const { ctrl, repos } = makeController();
      // material was uploaded by a different user
      repos.materialRepo.findOne.mockResolvedValue({
        ...mockMaterial,
        uploadedByUserId: 'another-user-id',
      });

      await expect(ctrl.deleteMaterial({ user: teacherUser }, 'mat-1'))
        .rejects.toThrow(ForbiddenException);
    });

    it('TEACHER: can delete their own uploaded material', async () => {
      const { ctrl, repos } = makeController();
      repos.materialRepo.findOne.mockResolvedValue(mockMaterial); // uploadedByUserId = 'user-teacher'

      const result = await ctrl.deleteMaterial({ user: teacherUser }, 'mat-1');
      expect(result).toEqual({ success: true });
    });

    it('MinIO removal failure is silently ignored (material is still deleted from DB)', async () => {
      const { ctrl, repos } = makeController();
      repos.materialRepo.findOne.mockResolvedValue(mockMaterial);
      repos.minioService.removeFile.mockRejectedValue(new Error('MinIO connection error'));

      // Should not throw
      const result = await ctrl.deleteMaterial({ user: adminUser }, 'mat-1');
      expect(result).toEqual({ success: true });
      expect(repos.materialRepo.remove).toHaveBeenCalled();
    });
  });
});
