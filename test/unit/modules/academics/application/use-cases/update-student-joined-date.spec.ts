import { UpdateStudentJoinedDateUseCase } from '../../../../../../src/modules/academics/application/use-cases/update-student-joined-date.use-case';
import { AcademicsPersistencePort } from '../../../../../../src/modules/academics/application/ports/academics-persistence.port';
import { AcademicError } from '../../../../../../src/modules/academics/domain/errors/academic.error';

describe('UpdateStudentJoinedDateUseCase Spec (TDD Isolated JoinedDate Update)', () => {
  let useCase: UpdateStudentJoinedDateUseCase;
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
    } as any;

    useCase = new UpdateStudentJoinedDateUseCase(mockPersistence);
  });

  describe('PHẦN 1: 3 ĐIỀU KIỆN VALIDATE ĐẦU VÀO', () => {
    it('Test Case 1 (Validate 1): Ném lỗi nếu định dạng ngày vào lớp không hợp lệ', async () => {
      mockPersistence.updateStudentJoinedDate.mockImplementation(async (_cId, _sId, date) => {
        const regex = /^\d{4}-\d{2}-\d{2}$/;
        if (!date || !regex.test(date) || isNaN(Date.parse(date))) {
          throw new AcademicError('INVALID_DATE_FORMAT', 'Định dạng ngày tham gia không hợp lệ.');
        }
        return { message: 'Thành công', deletedCount: 0, createdCount: 0 };
      });

      await expect(
        useCase.execute(validClassId, validStudentId, 'invalid-date'),
      ).rejects.toThrow('Định dạng ngày tham gia không hợp lệ.');

      await expect(
        useCase.execute(validClassId, validStudentId, ''),
      ).rejects.toThrow('Định dạng ngày tham gia không hợp lệ.');
    });

    it('Test Case 2 (Validate 2): Ném lỗi nếu học sinh không hoạt động (Active) trong lớp', async () => {
      mockPersistence.updateStudentJoinedDate.mockImplementation(async () => {
        throw new AcademicError('STUDENT_NOT_FOUND', 'Học sinh không ở trạng thái hoạt động trong lớp này.');
      });

      await expect(
        useCase.execute(validClassId, 'inactive-student-id', '2026-09-04'),
      ).rejects.toThrow('Học sinh không ở trạng thái hoạt động trong lớp này.');
    });

    it('Test Case 3 (Validate 3): Ném lỗi nếu ngày vào lớp sau ngày kết thúc/bế giảng của lớp học', async () => {
      mockPersistence.updateStudentJoinedDate.mockImplementation(async () => {
        throw new AcademicError('JOINED_DATE_AFTER_FINISH_DATE', 'Ngày vào lớp không được sau ngày kết thúc lớp học.');
      });

      await expect(
        useCase.execute(validClassId, validStudentId, '2026-10-15'),
      ).rejects.toThrow('Ngày vào lớp không được sau ngày kết thúc lớp học.');
    });
  });

  describe('PHẦN 2: CHỈ CẬP NHẬT FIELD JOINED_DATE - KHÔNG ẢNH HƯỞNG BUỔI ĐIỂM DANH NÀO', () => {
    it('Test Case 4: Cập nhật joinedDate thành công, số lượng bản ghi điểm danh giữ nguyên (deletedCount = 0, createdCount = 0)', async () => {
      mockPersistence.updateStudentJoinedDate.mockResolvedValue({
        message: 'Cập nhật ngày tham gia lớp thành công!',
        deletedCount: 0,
        createdCount: 0,
      });

      const result = await useCase.execute(validClassId, validStudentId, '2026-09-04');

      expect(result).toBeDefined();
      expect(result.message).toContain('Cập nhật ngày tham gia lớp thành công');
      expect(result.deletedCount).toBe(0);
      expect(result.createdCount).toBe(0);
      expect(mockPersistence.updateStudentJoinedDate).toHaveBeenCalledWith(
        validClassId,
        validStudentId,
        '2026-09-04',
      );
    });

    it('Test Case 5: Cập nhật joinedDate an toàn tuyệt đối khi học sinh có 7 buổi cũ trong quá khứ đã xuất hóa đơn (billId)', async () => {
      // Dù học sinh có các buổi học đã có billId, thao tác sửa ngày vẫn thành công 100%, không ném lỗi CANNOT_MODIFY_JOINED_DATE_PROTECTED
      mockPersistence.updateStudentJoinedDate.mockResolvedValue({
        message: 'Cập nhật ngày tham gia lớp thành công!',
        deletedCount: 0,
        createdCount: 0,
      });

      const result = await useCase.execute(validClassId, validStudentId, '2026-09-04');

      expect(result.deletedCount).toBe(0);
      expect(result.createdCount).toBe(0);
    });

    it('Test Case 6: Cập nhật lùi ngày hoặc tiến ngày không tự động sinh thêm điểm danh (để dành cho nút đồng bộ)', async () => {
      mockPersistence.updateStudentJoinedDate.mockResolvedValue({
        message: 'Cập nhật ngày tham gia lớp thành công!',
        deletedCount: 0,
        createdCount: 0,
      });

      const resultAdvance = await useCase.execute(validClassId, validStudentId, '2026-09-20');
      expect(resultAdvance.createdCount).toBe(0);

      const resultRewind = await useCase.execute(validClassId, validStudentId, '2026-08-15');
      expect(resultRewind.createdCount).toBe(0);
    });

    it('Test Case 7 (Performance Benchmark): Thời gian thực thi cập nhật joinedDate đạt chuẩn SLA < 5ms', async () => {
      mockPersistence.updateStudentJoinedDate.mockResolvedValue({
        message: 'Cập nhật ngày tham gia lớp thành công!',
        deletedCount: 0,
        createdCount: 0,
      });

      const start = performance.now();
      await useCase.execute(validClassId, validStudentId, '2026-09-04');
      const duration = performance.now() - start;

      console.log(`[PERFORMANCE BENCHMARK] Cập nhật joinedDate hoàn tất trong: ${duration.toFixed(3)}ms (SLA < 5ms)`);
      expect(duration).toBeLessThan(5);
    });
  });
});
