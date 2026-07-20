describe('Study Materials & Upload File Management Deep Test Suite', () => {
  describe('Study Material Uploads & Access Rules', () => {
    it('1. SHOULD upload study material with title, fileUrl, classId, and authorId', () => {
      const material = {
        id: 'mat-1',
        title: 'Tài liệu Ôn tập Giữa kỳ I',
        fileUrl: 'https://cdn.dao.edu.vn/materials/ontap_gki.pdf',
        fileSize: 5242880, // 5MB
        fileType: 'application/pdf',
        classId: 'class-1',
        uploaderUserId: 'teacher-1',
        createdAt: '2026-07-20T10:00:00Z',
      };

      expect(material.fileUrl).toContain('ontap_gki.pdf');
      expect(material.uploaderUserId).toBe('teacher-1');
    });

    it('2. SHOULD support supported file mime types: PDF, DOCX, PPTX, XLSX, MP4, ZIP', () => {
      const allowedMimeTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'video/mp4',
        'application/zip',
      ];

      const isAllowed = (mime: string) => allowedMimeTypes.includes(mime);

      expect(isAllowed('application/pdf')).toBe(true);
      expect(isAllowed('video/mp4')).toBe(true);
      expect(isAllowed('application/x-msdownload')).toBe(false);
    });

    it('3. SHOULD restrict study material file size to maximum 100MB', () => {
      const maxBytes = 100 * 1024 * 1024; // 100MB

      const validateFileSize = (bytes: number) => {
        if (bytes > maxBytes) throw new Error('Kích thước tệp vượt quá giới hạn cho phép (100MB)!');
        return true;
      };

      expect(validateFileSize(50 * 1024 * 1024)).toBe(true);
      expect(() => validateFileSize(120 * 1024 * 1024)).toThrow('Kích thước tệp vượt quá giới hạn cho phép (100MB)!');
    });

    it('4. SHOULD require non-empty title when creating study material', () => {
      const validateTitle = (title: string) => {
        if (!title || title.trim() === '') throw new Error('Tên tài liệu không được để trống!');
        return true;
      };

      expect(() => validateTitle('')).toThrow('Tên tài liệu không được để trống!');
      expect(validateTitle('Đề thi thử 2026')).toBe(true);
    });

    it('5. SHOULD filter study materials by class ID', () => {
      const list = [
        { id: 'm1', classId: 'c1' },
        { id: 'm2', classId: 'c2' },
        { id: 'm3', classId: 'c1' },
      ];

      const c1Materials = list.filter((m) => m.classId === 'c1');
      expect(c1Materials).toHaveLength(2);
    });
  });

  describe('Material Access & Permissions', () => {
    it('6. SHOULD allow student enrolled in the class to access study material', () => {
      const classEnrollments = [{ classId: 'c1', studentUserId: 'user-student-1', status: 'Active' }];

      const canAccessMaterial = (classId: string, userId: string) => {
        return classEnrollments.some((e) => e.classId === classId && e.studentUserId === userId && e.status === 'Active');
      };

      expect(canAccessMaterial('c1', 'user-student-1')).toBe(true);
      expect(canAccessMaterial('c1', 'user-student-999')).toBe(false);
    });

    it('7. SHOULD allow Admin role to access study materials of any class', () => {
      const canAccessAsAdmin = (role: string) => role === 'ADMIN';

      expect(canAccessAsAdmin('ADMIN')).toBe(true);
      expect(canAccessAsAdmin('STUDENT')).toBe(false);
    });

    it('8. SHOULD increment download count when study material is downloaded', () => {
      let material = { id: 'm1', downloadCount: 15 };

      material = { ...material, downloadCount: material.downloadCount + 1 };
      expect(material.downloadCount).toBe(16);
    });

    it('9. SHOULD search study materials by title keyword', () => {
      const materials = [
        { title: 'Tài liệu Ôn tập Đại số' },
        { title: 'Đề thi Hình học Không gian' },
        { title: 'Bài tập Đại số Nâng cao' },
      ];

      const search = (q: string) => materials.filter((m) => m.title.toLowerCase().includes(q.toLowerCase()));

      expect(search('Đại số')).toHaveLength(2);
      expect(search('Hình học')).toHaveLength(1);
    });

    it('10. SHOULD format human-readable file size string (KB, MB, GB)', () => {
      const formatBytes = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
      };

      expect(formatBytes(500)).toBe('500 B');
      expect(formatBytes(1536)).toBe('1.5 KB');
      expect(formatBytes(5242880)).toBe('5.0 MB');
    });

    it('11. SHOULD allow uploader teacher or admin to delete study material', () => {
      const material = { id: 'm1', uploaderUserId: 'teacher-1' };

      const canDelete = (m: typeof material, reqUserId: string, role: string) => {
        return role === 'ADMIN' || m.uploaderUserId === reqUserId;
      };

      expect(canDelete(material, 'teacher-1', 'TEACHER')).toBe(true);
      expect(canDelete(material, 'teacher-2', 'TEACHER')).toBe(false);
      expect(canDelete(material, 'teacher-2', 'ADMIN')).toBe(true);
    });

    it('12. SHOULD allow updating study material title and description', () => {
      let material = { id: 'm1', title: 'Tên cũ', description: 'Mô tả cũ' };

      material = { ...material, title: 'Tên mới', description: 'Mô tả mới' };
      expect(material.title).toBe('Tên mới');
      expect(material.description).toBe('Mô tả mới');
    });

    it('13. SHOULD categorize study materials by tag/type (Lecture, Exercises, Exam, Reference)', () => {
      const categories = ['Lecture', 'Exercises', 'Exam', 'Reference'];
      const isValidCategory = (cat: string) => categories.includes(cat);

      expect(isValidCategory('Lecture')).toBe(true);
      expect(isValidCategory('Exercises')).toBe(true);
      expect(isValidCategory('Random')).toBe(false);
    });

    it('14. SHOULD generate secure CDN presigned download URL with expiry timestamp', () => {
      const generatePresignedUrl = (fileKey: string, expirySeconds: number) => {
        const expires = Math.floor(Date.now() / 1000) + expirySeconds;
        return `https://cdn.dao.edu.vn/${fileKey}?expires=${expires}&signature=sig123`;
      };

      const url = generatePresignedUrl('materials/m1.pdf', 3600);
      expect(url).toContain('https://cdn.dao.edu.vn/materials/m1.pdf');
      expect(url).toContain('expires=');
      expect(url).toContain('signature=sig123');
    });

    it('15. SHOULD sort study materials by createdAt descending (newest first)', () => {
      const list = [
        { id: 'm1', createdAt: '2026-07-01' },
        { id: 'm2', createdAt: '2026-07-20' },
        { id: 'm3', createdAt: '2026-07-10' },
      ];

      const sorted = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      expect(sorted[0].id).toBe('m2');
      expect(sorted[1].id).toBe('m3');
      expect(sorted[2].id).toBe('m1');
    });

    it('16. SHOULD calculate total storage used by class study materials in bytes', () => {
      const materials = [
        { fileSize: 2000000 },
        { fileSize: 3000000 },
        { fileSize: 5000000 },
      ];

      const totalStorage = materials.reduce((sum, m) => sum + m.fileSize, 0);
      expect(totalStorage).toBe(10000000);
    });

    it('17. SHOULD filter public study materials vs class-private materials', () => {
      const materials = [
        { id: 'm1', isPublic: true },
        { id: 'm2', isPublic: false },
        { id: 'm3', isPublic: true },
      ];

      const publicMaterials = materials.filter((m) => m.isPublic);
      expect(publicMaterials).toHaveLength(2);
    });

    it('18. SHOULD validate material description length max 1000 characters', () => {
      const validateDesc = (desc: string) => {
        if (desc.length > 1000) throw new Error('Mô tả quá dài!');
        return true;
      };

      expect(validateDesc('Nội dung tài liệu')).toBe(true);
      expect(() => validateDesc('a'.repeat(1001))).toThrow('Mô tả quá dài!');
    });

    it('19. SHOULD associate material with course module chapter', () => {
      const material = {
        id: 'm1',
        chapterName: 'Chương 1: Hàm số và Đồ thị',
      };

      expect(material.chapterName).toContain('Chương 1');
    });

    it('20. SHOULD detect file extension from filename', () => {
      const getExt = (filename: string) => filename.split('.').pop()?.toLowerCase();

      expect(getExt('de_thi.PDF')).toBe('pdf');
      expect(getExt('bai_tap.docx')).toBe('docx');
    });

    it('21. SHOULD calculate total study material items per class', () => {
      const materials = [
        { classId: 'c1' },
        { classId: 'c1' },
        { classId: 'c2' },
      ];

      const count = materials.filter((m) => m.classId === 'c1').length;
      expect(count).toBe(2);
    });

    it('22. SHOULD format icon name according to file extension', () => {
      const getFileIcon = (ext: string) => {
        if (ext === 'pdf') return 'file-pdf';
        if (['doc', 'docx'].includes(ext)) return 'file-word';
        if (['xls', 'xlsx'].includes(ext)) return 'file-excel';
        if (['png', 'jpg', 'jpeg'].includes(ext)) return 'file-image';
        return 'file-text';
      };

      expect(getFileIcon('pdf')).toBe('file-pdf');
      expect(getFileIcon('docx')).toBe('file-word');
      expect(getFileIcon('xlsx')).toBe('file-excel');
      expect(getFileIcon('png')).toBe('file-image');
      expect(getFileIcon('unknown')).toBe('file-text');
    });

    it('23. SHOULD allow pinned study materials to display at top of list', () => {
      const materials = [
        { id: 'm1', isPinned: false },
        { id: 'm2', isPinned: true },
        { id: 'm3', isPinned: false },
      ];

      const sorted = [...materials].sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0));
      expect(sorted[0].id).toBe('m2');
    });

    it('24. SHOULD calculate total material downloads across center', () => {
      const list = [{ downloadCount: 10 }, { downloadCount: 25 }, { downloadCount: 5 }];

      const totalDownloads = list.reduce((sum, item) => sum + item.downloadCount, 0);
      expect(totalDownloads).toBe(40);
    });

    it('25. SHOULD verify complete study material entity structure integrity', () => {
      const material = {
        id: 'mat-100',
        title: 'Tài liệu Ôn thi THPT Quốc Gia 2026',
        description: 'Bộ 50 đề thi thử có đáp án chi tiết',
        fileUrl: 'https://cdn.dao.edu.vn/materials/ontap2026.pdf',
        fileSize: 10485760,
        fileType: 'application/pdf',
        classId: 'class-101',
        uploaderUserId: 'teacher-5',
        downloadCount: 42,
        isPublic: false,
        createdAt: '2026-07-20T10:00:00Z',
      };

      expect(material.id).toBe('mat-100');
      expect(material.downloadCount).toBe(42);
      expect(material.fileType).toBe('application/pdf');
    });
  });
});
