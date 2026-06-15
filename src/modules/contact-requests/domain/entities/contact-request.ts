export const CONTACT_REQUEST_TYPES = [
  'ENROLLMENT',
  'COURSE_CONSULTATION',
  'TECHNICAL_SUPPORT',
  'PARTNERSHIP',
  'OTHER',
] as const;

export const CONTACT_REQUEST_STATUSES = [
  'NEW',
  'CONTACTED',
  'RESOLVED',
] as const;

export type ContactRequestType = (typeof CONTACT_REQUEST_TYPES)[number];
export type ContactRequestStatus = (typeof CONTACT_REQUEST_STATUSES)[number];

export interface ContactRequestProps {
  fullName: string;
  phone: string;
  type: ContactRequestType;
  status: ContactRequestStatus;
}

export class ContactRequest {
  private constructor(private readonly props: ContactRequestProps) {}

  static create(input: {
    fullName: string;
    phone: string;
    type?: ContactRequestType;
  }): ContactRequest {
    const fullName = input.fullName.trim().replace(/\s+/g, ' ');
    const phone = input.phone.trim().replace(/[\s.-]/g, '');

    if (fullName.length < 2 || fullName.length > 120) {
      throw new Error('CONTACT_REQUEST_INVALID_NAME');
    }
    if (!/^(?:\+84|0)\d{9,10}$/.test(phone)) {
      throw new Error('CONTACT_REQUEST_INVALID_PHONE');
    }

    return new ContactRequest({
      fullName,
      phone,
      type: input.type ?? 'ENROLLMENT',
      status: 'NEW',
    });
  }

  toPrimitives(): ContactRequestProps {
    return { ...this.props };
  }
}
