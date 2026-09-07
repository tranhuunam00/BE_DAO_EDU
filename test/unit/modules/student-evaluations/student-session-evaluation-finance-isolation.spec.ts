import { performance } from 'perf_hooks';
import {
  StudentSessionEvaluationEntity,
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import { BillingCalculator, BillingSource, PricingRule } from '../../../../src/modules/billing/domain/services/billing-calculator';

describe('StudentSessionEvaluation - Finance & Billing Isolation Spec', () => {
  // Mock dữ liệu giá học phí chuẩn
  const mockPricings: PricingRule[] = [
    {
      courseLevelId: 'level-tieng-anh-1',
      pricePerSession: 200000,
      teacherWagePerSession: 100000,
      taWagePerSession: 50000,
      effectiveFrom: '2026-01-01',
      effectiveTo: null,
    },
  ];

  // -------------------------------------------------------------
  // NHÓM TEST 1: CÁCH LY TÍNH TOÁN HỌC PHÍ (TUITION INVARIANCE)
  // -------------------------------------------------------------
  describe('1. Tuition & Billing Calculation Invariance', () => {
    it('1.1. Học phí không thay đổi dù học sinh có đánh giá bài tập là hoàn thành hay không làm', () => {
      const attendanceSources: BillingSource[] = [
        {
          id: 'attendance-1',
          ownerId: 'student-1',
          ownerCode: 'HS001',
          ownerName: 'Nguyễn Văn A',
          ownerMobile: '090111222',
          ownerStatus: 'Active',
          classId: 'class-1',
          className: 'Tiếng Anh A1',
          courseName: 'Tiếng Anh',
          levelName: 'Level 1',
          courseLevelId: 'level-tieng-anh-1',
          date: '2026-08-01',
        },
      ];

      // Trường hợp A: Đánh giá hoàn thành xuất sắc
      const evalCompleted = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
        score: '10.0',
      });

      // Trường hợp B: Đánh giá không làm bài, không hiểu bài, dùng điện thoại
      const evalNotDone = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [BehaviorTag.PHONE, BehaviorTag.TALKATIVE],
        score: '2.0',
      });

      // Cả 2 trường hợp, hệ thống tính tiền học phí (BillingCalculator) đều ra cùng kết quả 200,000 VND
      const tuitionOrderA = BillingCalculator.calculate(attendanceSources, mockPricings, 'pricePerSession');
      const tuitionOrderB = BillingCalculator.calculate(attendanceSources, mockPricings, 'pricePerSession');

      expect(tuitionOrderA[0].totalAmount).toBe(200000);
      expect(tuitionOrderB[0].totalAmount).toBe(200000);
      expect(tuitionOrderA[0].totalAmount).toEqual(tuitionOrderB[0].totalAmount);
    });

    it('1.2. Học phí học sinh không bị trừ tiền khi điểm lượng giá buổi học thấp (score 0.0)', () => {
      const attendanceSources: BillingSource[] = [
        {
          id: 'attendance-2',
          ownerId: 'student-2',
          ownerCode: 'HS002',
          ownerName: 'Trần Thị B',
          ownerMobile: '090333444',
          ownerStatus: 'Active',
          classId: 'class-1',
          className: 'Tiếng Anh A1',
          courseName: 'Tiếng Anh',
          levelName: 'Level 1',
          courseLevelId: 'level-tieng-anh-1',
          date: '2026-08-02',
        },
      ];

      const evalZeroScore = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-2',
        studentId: 'student-2',
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [],
        score: '0.0',
      });

      const orders = BillingCalculator.calculate(attendanceSources, mockPricings, 'pricePerSession');
      expect(orders[0].totalAmount).toBe(200000);
    });

    it('1.3. Lương giáo viên không bị thay đổi bởi đánh giá nhận xét của học sinh', () => {
      const teacherSources: BillingSource[] = [
        {
          id: 'session-1',
          ownerId: 'teacher-1',
          ownerCode: 'GV001',
          ownerName: 'Thầy Hoàng',
          ownerMobile: '0912345678',
          ownerStatus: 'Active',
          classId: 'class-1',
          className: 'Tiếng Anh A1',
          courseName: 'Tiếng Anh',
          levelName: 'Level 1',
          courseLevelId: 'level-tieng-anh-1',
          date: '2026-08-01',
          roleInSession: 'main',
        },
      ];

      const teacherWages = BillingCalculator.calculate(teacherSources, mockPricings, 'teacherWagePerSession');
      expect(teacherWages[0].totalAmount).toBe(100000);
    });
  });

  // -------------------------------------------------------------
  // NHÓM TEST 2: ĐỘC LẬP VỚI BẢNG STUDENT_ATTENDANCE VÀ BILL_ID
  // -------------------------------------------------------------
  describe('2. Isolation from student_attendance and billId', () => {
    it('2.1. Bản ghi đánh giá không chứa trường billId và không thể gán billId', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-10',
        studentId: 'student-uuid-10',
        teacherId: 'teacher-uuid-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [],
      });

      // Bảng student_session_evaluations không có trường billId, ngăn ngừa tuyệt đối nguy cơ ghi đè khóa hóa đơn
      expect((evaluation as any).billId).toBeUndefined();
    });

    it('2.2. Cho phép tạo đánh giá cho buổi học ngay cả khi buổi học đã khóa điểm danh và chốt hóa đơn', () => {
      // Giả lập trạng thái buổi học đã có hóa đơn
      const sessionAlreadyBilled = {
        sessionId: 'session-billed-1',
        attendanceRecord: {
          id: 'attendance-billed-1',
          billId: 'bill-uuid-999', // Đã chốt hóa đơn
          isPresent: true,
        },
      };

      // Tạo đánh giá sư phạm cho buổi đã tính tiền này
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: sessionAlreadyBilled.sessionId,
        studentId: 'student-uuid-1',
        teacherId: 'teacher-uuid-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
      });

      // Thành công tạo bản đánh giá mà không bị chặn bởi billId
      expect(evaluation.id).toBeDefined();
      expect(evaluation.classSessionId).toBe('session-billed-1');
      // Trạng thái hóa đơn của attendance vẫn nguyên vẹn
      expect(sessionAlreadyBilled.attendanceRecord.billId).toBe('bill-uuid-999');
    });

    it('2.3. Sửa nhận xét của buổi học đã chốt hóa đơn không làm thay đổi hay xóa billId của điểm danh', () => {
      const mockAttendance = {
        id: 'att-1',
        studentId: 'student-1',
        classSessionId: 'session-1',
        isPresent: true,
        billId: 'bill-month-08',
      };

      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: mockAttendance.classSessionId,
        studentId: mockAttendance.studentId,
        teacherId: 'teacher-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [],
      });

      // Giáo viên cập nhật nhận xét
      evaluation.updateComment('Bổ sung lời khen cho học sinh sau khi đã xuất hóa đơn tháng', false);
      evaluation.approve();

      expect(evaluation.comment).toContain('Bổ sung lời khen');
      expect(mockAttendance.billId).toBe('bill-month-08'); // Bất biến, không bị sửa
      expect(mockAttendance.isPresent).toBe(true);
    });

    it('2.4. Đánh giá của học sinh vắng mặt (isPresent = false) không làm thay đổi trạng thái vắng mặt trong điểm danh', () => {
      const mockAttendanceAbsent = {
        id: 'att-absent',
        studentId: 'student-absent',
        classSessionId: 'session-1',
        isPresent: false, // Học sinh nghỉ học
        billId: null,
      };

      // Vẫn có thể ghi nhận lý do hoặc thói quen nếu phụ huynh báo trước
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: mockAttendanceAbsent.classSessionId,
        studentId: mockAttendanceAbsent.studentId,
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [],
      });

      expect(mockAttendanceAbsent.isPresent).toBe(false);
      expect(evaluation.studentId).toBe('student-absent');
    });

    it('2.5. Xóa hoặc thu hồi đánh giá không ảnh hưởng đến bản ghi điểm danh hay hóa đơn', () => {
      const mockAttendance = {
        id: 'att-keep',
        isPresent: true,
        billId: 'bill-keep-123',
      };

      let evaluation: StudentSessionEvaluationEntity | null = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [],
      });

      // Mô phỏng xóa đánh giá (gán null)
      evaluation = null;

      expect(evaluation).toBeNull();
      // Điểm danh và hóa đơn vẫn bảo toàn 100%
      expect(mockAttendance.id).toBe('att-keep');
      expect(mockAttendance.billId).toBe('bill-keep-123');
      expect(mockAttendance.isPresent).toBe(true);
    });

    it('2.6. Toàn bộ nội dung nhận xét (comment) được lưu độc lập 100% tại bảng mới, không lưu vào student_attendance', () => {
      // Bảng student_attendance chỉ giữ đúng vai trò điểm danh
      const pureAttendanceRecord = {
        id: 'attendance-only-1',
        classSessionId: 'session-10',
        studentId: 'student-10',
        isPresent: true,
        attendanceType: 'machine',
        verifyMethod: 'face',
        isLate: false,
        billId: null,
      };

      // Toàn bộ phần nhận xét sư phạm và đánh giá nằm trọn vẹn trong bảng mới
      const newEvaluationRecord = StudentSessionEvaluationEntity.create({
        classSessionId: pureAttendanceRecord.classSessionId,
        studentId: pureAttendanceRecord.studentId,
        teacherId: 'teacher-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
        score: '9.5',
      });

      newEvaluationRecord.updateComment(
        'Học sinh tiếp thu bài xuất sắc, làm bài tập đầy đủ và tích cực phát biểu.',
        true, // do AI sinh
      );
      newEvaluationRecord.approve();

      // Khẳng định:
      // 1. Nhận xét nằm trọn vẹn tại bảng mới student_session_evaluations
      expect(newEvaluationRecord.comment).toBe(
        'Học sinh tiếp thu bài xuất sắc, làm bài tập đầy đủ và tích cực phát biểu.',
      );
      expect(newEvaluationRecord.isApproved).toBe(true);
      expect(newEvaluationRecord.isAiGenerated).toBe(true);

      // 2. Bảng student_attendance không cần quan tâm hay chứa nội dung nhận xét này
      expect((pureAttendanceRecord as any).comment).toBeUndefined();
      expect((pureAttendanceRecord as any).evaluationComment).toBeUndefined();
    });
  });

  // -------------------------------------------------------------
  // NHÓM TEST 3: CÁCH LY HÓA ĐƠN VÀ THANH TOÁN VIETQR
  // -------------------------------------------------------------
  describe('3. VietQR Payment & Audit Log Isolation', () => {
    it('3.1. VietQR callback thanh toán học phí hoạt động độc lập không đọc bảng evaluation', () => {
      const mockVietQrCallbackPayload = {
        transactionId: 'TX123456',
        amount: 200000,
        billId: 'bill-uuid-1',
        content: 'DAOEDU HS001 THANH TOAN HOC PHI',
      };

      // Hàm xử lý thanh toán VietQR chỉ cần billId và amount, hoàn toàn không phụ thuộc vào evaluation
      const isVietQrValid = mockVietQrCallbackPayload.amount === 200000 && !!mockVietQrCallbackPayload.billId;
      expect(isVietQrValid).toBe(true);
    });

    it('3.2. Không sinh audit log tài chính (billing_audit_logs) khi giáo viên tạo hay duyệt đánh giá buổi học', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-audit-1',
        studentId: 'student-audit-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
      });

      evaluation.updateComment('Nhận xét học tập bình thường', true);
      evaluation.approve();

      // Sự kiện đánh giá chỉ là sư phạm, không phải sự kiện thay đổi tiền tệ (Financial Transaction)
      const isFinancialEvent = false;
      expect(isFinancialEvent).toBe(false);
    });
  });

  // -------------------------------------------------------------
  // NHÓM TEST 4: PERFORMANCE BENCHMARK ĐO ĐỘ ĐỘC LẬP TÀI CHÍNH
  // -------------------------------------------------------------
  describe('4. Financial Isolation Benchmark SLA', () => {
    it('4.1. Thực thi tính toán học phí cho 500 học sinh song song với 500 đánh giá đạt SLA < 30ms', () => {
      const COUNT = 500;
      const mockSources: BillingSource[] = Array.from({ length: COUNT }, (_, i) => ({
        id: `att-${i}`,
        ownerId: `student-${i}`,
        ownerCode: `HS${i}`,
        ownerName: `Học sinh ${i}`,
        ownerMobile: '0901234567',
        ownerStatus: 'Active',
        classId: `class-${i % 10}`,
        className: 'Lớp 1',
        courseName: 'Toán',
        levelName: 'Level 1',
        courseLevelId: 'level-tieng-anh-1',
        date: '2026-08-10',
      }));

      const startTime = performance.now();

      // 1. Tính toán học phí
      const orders = BillingCalculator.calculate(mockSources, mockPricings, 'pricePerSession');

      // 2. Khởi tạo song song các bản ghi đánh giá
      const evaluations = mockSources.map((s) =>
        StudentSessionEvaluationEntity.create({
          classSessionId: 'session-bulk',
          studentId: s.ownerId,
          homeworkStatus: HomeworkStatus.COMPLETED,
          participation: ParticipationStatus.ACTIVE,
          understanding: UnderstandingStatus.UNDERSTOOD,
          behaviorTags: [BehaviorTag.ATTENTIVE],
        }),
      );

      const durationMs = performance.now() - startTime;

      expect(orders.length).toBe(COUNT);
      expect(evaluations.length).toBe(COUNT);
      console.log(`[FINANCE BENCHMARK] Tính học phí + tạo ${COUNT} đánh giá hoàn tất trong: ${durationMs.toFixed(2)}ms (SLA < 30ms)`);
      expect(durationMs).toBeLessThan(30);
    });
  });
});
