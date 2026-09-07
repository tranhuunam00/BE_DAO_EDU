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
import { GetSessionEvaluationsUseCase } from '../../../../src/modules/student-evaluations/application/use-cases/get-session-evaluations.use-case';
import { IStudentSessionEvaluationRepositoryPort } from '../../../../src/modules/student-evaluations/application/ports/student-session-evaluation-repository.port';
import { IAiEvaluationGeneratorPort } from '../../../../src/modules/student-evaluations/application/ports/ai-evaluation-generator.port';

describe('StudentSessionEvaluation - Extended Edge Cases & Use Case Spec', () => {
  // -------------------------------------------------------------
  // NHÓM TEST 1: CÁC TRƯỜNG HỢP BIÊN & GIÁ TRỊ NGOẠI LỆ (EDGE CASES)
  // -------------------------------------------------------------
  describe('1. Domain Entity Edge Cases & Validation', () => {
    it('1.1. Chấp nhận điểm số hợp lệ từ 0 đến 10 dưới dạng chuỗi và chuẩn hóa', () => {
      const evalValidScore = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        score: '8.5',
      });
      expect(evalValidScore.score).toBe('8.5');

      const evalTen = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        score: '10',
      });
      expect(evalTen.score).toBe('10');
    });

    it('1.2. Ném ra lỗi khi điểm số là số âm (< 0)', () => {
      expect(() =>
        StudentSessionEvaluationEntity.create({
          classSessionId: 'session-1',
          studentId: 'student-1',
          score: '-1.0',
        }),
      ).toThrow('Điểm đánh giá phải nằm trong khoảng từ 0 đến 10');
    });

    it('1.3. Ném ra lỗi khi điểm số vượt quá 10 (> 10)', () => {
      expect(() =>
        StudentSessionEvaluationEntity.create({
          classSessionId: 'session-1',
          studentId: 'student-1',
          score: '10.5',
        }),
      ).toThrow('Điểm đánh giá phải nằm trong khoảng từ 0 đến 10');
    });

    it('1.4. Xử lý chính xác danh sách thói quen (behaviorTags) khi rỗng hoặc có nhiều thẻ', () => {
      const evalNoTags = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        behaviorTags: [],
      });
      expect(evalNoTags.behaviorTags).toEqual([]);

      const evalMultiTags = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        behaviorTags: [BehaviorTag.PHONE, BehaviorTag.TALKATIVE, BehaviorTag.LATE],
      });
      expect(evalMultiTags.behaviorTags.length).toBe(3);
      expect(evalMultiTags.behaviorTags).toContain(BehaviorTag.PHONE);
    });

    it('1.5. Loại bỏ trùng lặp thẻ thói quen nếu truyền trùng lặp', () => {
      const evalDupTags = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        behaviorTags: [BehaviorTag.ATTENTIVE, BehaviorTag.ATTENTIVE],
      });
      expect(evalDupTags.behaviorTags.length).toBe(1);
    });

    it('1.6. Cho phép gán lại giáo viên đánh giá (reassign teacherId)', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
        teacherId: 'teacher-old',
      });
      expect(evaluation.teacherId).toBe('teacher-old');

      evaluation.assignTeacher('teacher-new');
      expect(evaluation.teacherId).toBe('teacher-new');
    });

    it('1.7. Cho phép duyệt lại khi giáo viên chỉnh sửa xong nhận xét', () => {
      const evaluation = StudentSessionEvaluationEntity.create({
        classSessionId: 'session-1',
        studentId: 'student-1',
      });
      evaluation.updateComment('Nhận xét lần 1', false);
      evaluation.approve();
      expect(evaluation.isApproved).toBe(true);

      // Giáo viên sửa lại câu chữ
      evaluation.updateComment('Nhận xét lần 2 hay hơn', false);
      expect(evaluation.isApproved).toBe(false); // Reset để yêu cầu duyệt lại

      evaluation.approve();
      expect(evaluation.isApproved).toBe(true);
    });
  });

  // -------------------------------------------------------------
  // NHÓM TEST 2: AI GENERATION PROMPT & USE CASE EDGE CASES
  // -------------------------------------------------------------
  describe('2. AI Comment Generation Permutations', () => {
    let mockAiPort: IAiEvaluationGeneratorPort;
    let generateAiUseCase: GenerateAiEvaluationCommentUseCase;

    beforeEach(() => {
      mockAiPort = {
        generateComment: jest.fn().mockImplementation(async (criteria) => {
          if (criteria.homeworkStatus === HomeworkStatus.NOT_DONE) {
            return `Em ${criteria.studentName} hôm nay chưa làm bài tập về nhà. Đề nghị con làm bù bài trước buổi tới.`;
          }
          return `Em ${criteria.studentName} hôm nay học tập tích cực, tiếp thu bài tốt.`;
        }),
      };
      generateAiUseCase = new GenerateAiEvaluationCommentUseCase(mockAiPort);
    });

    it('2.1. Sinh nhận xét nhắc nhở sư phạm khi học sinh chưa làm bài tập', async () => {
      const result = await generateAiUseCase.execute({
        studentName: 'Hoàng Nam',
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [BehaviorTag.PHONE],
      });

      expect(result.comment).toContain('chưa làm bài tập');
      expect(result.isAiGenerated).toBe(true);
    });

    it('2.2. Xử lý tên học sinh có dấu tiếng Việt và ký tự đặc biệt', async () => {
      const result = await generateAiUseCase.execute({
        studentName: 'Nguyễn Đỗ Bảo Đan (Nick: Bông)',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
      });

      expect(result.comment).toContain('Nguyễn Đỗ Bảo Đan');
      expect(mockAiPort.generateComment).toHaveBeenCalledWith(
        expect.objectContaining({ studentName: 'Nguyễn Đỗ Bảo Đan (Nick: Bông)' }),
      );
    });

    it('2.3. Fallback câu nhận xét mặc định khi AI service xảy ra lỗi hoặc timeout', async () => {
      const failingAiPort: IAiEvaluationGeneratorPort = {
        generateComment: jest.fn().mockRejectedValue(new Error('Gemini API timeout')),
      };
      const useCaseWithFallback = new GenerateAiEvaluationCommentUseCase(failingAiPort);

      const result = await useCaseWithFallback.execute({
        studentName: 'Minh Khang',
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
      });

      // Vẫn sinh được câu nhận xét sư phạm fallback mà không làm crash ứng dụng
      expect(result.comment).toBeDefined();
      expect(result.comment.length).toBeGreaterThan(10);
      expect(result.isAiGenerated).toBe(false); // Đánh dấu không phải AI trực tiếp
    });

    it('2.4. Nguyên tắc chống ảo giác (Anti-Hallucination Guard): Không được khen hoàn thành bài khi tiêu chí là NOT_DONE', async () => {
      // Khi học sinh không làm bài tập và dùng điện thoại
      const badCriteria = {
        studentName: 'Bảo Long',
        homeworkStatus: HomeworkStatus.NOT_DONE,
        participation: ParticipationStatus.PASSIVE,
        understanding: UnderstandingStatus.NOT_UNDERSTOOD,
        behaviorTags: [BehaviorTag.PHONE],
      };

      const result = await generateAiUseCase.execute(badCriteria);

      // Nhận xét tuyệt đối KHÔNG được ảo giác chứa từ ngữ khen ngợi sai sự thật
      const lowerComment = result.comment.toLowerCase();
      expect(lowerComment).not.toContain('hoàn thành tốt bài tập');
      expect(lowerComment).not.toContain('tiếp thu rất tốt');
      expect(lowerComment).not.toContain('xuất sắc');
      // Phải chỉ ra điểm cần can thiệp thực tế
      expect(lowerComment).toContain('chưa làm bài tập');
    });
  });

  // -------------------------------------------------------------
  // NHÓM TEST 3: BATCH SAVE & RETRIEVAL IDEMPOTENCY
  // -------------------------------------------------------------
  describe('3. Batch Save & Query Use Cases', () => {
    let mockRepo: IStudentSessionEvaluationRepositoryPort;
    let inMemoryStore: Map<string, StudentSessionEvaluationEntity>;

    beforeEach(() => {
      inMemoryStore = new Map();
      mockRepo = {
        saveBatch: jest.fn().mockImplementation(async (evaluations) => {
          for (const ev of evaluations) {
            inMemoryStore.set(`${ev.classSessionId}_${ev.studentId}`, ev);
          }
          return evaluations;
        }),
        findBySessionId: jest.fn().mockImplementation(async (sessionId) => {
          return Array.from(inMemoryStore.values()).filter((e) => e.classSessionId === sessionId);
        }),
        findBySessionAndStudent: jest.fn().mockImplementation(async (sessionId, studentId) => {
          return inMemoryStore.get(`${sessionId}_${studentId}`) || null;
        }),
      };
    });

    it('3.1. Lưu đánh giá hàng loạt có tính lũy kế / cập nhật bản ghi cũ (Idempotency)', async () => {
      const saveUseCase = new SaveSessionEvaluationsUseCase(mockRepo);

      // Lần 1: Lưu đánh giá nháp chưa duyệt
      await saveUseCase.execute({
        classSessionId: 'session-100',
        teacherId: 'teacher-1',
        evaluations: [
          {
            studentId: 'hs-1',
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [],
            comment: 'Lần 1',
            isApproved: false,
          },
        ],
      });

      expect(inMemoryStore.size).toBe(1);
      expect(inMemoryStore.get('session-100_hs-1')?.comment).toBe('Lần 1');
      expect(inMemoryStore.get('session-100_hs-1')?.isApproved).toBe(false);

      // Lần 2: Giáo viên sửa và bấm duyệt
      await saveUseCase.execute({
        classSessionId: 'session-100',
        teacherId: 'teacher-1',
        evaluations: [
          {
            studentId: 'hs-1',
            homeworkStatus: HomeworkStatus.COMPLETED,
            participation: ParticipationStatus.ACTIVE,
            understanding: UnderstandingStatus.UNDERSTOOD,
            behaviorTags: [BehaviorTag.ATTENTIVE],
            comment: 'Lần 2 đã duyệt',
            isApproved: true,
          },
        ],
      });

      // Không bị nhân đôi bản ghi, cập nhật chính xác
      expect(inMemoryStore.size).toBe(1);
      expect(inMemoryStore.get('session-100_hs-1')?.comment).toBe('Lần 2 đã duyệt');
      expect(inMemoryStore.get('session-100_hs-1')?.isApproved).toBe(true);
    });

    it('3.2. GetSessionEvaluationsUseCase lấy đầy đủ danh sách đánh giá của buổi học', async () => {
      const getUseCase = new GetSessionEvaluationsUseCase(mockRepo);
      const saveUseCase = new SaveSessionEvaluationsUseCase(mockRepo);

      await saveUseCase.execute({
        classSessionId: 'session-200',
        evaluations: [
          { studentId: 'hs-A', homeworkStatus: HomeworkStatus.COMPLETED },
          { studentId: 'hs-B', homeworkStatus: HomeworkStatus.INCOMPLETE },
          { studentId: 'hs-C', homeworkStatus: HomeworkStatus.NOT_DONE },
        ],
      });

      const list = await getUseCase.execute('session-200');
      expect(list.length).toBe(3);
      expect(list.map((e) => e.studentId)).toEqual(['hs-A', 'hs-B', 'hs-C']);
    });

    it('3.3. Xử lý an toàn khi lưu danh sách đánh giá rỗng (empty array)', async () => {
      const saveUseCase = new SaveSessionEvaluationsUseCase(mockRepo);
      const result = await saveUseCase.execute({
        classSessionId: 'session-empty',
        evaluations: [],
      });

      expect(result.savedCount).toBe(0);
      expect(mockRepo.saveBatch).toHaveBeenCalledWith([]);
    });

    it('3.4. Chặn lưu đánh giá khi danh sách chứa studentId rỗng hoặc không hợp lệ', async () => {
      const saveUseCase = new SaveSessionEvaluationsUseCase(mockRepo);
      await expect(
        saveUseCase.execute({
          classSessionId: 'session-invalid',
          evaluations: [
            { studentId: '', homeworkStatus: HomeworkStatus.COMPLETED },
          ],
        }),
      ).rejects.toThrow('studentId không được để trống');
    });

    it('3.5. Xử lý đồng thời (Concurrent Double-Click): 2 lần submit song song không làm duplicate bản ghi', async () => {
      const saveUseCase = new SaveSessionEvaluationsUseCase(mockRepo);
      const payload = {
        classSessionId: 'session-concurrent',
        evaluations: [
          {
            studentId: 'hs-race',
            homeworkStatus: HomeworkStatus.COMPLETED,
            comment: 'Lần submit song song',
            isApproved: true,
          },
        ],
      };

      // Giả lập bấm nhanh 2 lần (Promise.all)
      await Promise.all([saveUseCase.execute(payload), saveUseCase.execute(payload)]);

      // Cùng 1 học sinh chỉ có duy nhất 1 bản ghi trong DB
      const storedRecords = await mockRepo.findBySessionId('session-concurrent');
      expect(storedRecords.filter((r) => r.studentId === 'hs-race').length).toBe(1);
    });
  });

  // -------------------------------------------------------------
  // NHÓM TEST 4: PERFORMANCE BENCHMARK USE CASE LEVEL
  // -------------------------------------------------------------
  describe('4. Use Case Batch Performance SLA', () => {
    it('4.1. Thực thi batch save 500 bản ghi học sinh qua Use Case đạt SLA < 30ms', async () => {
      const inMemoryMap = new Map();
      const mockRepo: IStudentSessionEvaluationRepositoryPort = {
        saveBatch: jest.fn().mockImplementation(async (items) => {
          items.forEach((it: any) => inMemoryMap.set(it.studentId, it));
          return items;
        }),
        findBySessionId: jest.fn().mockResolvedValue([]),
        findBySessionAndStudent: jest.fn().mockResolvedValue(null),
      };

      const saveUseCase = new SaveSessionEvaluationsUseCase(mockRepo);

      const items = Array.from({ length: 500 }, (_, i) => ({
        studentId: `student-perf-${i}`,
        homeworkStatus: HomeworkStatus.COMPLETED,
        participation: ParticipationStatus.ACTIVE,
        understanding: UnderstandingStatus.UNDERSTOOD,
        behaviorTags: [BehaviorTag.ATTENTIVE],
        comment: `Đánh giá học sinh ${i}`,
        isApproved: true,
      }));

      const startTime = performance.now();
      const result = await saveUseCase.execute({
        classSessionId: 'session-perf',
        teacherId: 'teacher-1',
        evaluations: items,
      });
      const durationMs = performance.now() - startTime;

      expect(result.savedCount).toBe(500);
      console.log(`[USECASE BENCHMARK] Batch save 500 đánh giá hoàn tất trong: ${durationMs.toFixed(2)}ms (SLA < 30ms)`);
      expect(durationMs).toBeLessThan(30);
    });
  });
});
