import { performance } from 'perf_hooks';
import {
  StudentSessionEvaluationEntity,
  HomeworkStatus,
  ParticipationStatus,
  UnderstandingStatus,
  BehaviorTag,
} from '../../../../src/modules/student-evaluations/domain/entities/student-session-evaluation.entity';
import { GenerateAiEvaluationCommentUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/generate-ai-evaluation-comment.use-case';
import { SaveSessionEvaluationsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/save-session-evaluations.use-case';
import { IStudentSessionEvaluationRepositoryPort } from '../../../../src/modules/student-evaluations/application/ports/student-session-evaluation-repository.port';
import { IAiEvaluationGeneratorPort } from '../../../../src/modules/student-evaluations/application/ports/ai-evaluation-generator.port';

describe('StudentSessionEvaluation (Domain & Application Spec)', () => {
  // -------------------------------------------------------------
  // PHẦN 1: TEST NGHIỆP VỤ DOMAIN ENTITY (DOMAIN LAYER - ZERO DB)
  // -------------------------------------------------------------
  describe('1. Domain Entity Invariants', () => {
    it('khởi tạo thành công bản đánh giá học sinh với các tiêu chí 1-chạm hợp lệ', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
        teacherId: 'teacher-uuid-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
        score: '9.0',
      });

      expect(evaluation.id).toBeDefined();
      expect(evaluation.homeworkStatus).toBe(HomeworkStatus.COMPLETED);
      expect(evaluation.participation).toBe(ParticipationStatus.ACTIVE);
      expect(evaluation.understanding).toBe(UnderstandingStatus.UNDERSTOOD);
      expect(evaluation.behaviorTags).toContain(BehaviorTag.ATTENTIVE);
      expect(evaluation.isApproved).toBe(false);
      expect(evaluation.approvedAt).toBeNull();
    });

    it('cho phép duyệt (approve) đánh giá khi đã có nhận xét và ghi nhận thời gian duyệt', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
        teacherId: 'teacher-uuid-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
      });

      evaluation.updateComment(
        'Hôm nay con tiếp thu bài rất nhanh, hăng hái phát biểu xây dựng bài.',
        true, // isAiGenerated
      );

      evaluation.approve();

      expect(evaluation.isApproved).toBe(true);
      expect(evaluation.isAiGenerated).toBe(true);
      expect(evaluation.approvedAt).toBeInstanceOf(Date);
    });

    it('ném ra lỗi nghiệp vụ khi duyệt một bản đánh giá mà chưa có nội dung nhận xét', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
        teacherId: 'teacher-uuid-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [],
      });

      expect(() => evaluation.approve()).toThrow(
        'Không thể duyệt đánh giá khi chưa có nội dung nhận xét',
      );
    });

    it('tự động reset trạng thái duyệt (isApproved = false) khi cập nhật lại tiêu chí đánh giá', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
        teacherId: 'teacher-uuid-1',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [],
      });

      evaluation.updateComment('Nhận xét chuẩn mực', false);
      evaluation.approve();
      expect(evaluation.isApproved).toBe(true);

      // Khi sửa lại tiêu chí đánh giá
      evaluation.updateCriteria({
        homeworkStatus: HomeworkStatus.INCOMPLETE,
      });

      expect(evaluation.isApproved).toBe(false);
      expect(evaluation.approvedAt).toBeNull();
      expect(evaluation.homeworkStatus).toBe(HomeworkStatus.INCOMPLETE);
    });

    it('cho phép hủy duyệt chủ động bằng hàm unapprove()', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
      });
      evaluation.updateComment('Nhận xét chuẩn mực', false);
      evaluation.approve();
      expect(evaluation.isApproved).toBe(true);

      evaluation.unapprove();
      expect(evaluation.isApproved).toBe(false);
      expect(evaluation.approvedAt).toBeNull();
    });

    it('1.5. Giới hạn độ dài nhận xét tối đa (<= 2,000 ký tự) để chống tràn bộ nhớ và lạm dụng', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-uuid-1',
        studentId: 'student-uuid-1',
      });

      const oversizedComment = 'A'.repeat(2001);
      expect(() => evaluation.updateComment(oversizedComment, false)).toThrow(
        'Nội dung nhận xét không được vượt quá 2,000 ký tự',
      );

      const validMaxComment = 'A'.repeat(2000);
      evaluation.updateComment(validMaxComment, false);
      expect(evaluation.comment?.length).toBe(2000);
    });

    it('1.6. Chặn khởi tạo đánh giá khi thiếu classSessionId hoặc studentId bắt buộc', () => {
      expect(() =>
        StudentSessionEvaluationEntity.create({
          classSessionId: '',
          studentId: 'student-1',
        }),
      ).toThrow('classSessionId không được để trống');

      expect(() =>
        StudentSessionEvaluationEntity.create({
          classSessionId: 'session-1',
          studentId: '',
        }),
      ).toThrow('studentId không được để trống');
    });
  });

  // -------------------------------------------------------------
  // PHẦN 2: TEST APPLICATION USE CASES
  // -------------------------------------------------------------
  describe('2. Application Use Cases', () => {
    it('GenerateAiEvaluationCommentUseCase sinh câu nhận xét sư phạm dựa trên đúng tiêu chí 1-chạm', async () => {
      const mockAiPort: IAiEvaluationGeneratorPort = {
        generateComment: jest.fn().mockResolvedValue(
          'Hôm nay Minh tiếp thu bài rất tốt và hăng hái phát biểu. Con cần duy trì phong độ này nhé!',
        ),
      };

      const useCase = new GenerateAiEvaluationCommentUseCase(mockAiPort);
      const result = await useCase.execute({
        studentName: 'Nguyễn Minh',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
      });

      expect(result.comment).toContain('tiếp thu bài rất tốt');
      expect(result.isAiGenerated).toBe(true);
      expect(mockAiPort.generateComment).toHaveBeenCalledTimes(1);
    });

    it('SaveSessionEvaluationsUseCase lưu thành công danh sách đánh giá cho nhiều học sinh trong buổi học', async () => {
      const savedList: StudentSessionEvaluationEntity[] = [];
      const mockRepo: IStudentSessionEvaluationRepositoryPort = {
        saveBatch: jest.fn().mockImplementation(async (evaluations) => {
          savedList.push(...evaluations);
          return evaluations;
        }),
        findBySessionId: jest.fn().mockResolvedValue([]),
        findBySessionAndStudent: jest.fn().mockResolvedValue(null),
      };

      const useCase = new SaveSessionEvaluationsUseCase(mockRepo);
      const input = {
        classSessionId: 'session-uuid-1',
        teacherId: 'teacher-uuid-1',
        evaluations: [
          {
            studentId: 'student-1',
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [BehaviorTag.ATTENTIVE],
            comment: 'Tiếp thu bài xuất sắc',
            isApproved: true,
          },
          {
            studentId: 'student-2',
            homeworkStatus: HomeworkStatus.NOT_DONE,
            participation: ParticipationStatus.PASSIVE,
            understanding: UnderstandingStatus.NOT_UNDERSTOOD,
            behaviorTags: [BehaviorTag.PHONE],
            comment: 'Con cần tập trung hơn và không dùng điện thoại',
            isApproved: true,
          },
        ],
      };

      const result = await useCase.execute(input);

      expect(result.savedCount).toBe(2);
      expect(mockRepo.saveBatch).toHaveBeenCalledTimes(1);
      expect(savedList[0].studentId).toBe('student-1');
      expect(savedList[1].homeworkStatus).toBe(HomeworkStatus.NOT_DONE);
    });
  });

  // -------------------------------------------------------------
  // PHẦN 3: BÀI TEST PERFORMANCE BENCHMARK & GIỚI HẠN THỜI GIAN SLA
  // -------------------------------------------------------------
  describe('3. Performance Benchmark (SLA Time Limit)', () => {
    it('xử lý và khởi tạo batch 1,000 bản ghi đánh giá 1-chạm dưới 30ms (SLA Limit)', () => {
      const BATCH_SIZE = 1000;
      const rawData = Array.from({ length: BATCH_SIZE }, (_, i) => ({
        classSessionId: `session-${i % 10}`,
        studentId: `student-${i}`,
        teacherId: 'teacher-1',
        homeworkStatus: i % 2 === 0 ? HomeworkStatus.COMPLETED : HomeworkStatus.INCOMPLETE,
        participation: i % 3 === 0 ? ParticipationStatus.ACTIVE : ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: i % 5 === 0 ? [BehaviorTag.ATTENTIVE] : [BehaviorTag.TALKATIVE],
        comment: `Nhận xét tự động cho học sinh ${i}`,
        score: '8.0',
      }));

      // Đo thời gian thực thi (Performance Measurement)
      const startTime = performance.now();

      const entities = rawData.map((item) => {
        const entity = StudentSessionEvaluationEntity.create(item);
        entity.updateComment(item.comment, true);
        entity.approve();
        return entity;
      });

      const executionDurationMs = performance.now() - startTime;

      // 1. Kiểm tra tính toàn vẹn (Functional Integrity)
      expect(entities.length).toBe(BATCH_SIZE);
      expect(entities[0].isApproved).toBe(true);
      expect(entities[BATCH_SIZE - 1].isApproved).toBe(true);

      // 2. Kiểm tra giới hạn thời gian SLA (Performance Benchmark < 30ms)
      console.log(
        `[BENCHMARK] Thời gian khởi tạo & duyệt ${BATCH_SIZE} bản đánh giá: ${executionDurationMs.toFixed(2)}ms (SLA < 30ms)`,
      );
      expect(executionDurationMs).toBeLessThan(30);
    });
  });
});
