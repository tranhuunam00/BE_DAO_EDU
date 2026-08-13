export interface DomainClassSession {
    id: string;
    className: string;
    startTime: string; // "HH:mm"
    endTime: string;   // "HH:mm"
    date: string;      // "YYYY-MM-DD"
}

export interface TimekeepingLog {
    studentId: string | null;
    employeeNo: string;
    eventTime: Date;
    verifyMethod: string;
}

export interface MatchResult {
    classSessionId: string;
    isPresent: boolean;
    attendanceType: 'manual' | 'machine';
    verifyMethod: string | null;
    isLate: boolean;
    lateMinutes: number;
    note: string | null;
}

export class TimekeepingMatcher {
    /**
     * Đối khớp danh sách ca học và nhật ký quẹt thẻ thô của học sinh trong ngày.
     */
    static match(
        studentId: string,
        sessions: DomainClassSession[],
        logs: TimekeepingLog[],
        maxConsecutiveGapMinutes: number = 60
    ): MatchResult[] {
        // 1. Sắp xếp ca học theo thứ tự thời gian bắt đầu
        const sortedSessions = [...sessions].sort((a, b) => a.startTime.localeCompare(b.startTime));

        // 2. Lọc nhật ký của đúng học sinh và sắp xếp theo thời gian tăng dần
        const studentLogs = logs
            .filter(log => log.studentId === studentId)
            .sort((a, b) => getEventTimestamp(a.eventTime) - getEventTimestamp(b.eventTime));

        // 3. Khử quẹt trùng trong vòng 5 phút (Anti-double-scan)
        const filteredLogs: TimekeepingLog[] = [];
        for (const log of studentLogs) {
            if (filteredLogs.length === 0) {
                filteredLogs.push(log);
            } else {
                const prevLog = filteredLogs[filteredLogs.length - 1];
                const timeDiffMs = getEventTimestamp(log.eventTime) - getEventTimestamp(prevLog.eventTime);
                if (timeDiffMs >= 5 * 60 * 1000) {
                    filteredLogs.push(log);
                }
            }
        }

        // Helper chuyển đổi chuỗi giờ thành đối tượng Date
        const getLocalDate = (dateStr: string, timeStr: string) => {
            return new Date(`${dateStr}T${timeStr}:00+07:00`);
        };

        // 4. Khởi tạo mảng kết quả đối khớp cho từng ca
        const results: (MatchResult & { checkInTime: Date | null; checkOutTime: Date | null })[] = sortedSessions.map(s => ({
            classSessionId: s.id,
            isPresent: false,
            attendanceType: 'machine',
            verifyMethod: null,
            isLate: false,
            lateMinutes: 0,
            note: null,
            checkInTime: null,
            checkOutTime: null
        }));

        // Helper tính khoảng trống phút giữa 2 ca
        const getGapBetweenSessions = (s1: DomainClassSession, s2: DomainClassSession) => {
            const end1 = getLocalDate(s1.date, s1.endTime);
            const start2 = getLocalDate(s2.date, s2.startTime);
            return (start2.getTime() - end1.getTime()) / 60000;
        };

        // 5. Chạy máy trạng thái xử lý từng lượt quẹt thô
        for (const log of filteredLogs) {
            const t = getEventTimestamp(log.eventTime);
            let logConsumed = false;

            for (let i = 0; i < sortedSessions.length; i++) {
                const s = sortedSessions[i];
                const res = results[i];

                const sessionStart = getLocalDate(s.date, s.startTime).getTime();
                const sessionEnd = getLocalDate(s.date, s.endTime).getTime();

                // Định nghĩa khung giờ (theo công thức 1 tiếng trước và sau)
                const checkInStart = sessionStart - 60 * 60000;
                const checkInEnd = sessionEnd;
                const checkOutStart = sessionStart;
                const checkOutEnd = sessionEnd + 60 * 60000;

                // Nếu học sinh chưa Có mặt:
                if (!res.isPresent) {
                    // Nếu thời gian quẹt rơi vào khung check-in
                    if (t >= checkInStart && t <= checkInEnd) {
                        res.isPresent = true;
                        res.verifyMethod = log.verifyMethod;
                        res.checkInTime = log.eventTime;
                        
                        // Nếu trước đó ca này bị hủy do quẹt ra giao ca, giờ quẹt lại tức là quay lại học
                        if (res.note && res.note.includes("Hủy điểm danh ca sau")) {
                            res.note = "quay lại lớp học";
                        } else {
                            res.note = null;
                        }

                        // Tính toán đi muộn
                        if (t > sessionStart) {
                            res.isLate = true;
                            res.lateMinutes = Math.floor((t - sessionStart) / 60000);
                        } else {
                            res.isLate = false;
                            res.lateMinutes = 0;
                        }

                        // Tự động liên thông ca học liên tiếp (Auto-rollover)
                        if (i + 1 < sortedSessions.length) {
                            const nextS = sortedSessions[i + 1];
                            const gap = getGapBetweenSessions(s, nextS);
                            if (gap >= 0 && gap <= maxConsecutiveGapMinutes) {
                                const nextRes = results[i + 1];
                                if (!nextRes.isPresent) {
                                    nextRes.isPresent = true;
                                    nextRes.verifyMethod = log.verifyMethod;
                                    nextRes.checkInTime = log.eventTime;
                                    nextRes.note = "Điểm danh tự động thừa kế từ ca học liên tiếp liền trước";
                                }
                            }
                        }
                        logConsumed = true;
                        break; // Log này đã được tiêu thụ cho việc Check-in
                    }
                } 
                // Nếu học sinh đã Có mặt:
                else {
                    // Chỉ xử lý Check-out nếu ca này chưa có checkOutTime
                    if (res.checkOutTime === null && t >= checkOutStart && t <= checkOutEnd) {
                        // Trường hợp đặc biệt: Ca liên thông, học sinh quẹt ra lúc giao ca (Ốm về)
                        if (i + 1 < sortedSessions.length) {
                            const nextS = sortedSessions[i + 1];
                            const gap = getGapBetweenSessions(s, nextS);
                            
                            // Giao lộ transition window
                            const transitionStart = sessionEnd - 15 * 60000;
                            const transitionEnd = nextS ? getLocalDate(nextS.date, nextS.startTime).getTime() + 15 * 60000 : sessionEnd + 30 * 60000;

                            if (gap >= 0 && gap <= maxConsecutiveGapMinutes && t >= transitionStart && t <= transitionEnd) {
                                const nextRes = results[i + 1];
                                // Hủy điểm danh ca sau
                                nextRes.isPresent = false;
                                nextRes.verifyMethod = null;
                                nextRes.checkInTime = null;
                                nextRes.note = "Hủy điểm danh ca sau do quẹt ra về ở khoảng nghỉ giao ca";
                                
                                res.checkOutTime = log.eventTime;
                                logConsumed = true;
                                break;
                            }
                        }

                        // Nếu quẹt ra giữa chừng ca (Về sớm)
                        if (t > sessionStart + 15 * 60000 && t < sessionEnd - 15 * 60000) {
                            res.checkOutTime = log.eventTime;
                            res.note = "Về sớm";
                            
                            // Hủy các ca liên thông tiếp theo
                            if (i + 1 < sortedSessions.length) {
                                const nextS = sortedSessions[i + 1];
                                const gap = getGapBetweenSessions(s, nextS);
                                if (gap >= 0 && gap <= maxConsecutiveGapMinutes) {
                                    const nextRes = results[i + 1];
                                    nextRes.isPresent = false;
                                    nextRes.verifyMethod = null;
                                    nextRes.checkInTime = null;
                                    nextRes.note = "Hủy ca sau do học sinh ra về sớm";
                                }
                            }
                            logConsumed = true;
                            break;
                        }

                        // Nếu quẹt ra lúc tan ca
                        if (res.checkInTime && t > getEventTimestamp(res.checkInTime) + 10 * 60000) {
                            res.checkOutTime = log.eventTime;
                            logConsumed = true;
                            break;
                        }
                    }
                }
            }
        }

        // 6. Hậu xử lý: Gắn cờ cảnh báo quên quẹt (Missing checks)
        for (let i = 0; i < sortedSessions.length; i++) {
            const s = sortedSessions[i];
            const res = results[i];
            
            // Tìm các lượt quẹt thô nằm trong khung check-out của ca học để check quẹt ra
            const sessionEnd = getLocalDate(s.date, s.endTime).getTime();
            const outEnd = sessionEnd + 60 * 60000;

            const hasOutLog = filteredLogs.some(log => {
                const t = getEventTimestamp(log.eventTime);
                return t >= sessionEnd && t <= outEnd;
            });

            if (res.isPresent) {
                // Nếu không có lượt quẹt ra
                if (!res.checkOutTime && !hasOutLog) {
                    const isLastSession = i === sortedSessions.length - 1;
                    const nextSessionNotPresent = !isLastSession && !results[i + 1].isPresent;
                    if (isLastSession || nextSessionNotPresent) {
                        res.note = res.note ? `${res.note}, Thiếu quẹt ra` : "Thiếu quẹt ra";
                    }
                }
            } else {
                // Nếu không quẹt vào nhưng lại có lượt quẹt ra
                if (hasOutLog) {
                    res.isPresent = true;
                    res.verifyMethod = 'machine';
                    res.note = "Thiếu quẹt vào";
                }
            }
        }

        // Trả về mảng kết quả sạch sẽ loại bỏ các trường trung gian
        return results.map(r => ({
            classSessionId: r.classSessionId,
            isPresent: r.isPresent,
            attendanceType: r.attendanceType,
            verifyMethod: r.verifyMethod,
            isLate: r.isLate,
            lateMinutes: r.lateMinutes,
            note: r.note
        }));
    }
}

