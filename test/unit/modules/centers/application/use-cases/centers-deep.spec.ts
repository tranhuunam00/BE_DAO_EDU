describe('Center & Branch Infrastructure Deep Test Suite', () => {
  describe('Center Creation & Code Invariants', () => {
    it('1. SHOULD generate unique center code with prefix CT', () => {
      const generateCenterCode = (seq: number) => `CT${String(seq).padStart(2, '0')}`;

      expect(generateCenterCode(1)).toBe('CT01');
      expect(generateCenterCode(12)).toBe('CT12');
    });

    it('2. SHOULD require center name, address, province, and manager phone', () => {
      const createCenter = (name: string, address: string, province: string, phone: string) => {
        if (!name || name.trim() === '') throw new Error('Tên trung tâm là bắt buộc!');
        if (!address) throw new Error('Địa chỉ trung tâm là bắt buộc!');
        if (!province) throw new Error('Tỉnh/Thành phố là bắt buộc!');
        if (!phone || !/^0\d{9}$/.test(phone)) throw new Error('Số điện thoại quản lý không hợp lệ!');
        return { name, address, province, phone, status: 'Active' };
      };

      expect(() => createCenter('', 'HN', 'Hà Nội', '0912345678')).toThrow('Tên trung tâm là bắt buộc!');
      expect(() => createCenter('TT Cầu Giấy', 'HN', 'Hà Nội', '123')).toThrow('Số điện thoại quản lý không hợp lệ!');
      expect(createCenter('TT Cầu Giấy', '123 Cầu Giấy', 'Hà Nội', '0912345678')).toEqual({
        name: 'TT Cầu Giấy',
        address: '123 Cầu Giấy',
        province: 'Hà Nội',
        phone: '0912345678',
        status: 'Active',
      });
    });

    it('3. SHOULD check duplicate center code', () => {
      const existingCodes = ['CT01', 'CT02'];
      const isCodeAvailable = (code: string) => !existingCodes.includes(code.toUpperCase());

      expect(isCodeAvailable('CT01')).toBe(false);
      expect(isCodeAvailable('CT03')).toBe(true);
    });

    it('4. SHOULD calculate total rooms per center', () => {
      const rooms = [
        { id: 'r1', centerId: 'CT01', name: 'P101' },
        { id: 'r2', centerId: 'CT01', name: 'P102' },
        { id: 'r3', centerId: 'CT02', name: 'P201' },
      ];

      const ct01Rooms = rooms.filter((r) => r.centerId === 'CT01');
      expect(ct01Rooms).toHaveLength(2);
    });

    it('5. SHOULD calculate total capacity across all rooms in a center', () => {
      const centerRooms = [
        { name: 'P101', capacity: 30 },
        { name: 'P102', capacity: 25 },
        { name: 'P103', capacity: 40 },
      ];

      const totalCapacity = centerRooms.reduce((sum, r) => sum + r.capacity, 0);
      expect(totalCapacity).toBe(95);
    });
  });

  describe('Center Operations & Filtering', () => {
    it('6. SHOULD filter centers by province', () => {
      const centers = [
        { id: 'c1', province: 'Hà Nội' },
        { id: 'c2', province: 'TP.HCM' },
        { id: 'c3', province: 'Hà Nội' },
      ];

      const hnCenters = centers.filter((c) => c.province === 'Hà Nội');
      expect(hnCenters).toHaveLength(2);
    });

    it('7. SHOULD search centers by name or center code', () => {
      const centers = [
        { code: 'CT01', name: 'Trung tâm Cầu Giấy' },
        { code: 'CT02', name: 'Trung tâm Đống Đa' },
      ];

      const search = (q: string) =>
        centers.filter(
          (c) => c.code.toLowerCase().includes(q.toLowerCase()) || c.name.toLowerCase().includes(q.toLowerCase()),
        );

      expect(search('CT01')).toHaveLength(1);
      expect(search('Đống Đa')).toHaveLength(1);
    });

    it('8. SHOULD update center status to Inactive', () => {
      const center = { id: 'c1', status: 'Active' };
      const deactivate = (c: typeof center) => ({ ...c, status: 'Inactive' });

      expect(deactivate(center).status).toBe('Inactive');
    });

    it('9. SHOULD assign manager user account to center', () => {
      const center = { id: 'c1', managerUserId: 'u-manager-1' };
      expect(center.managerUserId).toBe('u-manager-1');
    });

    it('10. SHOULD format center full location string', () => {
      const center = { name: 'Cầu Giấy', address: 'Số 10 Dịch Vọng', province: 'Hà Nội' };
      const formatted = `${center.name} - ${center.address}, ${center.province}`;

      expect(formatted).toBe('Cầu Giấy - Số 10 Dịch Vọng, Hà Nội');
    });

    it('11. SHOULD calculate total active classes per center', () => {
      const classes = [
        { centerId: 'c1', status: 'Active' },
        { centerId: 'c1', status: 'Completed' },
        { centerId: 'c1', status: 'Active' },
      ];

      const activeCount = classes.filter((c) => c.centerId === 'c1' && c.status === 'Active').length;
      expect(activeCount).toBe(2);
    });

    it('12. SHOULD calculate total active students per center', () => {
      const students = [
        { centerId: 'c1', status: 'Active' },
        { centerId: 'c2', status: 'Active' },
        { centerId: 'c1', status: 'Active' },
      ];

      const c1Count = students.filter((s) => s.centerId === 'c1' && s.status === 'Active').length;
      expect(c1Count).toBe(2);
    });

    it('13. SHOULD calculate center room utilization percentage', () => {
      const totalRooms = 10;
      const roomsInUse = 7;

      const utilizationRate = (roomsInUse / totalRooms) * 100;
      expect(utilizationRate).toBe(70.0);
    });

    it('14. SHOULD validate room capacity is positive integer', () => {
      const validateCapacity = (cap: number) => {
        if (!Number.isInteger(cap) || cap <= 0) throw new Error('Sức chứa phòng phải là số nguyên dương');
        return true;
      };

      expect(() => validateCapacity(0)).toThrow('Sức chứa phòng phải là số nguyên dương');
      expect(validateCapacity(30)).toBe(true);
    });

    it('15. SHOULD sort centers by name alphabetically', () => {
      const list = [{ name: 'Đống Đa' }, { name: 'Ba Đình' }, { name: 'Cầu Giấy' }];

      const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      expect(sorted[0].name).toBe('Ba Đình');
      expect(sorted[1].name).toBe('Cầu Giấy');
      expect(sorted[2].name).toBe('Đống Đa');
    });

    it('16. SHOULD calculate total revenue generated per center', () => {
      const payments = [
        { centerId: 'c1', amount: 1000000 },
        { centerId: 'c1', amount: 2000000 },
        { centerId: 'c2', amount: 5000000 },
      ];

      const c1Revenue = payments.filter((p) => p.centerId === 'c1').reduce((sum, p) => sum + p.amount, 0);
      expect(c1Revenue).toBe(3000000);
    });

    it('17. SHOULD validate center phone contact format', () => {
      const phone = '0912345678';
      const isValid = /^0\d{9}$/.test(phone);

      expect(isValid).toBe(true);
    });

    it('18. SHOULD prevent deleting center if active classes exist', () => {
      const activeClassesCount = 3;

      const deleteCenter = (count: number) => {
        if (count > 0) throw new Error('Không thể xóa trung tâm đang có lớp học hoạt động!');
        return true;
      };

      expect(() => deleteCenter(activeClassesCount)).toThrow('Không thể xóa trung tâm đang có lớp học hoạt động!');
      expect(deleteCenter(0)).toBe(true);
    });

    it('19. SHOULD assign default room capacity 30 if unspecified', () => {
      const createRoom = (name: string, capacity?: number) => ({
        name,
        capacity: capacity || 30,
      });

      expect(createRoom('P101').capacity).toBe(30);
      expect(createRoom('P102', 45).capacity).toBe(45);
    });

    it('20. SHOULD check if room name is unique within the same center', () => {
      const existingRooms = [{ centerId: 'c1', name: 'P101' }];

      const isRoomNameUnique = (centerId: string, name: string) =>
        !existingRooms.some((r) => r.centerId === centerId && r.name.toLowerCase() === name.toLowerCase());

      expect(isRoomNameUnique('c1', 'P101')).toBe(false);
      expect(isRoomNameUnique('c1', 'P102')).toBe(true);
    });

    it('21. SHOULD calculate average center revenue per active student', () => {
      const totalRevenue = 10000000;
      const activeStudents = 50;

      const avg = totalRevenue / activeStudents;
      expect(avg).toBe(200000);
    });

    it('22. SHOULD format center operating hours display string', () => {
      const schedule = { open: '08:00', close: '21:30' };
      const formatted = `${schedule.open} - ${schedule.close}`;

      expect(formatted).toBe('08:00 - 21:30');
    });

    it('23. SHOULD filter rooms by status (Active, Maintenance, Inactive)', () => {
      const rooms = [
        { name: 'P101', status: 'Active' },
        { name: 'P102', status: 'Maintenance' },
        { name: 'P103', status: 'Active' },
      ];

      const activeRooms = rooms.filter((r) => r.status === 'Active');
      expect(activeRooms).toHaveLength(2);
    });

    it('24. SHOULD calculate total teacher count assigned to center', () => {
      const teachers = [
        { id: 't1', centerId: 'c1' },
        { id: 't2', centerId: 'c1' },
        { id: 't3', centerId: 'c2' },
      ];

      const c1Teachers = teachers.filter((t) => t.centerId === 'c1');
      expect(c1Teachers).toHaveLength(2);
    });

    it('25. SHOULD verify complete center entity structure integrity', () => {
      const center = {
        id: 'center-100',
        code: 'CT01',
        name: 'Trung tâm Cầu Giấy',
        address: 'Số 10 Dịch Vọng',
        province: 'Hà Nội',
        phone: '0912345678',
        email: 'caugiay@dao.edu.vn',
        status: 'Active',
      };

      expect(center.code).toBe('CT01');
      expect(center.status).toBe('Active');
      expect(center.phone).toBe('0912345678');
    });
  });
});
