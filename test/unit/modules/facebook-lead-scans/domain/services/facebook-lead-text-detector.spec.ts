import { FacebookLeadTextDetector } from '../../../../../../src/modules/facebook-lead-scans/domain/services/facebook-lead-text-detector';

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

  it('correctly constructs threadPath showing the hierarchy from post down to target comment', () => {
    const postItem = {
      kind: 'POST',
      authorName: 'DAO EDU',
      text: 'DAO EDU tuyen sinh nam 2026',
      depth: 0,
      postId: '1',
      fingerprint: 'post-fp',
    };
    
    const parentComment = {
      kind: 'COMMENT',
      authorName: 'Phu huynh A',
      text: 'Co lop hoc tieng anh khong trung tam?',
      depth: 1,
      postId: '1',
      commentId: 'c1',
      fingerprint: 'fp-1',
    };

    const targetComment = {
      kind: 'COMMENT',
      authorName: 'Phu huynh B',
      text: 'Con nha em muon tim lop tieng anh lop 7, cho xin hoc phi voi',
      depth: 2,
      parentCommentId: 'c1',
      postId: '1',
      commentId: 'c2',
      fingerprint: 'fp-2',
    };

    const detector = new FacebookLeadTextDetector();
    const result = detector.analyze([postItem, parentComment, targetComment]);

    const candidateB = result.aiCandidates.find(c => c.authorName === 'Phu huynh B');
    expect(candidateB).toBeDefined();
    
    const evidence = candidateB?.evidence[0];
    expect(evidence).toBeDefined();
    expect(evidence?.threadPath).toBeDefined();
    expect(evidence?.threadPath).toHaveLength(3);
    
    expect(evidence?.threadPath?.[0].kind).toBe('POST');
    expect(evidence?.threadPath?.[0].authorName).toBe('DAO EDU');
    expect(evidence?.threadPath?.[1].commentId).toBe('c1');
    expect(evidence?.threadPath?.[1].authorName).toBe('Phu huynh A');
    expect(evidence?.threadPath?.[2].commentId).toBe('c2');
    expect(evidence?.threadPath?.[2].authorName).toBe('Phu huynh B');
  });
});
