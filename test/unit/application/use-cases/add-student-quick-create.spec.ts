import { AddStudentUseCase } from '../../../../src/application/use-cases/add-student.use-case';
import { IStudentRepository } from '../../../../src/domain/repositories/student-repository.interface';
import { IUserRepository } from '../../../../src/domain/repositories/user-repository.interface';
import { FileStoragePort } from '../../../../src/application/ports/file-storage.port';
import { CreateStudentDto } from '../../../../src/application/dtos/student.dto';
import * as bcrypt from 'bcryptjs';

jest.mock('bcryptjs');

describe('AddStudentUseCase - Quick Create & Invariant Validation Spec', () => {
  let useCase: AddStudentUseCase;
  let studentRepository: jest.Mocked<IStudentRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let fileStorage: jest.Mocked<FileStoragePort>;

  beforeEach(() => {
    studentRepository = {
      save: jest.fn().mockImplementation(async (student) => student),
      findById: jest.fn(),
      findAll: jest.fn().mockResolvedValue([]),
      delete: jest.fn(),
    } as any;

    userRepository = {
      save: jest.fn().mockImplementation(async (user) => {
        user.id = user.id || 'usr-mock-id';
        return user;
      }),
      findById: jest.fn(),
      findByEmail: jest.fn().mockResolvedValue(null),
      findAll: jest.fn(),
      delete: jest.fn(),
    } as any;

    fileStorage = {
      uploadBase64Image: jest.fn(),
    } as any;

    (bcrypt.genSalt as jest.Mock).mockResolvedValue('salt');
    (bcrypt.hash as jest.Mock).mockResolvedValue('hashedPassword');

    useCase = new AddStudentUseCase(studentRepository, userRepository, fileStorage);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1. Quick-create student with minimal fields', () => {
    it('1.1. nên tạo thành công học sinh chỉ với Họ, Tên, Số điện thoại và tự động gán giá trị mặc định hợp lệ', async () => {
      const minimalDto: CreateStudentDto = {
        firstName: 'Lâm',
        lastName: 'Nguyễn Trần Trúc',
        mobile: '0942580432',
      } as any;

      const result = await useCase.execute(minimalDto);

      expect(result).toBeDefined();
      expect(result.firstName).toBe('Lâm');
      expect(result.lastName).toBe('Nguyễn Trần Trúc');
      expect(result.mobile).toBe('0942580432');
      // Giá trị mặc định an toàn cho hệ thống và database
      expect(result.gender).toBe('Khác');
      expect(result.birthdate).toBeDefined();
      expect(result.primaryAddress).toBe('Chưa cập nhật');
      expect(result.status).toBe('Waiting for class');
      expect(studentRepository.save).toHaveBeenCalledTimes(1);
    });

    it('1.2. nên tự động chuẩn hóa status Active thành Studying hoặc Waiting for class khi FE gửi status không chuẩn', async () => {
      const dtoWithActiveStatus: any = {
        firstName: 'Lâm',
        lastName: 'Nguyễn Trần Trúc',
        mobile: '0942580432',
        status: 'Active',
      };

      const result = await useCase.execute(dtoWithActiveStatus);

      expect(result.status).toBe('Studying');
      expect(studentRepository.save).toHaveBeenCalledTimes(1);
    });
  });

  describe('2. Performance Benchmark SLA (< 50ms)', () => {
    it('2.1. Benchmark tạo 100 học sinh dạng quick-create phải hoàn thành dưới 50ms', async () => {
      const startTime = performance.now();

      const promises = Array.from({ length: 100 }).map((_, idx) =>
        useCase.execute({
          firstName: `Học sinh ${idx}`,
          lastName: 'Nguyễn',
          mobile: `0900000${String(idx).padStart(3, '0')}`,
        } as any)
      );

      const results = await Promise.all(promises);
      const durationMs = performance.now() - startTime;

      expect(results.length).toBe(100);
      expect(durationMs).toBeLessThan(50);
    });
  });
});
