import { ReportController } from '../../../../src/presentation/controllers/report.controller';

describe('ReportController', () => {
  const createController = () => {
    const revenueReport = { execute: jest.fn() };
    const salaryReport = { execute: jest.fn() };
    const attendanceReport = { execute: jest.fn() };
    const assignmentReport = { execute: jest.fn() };
    const studentsReport = { execute: jest.fn() };
    const reportsQuery = {
      getClassStudentsStats: jest.fn(),
      getSaleOrdersReport: jest.fn(),
      getAttendanceByClass: jest.fn(),
      getStudentAttendanceReport: jest.fn(),
      getStudentDebtsReport: jest.fn(),
    };

    return {
      controller: new ReportController(
        revenueReport as any,
        salaryReport as any,
        attendanceReport as any,
        assignmentReport as any,
        studentsReport as any,
        reportsQuery as any,
      ),
      revenueReport,
      salaryReport,
      attendanceReport,
      assignmentReport,
      studentsReport,
      reportsQuery,
    };
  };

  it('delegates getting revenue report to the revenue use case', async () => {
    const { controller, revenueReport } = createController();
    revenueReport.execute.mockResolvedValue({ some: 'data' });

    await expect(controller.getRevenue('2026-06', undefined, undefined, 'center-1', 'class-1')).resolves.toEqual({ some: 'data' });
    expect(revenueReport.execute).toHaveBeenCalledWith({ month: '2026-06', startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: 'class-1', classIds: undefined, classStatus: undefined });
  });

  it('delegates getting salary report to the salary use case', async () => {
    const { controller, salaryReport } = createController();
    salaryReport.execute.mockResolvedValue({ salary: 'data' });

    await expect(controller.getSalary('2026-06', undefined, undefined, 'center-1')).resolves.toEqual({ salary: 'data' });
    expect(salaryReport.execute).toHaveBeenCalledWith({ month: '2026-06', startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: undefined, classIds: undefined, classStatus: undefined });
  });

  it('delegates getting class students stats report to reportsQuery', async () => {
    const { controller, reportsQuery } = createController();
    reportsQuery.getClassStudentsStats.mockResolvedValue([{ classId: '1', activeCount: 5 }]);

    await expect(controller.getClassStudentsStats('center-1', 'class-1')).resolves.toEqual([{ classId: '1', activeCount: 5 }]);
    expect(reportsQuery.getClassStudentsStats).toHaveBeenCalledWith({ month: undefined, startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: 'class-1', classIds: undefined, classStatus: undefined });
  });

  it('delegates getting sale orders report to reportsQuery', async () => {
    const { controller, reportsQuery } = createController();
    reportsQuery.getSaleOrdersReport.mockResolvedValue([{ billId: '1', status: 'Paid' }]);

    await expect(controller.getSaleOrders('2026-06', undefined, undefined, 'center-1', 'class-1')).resolves.toEqual([{ billId: '1', status: 'Paid' }]);
    expect(reportsQuery.getSaleOrdersReport).toHaveBeenCalledWith({ month: '2026-06', startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: 'class-1', classIds: undefined, classStatus: undefined });
  });

  it('delegates getting class attendance report to reportsQuery', async () => {
    const { controller, reportsQuery } = createController();
    reportsQuery.getAttendanceByClass.mockResolvedValue([{ classId: '1', rate: 90 }]);

    await expect(controller.getClassAttendance('2026-06', undefined, undefined, 'center-1', 'class-1')).resolves.toEqual([{ classId: '1', rate: 90 }]);
    expect(reportsQuery.getAttendanceByClass).toHaveBeenCalledWith({ month: '2026-06', startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: 'class-1', classIds: undefined, classStatus: undefined });
  });

  it('delegates getting student attendance report to reportsQuery', async () => {
    const { controller, reportsQuery } = createController();
    reportsQuery.getStudentAttendanceReport.mockResolvedValue([{ studentId: '1', rate: '95' }]);

    await expect(controller.getStudentAttendance('2026-06', undefined, undefined, 'center-1', 'class-1')).resolves.toEqual([{ studentId: '1', rate: '95' }]);
    expect(reportsQuery.getStudentAttendanceReport).toHaveBeenCalledWith({ month: '2026-06', startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: 'class-1', classIds: undefined, classStatus: undefined });
  });

  it('delegates getting student debts report to reportsQuery', async () => {
    const { controller, reportsQuery } = createController();
    reportsQuery.getStudentDebtsReport.mockResolvedValue([{ studentId: '1', debtAmount: 100 }]);

    await expect(controller.getStudentDebts('2026-06', undefined, undefined, 'center-1', 'class-1')).resolves.toEqual([{ studentId: '1', debtAmount: 100 }]);
    expect(reportsQuery.getStudentDebtsReport).toHaveBeenCalledWith({ month: '2026-06', startMonth: undefined, endMonth: undefined, centerId: 'center-1', classId: 'class-1', classIds: undefined, classStatus: undefined });
  });
});
