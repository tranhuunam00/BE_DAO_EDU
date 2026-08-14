import { TimekeepingMatcher, DomainClassSession, TimekeepingLog } from './timekeeping-matcher';

describe('TimekeepingMatcher (TDD Chức năng & Performance SLA)', () => {
    const studentId = 'student-uuid-123';
    const studentCode = '3456';

    // Ca học đơn thường gặp
    const singleSession: DomainClassSession = {
        id: 'session-1',
        className: 'Toán học Ca 1',
        startTime: '14:00',
        endTime: '16:00',
        date: '2026-08-10'
    };

    // 2 ca học liên tiếp sát nhau
    const consecutiveSessions: DomainClassSession[] = [
        {
            id: 'session-1',
            className: 'Toán nâng cao',
            startTime: '14:00',
            endTime: '16:00',
            date: '2026-08-10'
        },
        {
            id: 'session-2',
            className: 'Vật lý nâng cao',
            startTime: '16:00',
            endTime: '18:00',
            date: '2026-08-10'
        }
    ];

    // 2 ca học cách nhau 1 tiếng (gap = 60 phút)
    const gapSessions: DomainClassSession[] = [
        {
            id: 'session-1',
            className: 'Hóa học Ca sáng',
            startTime: '14:00',
            endTime: '16:00',
            date: '2026-08-10'
        },
        {
            id: 'session-2',
            className: 'Hóa học Ca chiều',
            startTime: '17:00',
            endTime: '19:00',
            date: '2026-08-10'
        }
    ];

    describe('1. Kiểm tra Chức năng đối khớp ca đơn (Single Session)', () => {
        it('nên điểm danh Có mặt thành công khi học viên quẹt vào và quẹt ra đúng khung giờ (Check-in & Check-out)', () => {
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T16:05:00+07:00'), verifyMethod: 'face' }
            ];

            const results = TimekeepingMatcher.match(studentId, [singleSession], logs, 60);

            expect(results.length).toBe(1);
            expect(results[0].classSessionId).toBe('session-1');
            expect(results[0].isPresent).toBe(true);
            expect(results[0].isLate).toBe(false);
            expect(results[0].lateMinutes).toBe(0);
            expect(results[0].verifyMethod).toBe('face');
        });

        it('nên ghi nhận đi muộn và tính chính xác số phút đi muộn (Late Check-in)', () => {
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T14:15:30+07:00'), verifyMethod: 'fingerprint' }
            ];

            const results = TimekeepingMatcher.match(studentId, [singleSession], logs, 60);

            expect(results.length).toBe(1);
            expect(results[0].isPresent).toBe(true);
            expect(results[0].isLate).toBe(true);
            expect(results[0].lateMinutes).toBe(15); // Muộn 15 phút
            expect(results[0].verifyMethod).toBe('fingerprint');
        });
    });

    describe('2. Kiểm tra Logic 2 Ca liên tiếp (Consecutive Sessions)', () => {
        it('nên tự động thừa kế điểm danh Có mặt cho Ca 2 khi học viên chỉ quẹt vào Ca 1 lúc đầu giờ (Auto-rollover)', () => {
            // Học sinh chỉ quẹt 2 lần: vào đầu giờ (13:50) và về cuối giờ (18:05)
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T18:05:00+07:00'), verifyMethod: 'face' }
            ];

            const results = TimekeepingMatcher.match(studentId, consecutiveSessions, logs, 60);

            expect(results.length).toBe(2);
            // Ca 1 khớp
            const res1 = results.find(r => r.classSessionId === 'session-1');
            expect(res1?.isPresent).toBe(true);
            expect(res1?.isLate).toBe(false);

            // Ca 2 tự động rollover thành công
            const res2 = results.find(r => r.classSessionId === 'session-2');
            expect(res2?.isPresent).toBe(true);
            expect(res2?.note).toContain('thừa kế');
        });

        it('nên hủy tự động điểm danh của Ca 2 nếu phát hiện học sinh quẹt ra đi về giữa chừng lúc giao ca (Ốm về)', () => {
            // Học sinh quẹt vào Ca 1 (13:50), nhưng quẹt ra đi về lúc giao ca (16:02)
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T16:02:00+07:00'), verifyMethod: 'face' } // Quẹt ra về
            ];

            const results = TimekeepingMatcher.match(studentId, consecutiveSessions, logs, 60);

            // Ca 1 vẫn được tính là Có mặt
            const res1 = results.find(r => r.classSessionId === 'session-1');
            expect(res1?.isPresent).toBe(true);

            // Ca 2 phải bị hủy điểm danh tự động (isPresent = false) do đã quẹt ra về giữa chừng
            const res2 = results.find(r => r.classSessionId === 'session-2');
            expect(res2?.isPresent).toBe(false);
            expect(res2?.note).toContain('ra về');
        });
    });

    describe('3. Kiểm tra Ca cách nhau có khoảng nghỉ (Gap Sessions)', () => {
        it('nên hủy điểm danh Ca 2 nếu học sinh quẹt đi ra về trong khoảng nghỉ 1 tiếng ở giữa (gap <= 60)', () => {
            // Ca 1 (14-16) và Ca 2 (17-19) có gap là 60 phút
            // Học sinh vào Ca 1 lúc 13:50, nhưng ốm đi ra quẹt máy lúc 16:15
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T16:15:00+07:00'), verifyMethod: 'face' }
            ];

            const results = TimekeepingMatcher.match(studentId, gapSessions, logs, 60);

            const res1 = results.find(r => r.classSessionId === 'session-1');
            expect(res1?.isPresent).toBe(true);

            // Ca 2 phải bị hủy tự động điểm danh
            const res2 = results.find(r => r.classSessionId === 'session-2');
            expect(res2?.isPresent).toBe(false);
            expect(res2?.note).toContain('ra về');
        });
    });

    describe('3.5. Kiểm tra các trường hợp đặc biệt (Special Scenarios)', () => {
        it('nên lọc bỏ các lượt quẹt trùng lặp trong vòng 5 phút (Anti-double-scan)', () => {
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:51:30+07:00'), verifyMethod: 'face' } // Quẹt đúp
            ];

            const results = TimekeepingMatcher.match(studentId, [singleSession], logs, 60);

            // Chỉ tính lượt quẹt đầu tiên, lượt thứ hai bị bỏ qua
            expect(results.length).toBe(1);
            expect(results[0].isPresent).toBe(true);
        });

        it('nên ghi nhận điểm danh đi muộn khi quẹt thẻ ở giữa ca học (Active Session Late In)', () => {
            // Ca học: 14:00 - 16:00. Học sinh quẹt lúc 14:45 (muộn 45 phút)
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T14:45:00+07:00'), verifyMethod: 'face' }
            ];

            const results = TimekeepingMatcher.match(studentId, [singleSession], logs, 60);

            expect(results.length).toBe(1);
            expect(results[0].isPresent).toBe(true);
            expect(results[0].isLate).toBe(true);
            expect(results[0].lateMinutes).toBe(45);
        });

        it('nên ghi nhận có mặt lại nếu học sinh quẹt vào lại sau khi đã quẹt ra về sớm (Re-entry after early leave)', () => {
            // Ca 1: 14-16, Ca 2: 16-18
            // 1. Quẹt vào 13:50 -> cả 2 ca Có mặt
            // 2. Quẹt ra 15:55 -> Ca 2 bị hủy điểm danh (Vắng)
            // 3. Quẹt vào lại 16:10 -> Ca 2 phải được khôi phục thành Có mặt (Muộn 10 phút)
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T15:55:00+07:00'), verifyMethod: 'face' },
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T16:10:00+07:00'), verifyMethod: 'face' }
            ];

            const results = TimekeepingMatcher.match(studentId, consecutiveSessions, logs, 60);

            expect(results.length).toBe(2);
            const res2 = results.find(r => r.classSessionId === 'session-2');
            expect(res2?.isPresent).toBe(true);
            expect(res2?.isLate).toBe(true);
            expect(res2?.lateMinutes).toBe(10);
            expect(res2?.note).toContain('quay lại');
        });

        it('nên gắn cờ cảnh báo thiếu quẹt ra hoặc thiếu quẹt vào (Missing Check-in / Check-out alerts)', () => {
            // Học sinh chỉ quẹt vào 13:50 nhưng không quẹt ra
            const logs: TimekeepingLog[] = [
                { studentId, employeeNo: studentCode, eventTime: new Date('2026-08-10T13:50:00+07:00'), verifyMethod: 'face' }
            ];

            const results = TimekeepingMatcher.match(studentId, [singleSession], logs, 60);

            expect(results.length).toBe(1);
            expect(results[0].isPresent).toBe(true);
            expect(results[0].note).toContain('Thiếu quẹt ra');
        });
    });

    describe('4. Performance SLA Benchmark Test', () => {
        it('nên đối khớp và xử lý chính xác 10,000 lượt quẹt của học viên trong vòng dưới 50ms (SLA Limit)', () => {
            // 1. Arrange: Khởi tạo dataset lớn 10,000 lượt quẹt
            const mockLogs: TimekeepingLog[] = Array.from({ length: 10000 }, (_, i) => {
                const baseTime = new Date('2026-08-10T13:00:00+07:00');
                // Tạo các lượt quẹt rải rác mỗi lượt cách nhau 3 giây
                const eventTime = new Date(baseTime.getTime() + i * 3000);
                return {
                    studentId,
                    employeeNo: studentCode,
                    eventTime,
                    verifyMethod: i % 2 === 0 ? 'face' : 'fingerprint'
                };
            });

            // 2. Act: Đo lường thời gian thực thi thuật toán
            const startTime = performance.now();
            const results = TimekeepingMatcher.match(studentId, consecutiveSessions, mockLogs, 60);
            const durationMs = performance.now() - startTime;

            // 3. Assert
            console.log(`[PERFORMANCE BENCHMARK] Thời gian đối khớp 10,000 logs: ${durationMs.toFixed(2)}ms`);
            
            // Đạt tiêu chuẩn chất lượng (SLA < 50ms)
            expect(durationMs).toBeLessThan(50);
            expect(results.length).toBe(2);
        });
    });

    describe('5. parseTimekeepingCode & normalizeEmployeeNo Utility Tests', () => {
        it('nên chuẩn hóa mã số bằng cách bỏ ký tự không phải số và số không ở đầu', () => {
            const { normalizeEmployeeNo } = require('./timekeeping-matcher');
            expect(normalizeEmployeeNo('00012345')).toBe('12345');
            expect(normalizeEmployeeNo('000111112345')).toBe('111112345');
            expect(normalizeEmployeeNo('HV-002026-007')).toBe('2026007');
        });

        it('nên nhận diện đúng loại mã học sinh và giáo viên khi dùng tiền tố', () => {
            const { parseTimekeepingCode } = require('./timekeeping-matcher');
            
            // Student prefix 1111
            const p1 = parseTimekeepingCode('111112345');
            expect(p1.type).toBe('student');
            expect(p1.normalizedCode).toBe('12345');

            // Teacher prefix 222 (new)
            const p2 = parseTimekeepingCode('22212345');
            expect(p2.type).toBe('teacher');
            expect(p2.normalizedCode).toBe('12345');

            // Old prefix 2222 should be treated as teacher starting with 2 (prefix 222 + tail 2026001)
            const p3 = parseTimekeepingCode('2222026001');
            expect(p3.type).toBe('teacher');
            expect(p3.normalizedCode).toBe('2026001'); // because '222' prefix is removed, leaving '2026001'

            // Unknown prefix
            const p4 = parseTimekeepingCode('999912345');
            expect(p4.type).toBe('unknown');
            expect(p4.normalizedCode).toBe('999912345');
        });
    });
});
