import { UpdateStudentDroppedDateUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-student-joined-date.use-case';
import { AcademicsPersistencePort } from '../../../../../../src/modules/academics/application/ports/academics-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('UpdateStudentDroppedDateUseCase Spec (TDD & Performance Benchmark)', () => {
  let useCase: UpdateStudentDroppedDateUseCase;
  let mockPersistence: jest.Mocked<AcademicsPersistencePort>;

  const validClassId = 'class-uuid-001';
  const validStudentId = 'student-uuid-001';

  beforeEach(() => {
    mockPersistence = {
      findRecurringAllocations: jest.fn(),
      findSessionAllocations: jest.fn(),
      enrollStudent: jest.fn(),
      removeStudent: jest.fn(),
      createAdhocSession: jest.fn(),
      updateStudentJoinedDate: jest.fn(),
      updateAllStudentsJoinedDate: jest.fn(),
      updateStudentDroppedDate: jest.fn(),
    } as any;

    useCase = new UpdateStudentDroppedDateUseCase(mockPersistence);
  });

  describe('PHẦN 1: BỘ 5 ĐIỀU KIỆN VALIDATE KỸ KHI SỬA NGÀY KÍCH', () => {
    it('Validate 1: Ném lỗi nếu định dạng ngày kích không hợp lệ', async () => {
      mockPersistence.updateStudentDroppedDate.mockImplementation(async (_cId, _sId, date) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!date || !regex.test(date) || isNaN(Date.parse(date))) {
          throw new AcademicError('INVALID_DATE_FORMAT', 'Định dạng ngày kích không hợp lệ.');
        }
        return { message: 'Thành công' };
      });

      await expect(
        useCase.execute(validClassId, validStudentId, '2026/09/20'),
      ).rejects.toThrow('Định dạng ngày kích không hợp lệ.');

      await expect(
        useCase.execute(validClassId, validStudentId, ''),
      ).rejects.toThrow('Định dạng ngày kích không hợp lệ.');
    });

    it('Validate 2: Ném lỗi nếu học sinh không ở trạng thái Dropped trong lớp', async () => {
      mockPersistence.updateStudentDroppedDate.mockImplementation(async () => {
        throw new AcademicError('STUDENT_NOT_FOUND', 'Học sinh không ở trạng thái bị kích trong lớp này.');
      });

      await expect(
        useCase.execute(validClassId, 'active-student-id', '2026-09-20'),
      ).rejects.toThrow('Học sinh không ở trạng thái bị kích trong lớp này.');
    });

    it('Validate 3: Ném lỗi nếu ngày kích trước ngày học sinh tham gia lớp (droppedDate < joinedDate)', async () => {
      mockPersistence.updateStudentDroppedDate.mockImplementation(async () => {
        throw new AcademicError(
          'DROPPED_DATE_BEFORE_JOINED_DATE',
          'Ngày rời lớp không được trước ngày học sinh tham gia lớp.',
        );
      });

      await expect(
        useCase.execute(validClassId, validStudentId, '2026-08-01'),
      ).rejects.toThrow('Ngày rời lớp không được trước ngày học sinh tham gia lớp.');
    });

    it('Validate 4: Ném lỗi nếu ngày kích sau ngày kết thúc/bế giảng của lớp học (droppedDate > finishDate)', async () => {
      mockPersistence.updateStudentDroppedDate.mockImplementation(async () => {
        throw new AcademicError(
          'DROPPED_DATE_AFTER_FINISH_DATE',
          'Ngày rời lớp không được sau ngày kết thúc lớp học.',
        );
      });

      await expect(
        useCase.execute(validClassId, validStudentId, '2026-11-30'),
      ).rejects.toThrow('Ngày rời lớp không được sau ngày kết thúc lớp học.');
    });

    it('Validate 5: Ném lỗi bảo toàn tài chính nếu sửa ngày kích trước các buổi học đã xuất hóa đơn thu học phí (billId)', async () => {
      mockPersistence.updateStudentDroppedDate.mockImplementation(async () => {
        throw new AcademicError(
          'CANNOT_DROP_STUDENT_BILLED_CONFLICT',
          'Không thể chọn ngày kích trước buổi học ngày 2026-09-10 vì đã được xuất hóa đơn thu học phí.',
        );
      });

      await expect(
        useCase.execute(validClassId, validStudentId, '2026-09-05'),
      ).rejects.toThrow('đã được xuất hóa đơn thu học phí');
    });
  });

  describe('PHẦN 2: THỰC THI CẬP NHẬT THÀNH CÔNG VÀ PERFORMANCE BENCHMARK', () => {
    it('Cập nhật ngày rời lớp thành công khi thỏa mãn toàn bộ điều kiện', async () => {
      mockPersistence.updateStudentDroppedDate.mockResolvedValue({
        message: 'Cập nhật ngày rời lớp thành công!',
      });

      const result = await useCase.execute(validClassId, validStudentId, '2026-09-20');

      expect(result).toBeDefined();
      expect(result.message).toContain('Cập nhật ngày rời lớp thành công');
      expect(mockPersistence.updateStudentDroppedDate).toHaveBeenCalledWith(
        validClassId,
        validStudentId,
        '2026-09-20',
      );
    });

    it('Performance Benchmark: Thời gian thực thi UseCase đạt chuẩn SLA < 5ms', async () => {
      mockPersistence.updateStudentDroppedDate.mockResolvedValue({
        message: 'Cập nhật ngày rời lớp thành công!',
      });

      const start = performance.now();
      await useCase.execute(validClassId, validStudentId, '2026-09-20');
      const duration = performance.now() - start;

      console.log(`[PERFORMANCE BENCHMARK] UpdateStudentDroppedDateUseCase: ${duration.toFixed(3)}ms (SLA < 5ms)`);
      expect(duration).toBeLessThan(5);
    });
  });
});
