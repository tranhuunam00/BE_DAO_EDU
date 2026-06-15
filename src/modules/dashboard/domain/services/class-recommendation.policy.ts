export interface CandidateClass {
  id: string;
  classCode: string;
  className: string;
  courseName: string;
  levelName: string;
  status: string;
  maxSize: number | null;
  studentCount: number;
  averageAge: number | null;
}

export class ClassRecommendationPolicy {
  recommend(studentAge: number | null, candidates: CandidateClass[]) {
    return candidates
      .map((candidate) => {
        const ageDifference =
          studentAge !== null && candidate.averageAge !== null
            ? Math.abs(studentAge - candidate.averageAge)
            : null;
        const availableSeats =
          candidate.maxSize === null
            ? null
            : candidate.maxSize - candidate.studentCount;
        const score =
          (candidate.status === 'Active' ? 40 : 30) +
          (availableSeats === null ? 20 : Math.min(availableSeats * 4, 20)) +
          (ageDifference === null ? 15 : Math.max(25 - ageDifference * 5, 0));
        return {
          classId: candidate.id,
          classCode: candidate.classCode,
          className: candidate.className,
          courseName: candidate.courseName,
          levelName: candidate.levelName,
          availableSeats,
          score: Math.round(score),
          reasons: [
            candidate.status === 'Active' ? 'Lớp đang hoạt động' : 'Lớp đang chuẩn bị mở',
            availableSeats === null ? 'Không giới hạn sĩ số' : `Còn ${availableSeats} chỗ`,
            ageDifference === null
              ? 'Chưa đủ dữ liệu so khớp độ tuổi'
              : `Độ tuổi lệch khoảng ${ageDifference.toFixed(1)} năm`,
          ],
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }
}
