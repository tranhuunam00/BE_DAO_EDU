const http = require('http');

const BASE = 'http://localhost:5000/api';

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const headers = { 'Content-Type': 'application/json' };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers,
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testPaymentPeriods() {
  console.log('=== STARTING PAYMENT PERIODS INTEGRATION TESTS ===');

  // 1. Login
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@class.com',
    password: 'admin123',
  });
  if (loginRes.status !== 200 && loginRes.status !== 201) {
    console.error('Login failed:', loginRes.status, loginRes.data);
    process.exit(1);
  }
  const token = loginRes.data.accessToken;
  console.log('Logged in successfully.');

  // Create a Center
  const randSuffix = Math.floor(Math.random() * 10000);
  const centerRes = await request('POST', '/centers', {
    name: `TT Test Periods ${randSuffix}`,
    province: 'Thành phố Hà Nội',
    districtWard: 'Quận Cầu Giấy',
    primaryAddress: '456 Cầu Giấy',
    status: 'Active',
  }, token);
  const centerId = centerRes.data.id;
  console.log(`Created Center: ${centerId}`);

  // Get Room
  const roomsRes = await request('GET', `/rooms?centerId=${centerId}`, null, token);
  const roomId = roomsRes.data[0].id;

  // Create a Teacher
  console.log('Creating test teacher...');
  const teacherRes = await request('POST', '/teachers', {
    firstName: `Teacher P ${randSuffix}`,
    lastName: 'Nguyễn',
    gender: 'Nam',
    type: 'Teacher',
    status: 'Active',
    mobile: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
  }, token);
  const teacherId = teacherRes.data.id;
  console.log(`Created Teacher: ${teacherId}`);

  // Create Course and Level
  const courseRes = await request('POST', '/courses', {
    category: 'OFFLINE',
    name: `Khóa học Test Periods ${randSuffix}`,
    shortName: `CRS_PER_${randSuffix}`,
    typeOfPeriod: 'By hour',
    year: '2026-06-01',
    maxSize: 30,
    status: 'Active',
    levels: [
      { levelName: 'Periods Level', levelCode: `LV_PER_${randSuffix}`, totalHours: 100 },
    ],
  }, token);
  const courseId = courseRes.data.id;
  const levelId = courseRes.data.levels[0].id;
  console.log(`Created Course and Level: ${levelId}`);

  // Add Level Pricing (Price: 120000, Wage: 70000)
  await request('POST', `/courses/levels/${levelId}/pricing`, {
    pricePerSession: 120000,
    teacherWagePerSession: 70000,
    effectiveFrom: '2026-06-01',
  }, token);
  console.log('Added pricing.');

  // Create Class
  const classRes = await request('POST', '/classes', {
    courseId,
    courseLevelId: levelId,
    classCode: `CLS_PER_${randSuffix}`,
    className: `Lớp Test Periods ${randSuffix}`,
    startDate: '2026-06-15',
    finishDate: '2026-06-25',
    centerId,
    mainTeacherId: teacherId,
    status: 'Active',
    schedules: [
      { weekday: 'Mon', startTime: '10:00', endTime: '11:30', roomId }
    ]
  }, token);
  const classId = classRes.data.id;
  console.log(`Created Class: ${classId}`);

  // Create student
  const studentRes = await request('POST', '/students', {
    firstName: `Student P ${randSuffix}`,
    lastName: 'Nguyễn',
    nickName: 'Tèo',
    gender: 'Nam',
    mobile: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    birthdate: '2016-01-01',
    primaryAddress: '789 Láng Hạ',
    status: 'Waiting for class'
  }, token);
  const studentId = studentRes.data.id;
  console.log(`Created Student: ${studentId}`);

  // Add student to class
  await request('POST', `/classes/${classId}/students`, { studentId }, token);

  // Generate sessions
  await request('POST', `/classes/${classId}/generate-sessions`, null, token);

  // Get sessions list
  const sessionsRes = await request('GET', `/classes/${classId}/sessions`, null, token);
  const sessions = sessionsRes.data;
  console.log(`Generated ${sessions.length} sessions.`);

  if (sessions.length === 0) {
    console.error('ERROR: No sessions generated!');
    process.exit(1);
  }

  // Use the first session
  const testSession = sessions[0];
  console.log(`Using session ${testSession.id} on date ${testSession.date}`);

  // Mark student present
  await request('POST', `/classes/sessions/${testSession.id}/attendance`, {
    attendance: [{ studentId, isPresent: true }]
  }, token);

  // Complete session
  await request('POST', `/classes/sessions/${testSession.id}/complete`, null, token);
  console.log('Session marked as Completed.');

  // ==========================================
  // TEST: Generate Tuition Payment Period
  // ==========================================
  console.log('\n--- Generating Tuition Payment Period ---');
  const tPeriodRes = await request('POST', '/payment-periods', {
    name: `Đợt Thu Học Phí Tháng 6 ${randSuffix}`,
    type: 'tuition',
    month: '2026-06',
    startDate: '2026-06-01',
    endDate: '2026-06-30'
  }, token);

  console.log('Create Tuition Period Status:', tPeriodRes.status);
  if (tPeriodRes.status !== 201 && tPeriodRes.status !== 200) {
    console.error('ERROR: Failed to create tuition payment period:', tPeriodRes.data);
    process.exit(1);
  }
  const tuitionPeriodId = tPeriodRes.data.id;
  console.log(`Created Tuition Period: ${tuitionPeriodId}`);

  // Verify Student Bill is generated
  const periodDetailTuition = await request('GET', `/payment-periods/${tuitionPeriodId}`, null, token);
  const bill = periodDetailTuition.data.orders.find(o => o.studentId === studentId);
  if (!bill) {
    console.error('ERROR: No tuition order generated for our test student!');
    process.exit(1);
  }
  console.log('Bill Info:', { id: bill.id, studentId: bill.studentId, totalAmount: bill.totalAmount, status: bill.status });
  if (bill.totalAmount !== 120000) {
    console.error(`ERROR: Expected tuition bill amount 120000, got: ${bill.totalAmount}`);
    process.exit(1);
  }

  // ==========================================
  // TEST: Generate Teacher Salary Payment Period
  // ==========================================
  console.log('\n--- Generating Salary Payment Period ---');
  const sPeriodRes = await request('POST', '/payment-periods', {
    name: `Đợt Trả Lương Giáo Viên Tháng 6 ${randSuffix}`,
    type: 'salary',
    month: '2026-06',
    startDate: '2026-06-01',
    endDate: '2026-06-30'
  }, token);

  console.log('Create Salary Period Status:', sPeriodRes.status);
  if (sPeriodRes.status !== 201 && sPeriodRes.status !== 200) {
    console.error('ERROR: Failed to create salary payment period:', sPeriodRes.data);
    process.exit(1);
  }
  const salaryPeriodId = sPeriodRes.data.id;
  console.log(`Created Salary Period: ${salaryPeriodId}`);

  // Verify Teacher Wage is generated
  const periodDetailSalary = await request('GET', `/payment-periods/${salaryPeriodId}`, null, token);
  const wage = periodDetailSalary.data.orders.find(o => o.teacherId === teacherId);
  if (!wage) {
    console.error('ERROR: No salary order generated for our test teacher!');
    process.exit(1);
  }
  console.log('Wage Info:', { id: wage.id, teacherId: wage.teacherId, totalAmount: wage.totalAmount, status: wage.status });
  if (wage.totalAmount !== 70000) {
    console.error(`ERROR: Expected wage amount 70000, got: ${wage.totalAmount}`);
    process.exit(1);
  }

  // ==========================================
  // TEST: List Payment Periods
  // ==========================================
  console.log('\n--- Fetching all payment periods ---');
  const listRes = await request('GET', '/payment-periods', null, token);
  console.log('All periods stats:');
  console.table(listRes.data.map(p => ({
    id: p.id,
    name: p.name,
    type: p.type,
    totalExpected: p.totalExpected,
    totalOrders: p.totalOrders,
    status: p.status
  })));

  // ==========================================
  // TEST: Update Payment Status (Tuition)
  // ==========================================
  console.log('\n--- Updating tuition bill payment status ---');
  const updateBillRes = await request('PATCH', `/payment-periods/orders/tuition/${bill.id}`, {
    status: 'Paid',
    paidAmount: 120000,
    note: 'Đã thu tiền mặt tại quầy',
    paymentDate: new Date().toISOString()
  }, token);

  console.log('Update bill status:', updateBillRes.status);
  if (updateBillRes.status !== 200) {
    console.error('ERROR: Failed to update bill status:', updateBillRes.data);
    process.exit(1);
  }
  console.log('Updated bill response:', { id: updateBillRes.data.id, status: updateBillRes.data.status, paidAmount: updateBillRes.data.paidAmount });
  if (updateBillRes.data.status !== 'Paid' || Number(updateBillRes.data.paidAmount) !== 120000) {
    console.error('ERROR: Update bill payment failed verification!');
    process.exit(1);
  }

  // ==========================================
  // TEST: Close Period and check edit constraints
  // ==========================================
  console.log('\n--- Closing Tuition Period ---');
  const closeRes = await request('PATCH', `/payment-periods/${tuitionPeriodId}/status`, { status: 'Closed' }, token);
  console.log('Close Period status:', closeRes.status, 'New Period status:', closeRes.data.status);
  if (closeRes.data.status !== 'Closed') {
    console.error('ERROR: Period should be Closed!');
    process.exit(1);
  }

  console.log('Attempting to edit bill in Closed period (should throw error)...');
  const badEditRes = await request('PATCH', `/payment-periods/orders/tuition/${bill.id}`, {
    status: 'Unpaid',
    paidAmount: 0
  }, token);
  console.log('Edit in Closed period response status (expected 400):', badEditRes.status);
  if (badEditRes.status !== 400) {
    console.error('ERROR: Expected 400 Bad Request when editing order in Closed period!');
    process.exit(1);
  }

  // Re-open period
  console.log('\n--- Re-opening Tuition Period ---');
  const openRes = await request('PATCH', `/payment-periods/${tuitionPeriodId}/status`, { status: 'Active' }, token);
  console.log('Re-open Period status:', openRes.data.status);

  // ==========================================
  // TEST: Remove order from period
  // ==========================================
  console.log('\n--- Removing tuition bill from active period ---');
  const removeOrderRes = await request('DELETE', `/payment-periods/orders/tuition/${bill.id}`, null, token);
  console.log('Remove order status (expected 200):', removeOrderRes.status);
  if (removeOrderRes.status !== 200) {
    console.error('ERROR: Failed to remove order from period!');
    process.exit(1);
  }

  // Verify that attendance is now unbilled (billId = null)
  const attendanceRes = await request('GET', `/classes/sessions/${testSession.id}/attendance`, null, token);
  const updatedAtt = attendanceRes.data.find(a => a.studentId === studentId);
  console.log('Attendance bill ID after order removal:', updatedAtt?.billId);
  if (updatedAtt?.billId !== null) {
    console.error('ERROR: Attendance billId was not reset to null!');
    process.exit(1);
  }
  console.log('SUCCESS: Order removal and attendance link resetting verified!');

  // ==========================================
  // TEST: Delete period and verify cascade behavior
  // ==========================================
  console.log('\n--- Deleting Tuition Period ---');
  const deletePeriodRes = await request('DELETE', `/payment-periods/${tuitionPeriodId}`, null, token);
  console.log('Delete Period status (expected 200):', deletePeriodRes.status);
  if (deletePeriodRes.status !== 200) {
    console.error('ERROR: Failed to delete payment period!');
    process.exit(1);
  }

  console.log('\n=== ALL PAYMENT PERIODS BUSINESS LOGIC TESTS PASSED SUCCESSFULLY! 💸🚀 ===');
}

testPaymentPeriods().catch(console.error);
