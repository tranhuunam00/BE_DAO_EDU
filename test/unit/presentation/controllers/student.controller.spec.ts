import { StudentController } from '../../../../src/presentation/controllers/student.controller';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('StudentController', () => {
  let controller: StudentController;
  let addStudentUseCase: any;
  let getStudentsUseCase: any;
  let getStudentByIdUseCase: any;
  let updateStudentUseCase: any;
  let getStudentTuitionReportUseCase: any;
  let calculateStudentTuitionUseCase: any;
  let studentRepo: any;
  let userRepo: any;
  let classStudentRepo: any;
  let sessionRepo: any;
  let attendanceRepo: any;
  let monthlyBillRepo: any;
  let monthlyBillItemRepo: any;

  beforeEach(() => {
    addStudentUseCase = {};
    getStudentsUseCase = {};
    getStudentByIdUseCase = {};
    updateStudentUseCase = {};
    getStudentTuitionReportUseCase = {};
    calculateStudentTuitionUseCase = {};
    
    studentRepo = {
      findOne: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
    };
    userRepo = {
      delete: jest.fn(),
    };
    classStudentRepo = {
      delete: jest.fn(),
    };
    sessionRepo = {};
    attendanceRepo = {
      count: jest.fn(),
    };
    monthlyBillRepo = {};
    monthlyBillItemRepo = {};

    controller = new StudentController(
      addStudentUseCase,
      getStudentsUseCase,
      getStudentByIdUseCase,
      updateStudentUseCase,
      getStudentTuitionReportUseCase,
      calculateStudentTuitionUseCase,
      classStudentRepo,
      sessionRepo,
      studentRepo,
      monthlyBillRepo,
      monthlyBillItemRepo,
      attendanceRepo,
      userRepo,
    );
  });

  describe('remove', () => {
    it('throws NotFoundException if student does not exist', async () => {
      studentRepo.findOne.mockResolvedValue(null);

      await expect(controller.remove('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException if student has attendance', async () => {
      studentRepo.findOne.mockResolvedValue({ id: 'stu-1' });
      attendanceRepo.count.mockResolvedValue(1);

      await expect(controller.remove('stu-1')).rejects.toThrow(BadRequestException);
    });

    it('deletes student, class links and user account if no siblings share the account', async () => {
      studentRepo.findOne.mockResolvedValue({ id: 'stu-1', userId: 'user-1' });
      attendanceRepo.count.mockResolvedValue(0);
      studentRepo.count.mockResolvedValue(0); // 0 other students share the account

      const result = await controller.remove('stu-1');

      expect(classStudentRepo.delete).toHaveBeenCalledWith({ studentId: 'stu-1' });
      expect(studentRepo.delete).toHaveBeenCalledWith('stu-1');
      expect(userRepo.delete).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ success: true, message: 'Đã xóa học sinh thành công.' });
    });

    it('deletes student and class links but does NOT delete user account if siblings share it', async () => {
      studentRepo.findOne.mockResolvedValue({ id: 'stu-1', userId: 'user-shared' });
      attendanceRepo.count.mockResolvedValue(0);
      studentRepo.count.mockResolvedValue(1); // 1 other sibling student shares the account

      const result = await controller.remove('stu-1');

      expect(classStudentRepo.delete).toHaveBeenCalledWith({ studentId: 'stu-1' });
      expect(studentRepo.delete).toHaveBeenCalledWith('stu-1');
      expect(userRepo.delete).not.toHaveBeenCalled(); // User account preserved!
      expect(result).toEqual({ success: true, message: 'Đã xóa học sinh thành công.' });
    });
  });
});