export function normalizeEmployeeNo(code: string): string {
    if (!code) return '';
    return code.replace(/\D/g, '').replace(/^0+/, '');
}

export const TIMEKEEPING_STUDENT_PREFIX = '1111';
export const TIMEKEEPING_TEACHER_PREFIX = '2222';
export const TIMEKEEPING_TEACHER_PREFIX_LEGACY = '222';

export interface ParsedTimekeepingCode {
    type: 'student' | 'teacher' | 'unknown';
    originalCode: string;
    normalizedCode: string;
    candidates?: string[];
}

export function parseTimekeepingCode(code: string): ParsedTimekeepingCode {
    if (!code) return { type: 'unknown', originalCode: '', normalizedCode: '' };
    
    if (code.startsWith(TIMEKEEPING_STUDENT_PREFIX)) {
        return {
            type: 'student',
            originalCode: code,
            normalizedCode: normalizeEmployeeNo(code.substring(TIMEKEEPING_STUDENT_PREFIX.length)),
        };
    }
    
    if (code.startsWith(TIMEKEEPING_TEACHER_PREFIX) || code.startsWith(TIMEKEEPING_TEACHER_PREFIX_LEGACY)) {
        const candidateNew = normalizeEmployeeNo(code.substring(TIMEKEEPING_TEACHER_PREFIX.length));
        const candidateLegacy = normalizeEmployeeNo(code.substring(TIMEKEEPING_TEACHER_PREFIX_LEGACY.length));
        return {
            type: 'teacher',
            originalCode: code,
            normalizedCode: candidateNew,
            candidates: [candidateNew, candidateLegacy],
        };
    }
    
    return {
        type: 'unknown',
        originalCode: code,
        normalizedCode: normalizeEmployeeNo(code),
    };
}

export function parseDeviceTime(timeStr: string): Date {
    if (!timeStr) return new Date();
    const normalized = timeStr.replace(' ', 'T');
    const hasTimezone = normalized.includes('Z') || normalized.includes('+') || (normalized.includes('-') && normalized.indexOf('-') !== normalized.lastIndexOf('-') && normalized.lastIndexOf('-') > 10);
    return new Date(hasTimezone ? normalized : `${normalized}Z`);
}

export function getEventTimestamp(date: Date): number {
    if (!date) return 0;
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return new Date(`${y}-${m}-${d}T${hh}:${mm}:${ss}+07:00`).getTime();
}

export function getLocalDateString(date: Date): string {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}


