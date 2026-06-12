import { Center } from '../entities/center.entity';

export interface GetCentersQuery {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  province?: string;
}

export abstract class ICenterRepository {
  abstract save(center: Center): Promise<Center>;
  abstract findAll(): Promise<Center[]>;
  abstract findPaginated(query: GetCentersQuery): Promise<{ centers: Center[]; total: number }>;
  abstract findById(id: string): Promise<Center | null>;
  abstract delete(id: string): Promise<boolean>;
}
