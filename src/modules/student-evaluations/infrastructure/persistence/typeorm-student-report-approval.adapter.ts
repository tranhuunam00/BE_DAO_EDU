import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  IStudentReportApprovalRepositoryPort,
  ReportType,
  StudentReportApprovalRecord,
} from '../../application/ports/student-report-approval-repository.port';
import { StudentReportApprovalOrmEntity } from '../../../../infrastructure/persistence/typeorm/entities/student-report-approval.orm-entity';

@Injectable()
export class TypeOrmStudentReportApprovalAdapter implements IStudentReportApprovalRepositoryPort {
  constructor(
    @InjectRepository(StudentReportApprovalOrmEntity)
    private readonly repo: Repository<StudentReportApprovalOrmEntity>,
  ) {}

  async findApproval(
    studentId: string,
    reportType: ReportType,
    periodNumber: number,
    year: number,
  ): Promise<StudentReportApprovalRecord | null> {
    const found = await this.repo.findOne({
      where: { studentId, reportType, periodNumber, year },
      relations: { approvedByUser: true },
    });

    if (!found) return null;

    return this.mapToRecord(found);
  }

  async saveApproval(
    data: Omit<StudentReportApprovalRecord, 'id'> & { id?: string },
  ): Promise<StudentReportApprovalRecord> {
    let entity = await this.repo.findOne({
      where: {
        studentId: data.studentId,
        reportType: data.reportType,
        periodNumber: data.periodNumber,
        year: data.year,
      },
    });

    if (entity) {
      entity.isApproved = data.isApproved;
      entity.approvedByUserId = data.approvedByUserId || null;
      entity.approvedAt = data.approvedAt || null;
      entity.sentToZaloAt = data.sentToZaloAt || null;
      if (data.commendation !== undefined) entity.commendation = data.commendation;
      if (data.suggestion !== undefined) entity.suggestion = data.suggestion;
    } else {
      entity = this.repo.create({
        studentId: data.studentId,
        reportType: data.reportType,
        periodNumber: data.periodNumber,
        year: data.year,
        isApproved: data.isApproved,
        approvedByUserId: data.approvedByUserId || null,
        approvedAt: data.approvedAt || null,
        sentToZaloAt: data.sentToZaloAt || null,
        commendation: data.commendation || null,
        suggestion: data.suggestion || null,
      });
    }

    const saved = await this.repo.save(entity);
    return this.mapToRecord(saved);
  }

  async findApprovalsByStudents(
    studentIds: string[],
    reportType: ReportType,
    periodNumber: number,
    year: number,
  ): Promise<Map<string, StudentReportApprovalRecord>> {
    if (!studentIds.length) return new Map();

    const list = await this.repo.find({
      where: {
        studentId: In(studentIds),
        reportType,
        periodNumber,
        year,
      },
      relations: { approvedByUser: true },
    });

    const map = new Map<string, StudentReportApprovalRecord>();
    for (const item of list) {
      map.set(item.studentId, this.mapToRecord(item));
    }
    return map;
  }

  private mapToRecord(entity: StudentReportApprovalOrmEntity): StudentReportApprovalRecord {
    const user = entity.approvedByUser;
    const name = user ? user.name || user.email : undefined;

    return {
      id: entity.id,
      studentId: entity.studentId,
      reportType: entity.reportType,
      periodNumber: entity.periodNumber,
      year: entity.year,
      isApproved: entity.isApproved,
      approvedByUserId: entity.approvedByUserId,
      approvedByName: name,
      approvedAt: entity.approvedAt,
      sentToZaloAt: entity.sentToZaloAt,
      commendation: entity.commendation,
      suggestion: entity.suggestion,
    };
  }
}
