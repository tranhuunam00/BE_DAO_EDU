import {
  ContactRequestPersistencePort,
  SavedContactRequest,
} from '../ports/contact-request-persistence.port';
import {
  ListContactRequestsUseCase,
  SubmitContactRequestUseCase,
  UpdateContactRequestStatusUseCase,
} from './manage-contact-requests.use-cases';

describe('Contact request use cases', () => {
  let persistence: jest.Mocked<ContactRequestPersistencePort>;

  beforeEach(() => {
    persistence = {
      create: jest.fn(),
      list: jest.fn(),
      updateStatus: jest.fn(),
    };
  });

  it('creates enrollment contact by default and normalizes phone', async () => {
    persistence.create.mockImplementation(async (input) => saved(input));
    const useCase = new SubmitContactRequestUseCase(persistence);

    await useCase.execute({
      fullName: '  Nguyễn   Văn A ',
      phone: '0912 345 678',
    });

    expect(persistence.create).toHaveBeenCalledWith({
      fullName: 'Nguyễn Văn A',
      phone: '0912345678',
      type: 'ENROLLMENT',
      status: 'NEW',
    });
  });

  it('rejects an invalid phone before persistence', () => {
    const useCase = new SubmitContactRequestUseCase(persistence);

    expect(() =>
      useCase.execute({ fullName: 'Nguyễn Văn A', phone: '123' }),
    ).toThrow('CONTACT_REQUEST_INVALID_PHONE');
    expect(persistence.create).not.toHaveBeenCalled();
  });

  it('caps list size and updates an existing status', async () => {
    persistence.list.mockResolvedValue({ items: [], total: 0 });
    persistence.updateStatus.mockResolvedValue(
      saved({
        fullName: 'Nguyễn Văn A',
        phone: '0912345678',
        type: 'ENROLLMENT',
        status: 'CONTACTED',
      }),
    );

    await new ListContactRequestsUseCase(persistence).execute({
      page: 0,
      limit: 500,
    });
    await new UpdateContactRequestStatusUseCase(persistence).execute(
      'contact-id',
      'CONTACTED',
    );

    expect(persistence.list).toHaveBeenCalledWith({
      page: 1,
      limit: 100,
      type: undefined,
      status: undefined,
    });
    expect(persistence.updateStatus).toHaveBeenCalledWith(
      'contact-id',
      'CONTACTED',
    );
  });
});

function saved(
  input: Omit<SavedContactRequest, 'id' | 'createdAt' | 'updatedAt'>,
): SavedContactRequest {
  return {
    id: 'contact-id',
    createdAt: new Date('2026-06-15T00:00:00.000Z'),
    updatedAt: new Date('2026-06-15T00:00:00.000Z'),
    ...input,
  };
}
