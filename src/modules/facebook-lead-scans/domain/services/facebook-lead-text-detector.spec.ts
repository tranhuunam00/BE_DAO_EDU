import { FacebookLeadTextDetector } from './facebook-lead-text-detector';

describe('FacebookLeadTextDetector', () => {
  it('detects parent demand from comment text and education context', () => {
    const result = new FacebookLeadTextDetector().analyze([
      {
        kind: 'COMMENT',
        authorName: 'Phu huynh A',
        text: 'Can tim lop tieng anh cho con lop 7',
        depth: 1,
        contextTexts: ['Can tim lop tieng anh cho con lop 7'],
        sourceUrl: 'https://www.facebook.com/groups/test/posts/1/',
        pageUrl: 'https://www.facebook.com/groups/test/posts/1/',
        postId: '1',
        commentId: 'c1',
        fingerprint: 'fp-1',
      },
    ]);

    expect(result.summary.POTENTIAL_PARENT).toBe(1);
    expect(result.aiCandidates).toHaveLength(1);
    expect(result.aiCandidates[0].leadLevel).not.toBe('NONE');
  });

  it('keeps teacher ads out of AI candidates', () => {
    const result = new FacebookLeadTextDetector().analyze([
      {
        kind: 'COMMENT',
        authorName: 'Co giao B',
        text: 'Mom tham khao lop co B, co nhom nho va khai giang tuan nay',
        depth: 2,
        contextTexts: [
          'Tim lop tieng anh cho con lop 7',
          'Mom tham khao lop co B, co nhom nho va khai giang tuan nay',
        ],
        sourceUrl: 'https://www.facebook.com/groups/test/posts/1/',
        pageUrl: 'https://www.facebook.com/groups/test/posts/1/',
        postId: '1',
        commentId: 'c2',
        fingerprint: 'fp-2',
      },
    ]);

    expect(result.summary.TEACHER_AD).toBe(1);
    expect(result.aiCandidates).toHaveLength(0);
  });
});
