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
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function verify() {
  console.log('=== STARTING PRICING & BILLING VERIFICATION ===');

  // 1. Login
  const loginRes = await request('POST', '/auth/login', {
    email: 'admin@dao.edu.vn',
    password: '123456',
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
    name: `Trung tâm Pricing ${randSuffix}`,
    province: 'Thành phố Hà Nội',
    districtWard: 'Quận Cầu Giấy',
    primaryAddress: '123 Cầu Giấy',
    status: 'Active',
  }, token);
  const centerId = centerRes.data.id;

  // Get Room
  const roomsRes = await request('GET', `/rooms?centerId=${centerId}`, null, token);
  const roomId = roomsRes.data[0].id;

  // 2. Create Course and Level
  const courseRes = await request('POST', '/courses', {
    category: 'OFFLINE',
    name: `Khóa học Pricing ${randSuffix}`,
    shortName: `CRS_PRC_${randSuffix}`,
    typeOfPeriod: 'By hour',
    year: '2026-06-01',
    maxSize: 30,
    status: 'Active',
    levels: [
      { levelName: 'Pricing Level', levelCode: `LV_PRC_${randSuffix}`, totalHours: 100 },
    ],
  }, token);
  const courseId = courseRes.data.id;
  const levelId = courseRes.data.levels[0].id;
  console.log(`Created Course Level pricing testing, Level ID: ${levelId}`);

  // 2.5 Test adding a level to the course (should succeed)
  console.log('Testing adding a Level to existing course...');
  const addLevelRes = await request('POST', `/courses/${courseId}/levels`, {
    levelName: 'Second Level',
    levelCode: `LV_SEC_${randSuffix}`,
    totalHours: 120,
  }, token);
  console.log('  Status:', addLevelRes.status);
  if (addLevelRes.status !== 201 && addLevelRes.status !== 200) {
    console.error('ERROR: Failed to add Level to existing course:', addLevelRes.data);
    process.exit(1);
  }
  if (addLevelRes.data.levels.length !== 2) {
    console.error('ERROR: Expected exactly 2 levels after addLevel, got:', addLevelRes.data.levels.length);
    process.exit(1);
  }
  console.log('SUCCESS: Level added to existing course verified!');

  // 3. Add Level Pricing (Price: 150000, Wage: 80000, effectiveFrom: 2026-06-01)
  console.log('Adding first pricing level...');
  const addPriceRes1 = await request('POST', `/courses/levels/${levelId}/pricing`, {
    pricePerSession: 150000,
    teacherWagePerSession: 80000,
    effectiveFrom: '2026-06-01',
  }, token);

  console.log('  Status:', addPriceRes1.status);
  if (addPriceRes1.status !== 201 && addPriceRes1.status !== 200) {
    console.error('ERROR: Failed to add initial level pricing:', addPriceRes1.data);
    process.exit(1);
  }
  console.log('  Initial pricing added:', addPriceRes1.data);

  // 4. Verify conflict when adding overlapping pricing
  console.log('Adding overlapping pricing (should throw conflict)...');
  const addPriceOverlap = await request('POST', `/courses/levels/${levelId}/pricing`, {
    pricePerSession: 160000,
    teacherWagePerSession: 85000,
    effectiveFrom: '2026-05-20', // starts before first pricing
  }, token);

  console.log('  Status:', addPriceOverlap.status);
  console.log('  Message:', addPriceOverlap.data.message);
  if (addPriceOverlap.status !== 409) {
    console.error('ERROR: Expected conflict 409 for invalid start date before active price!');
    process.exit(1);
  }

  // 5. Add later pricing (should auto-cap the first pricing)
  console.log('Adding later pricing starting from 2026-07-01 (should auto-cap first pricing)...');
  const addPriceRes2 = await request('POST', `/courses/levels/${levelId}/pricing`, {
    pricePerSession: 200000,
    teacherWagePerSession: 100000,
    effectiveFrom: '2026-07-01',
  }, token);

  console.log('  Status:', addPriceRes2.status);
  if (addPriceRes2.status !== 201 && addPriceRes2.status !== 200) {
    console.error('ERROR: Failed to add second pricing level:', addPriceRes2.data);
    process.exit(1);
  }

  // Fetch pricing history to verify auto-capping
  const historyRes = await request('GET', `/courses/levels/${levelId}/pricing`, null, token);
  console.log('Pricing history:');
  console.table(historyRes.data);

  const cappedItem = historyRes.data.find(h => h.effectiveFrom === '2026-06-01');
  const newItem = historyRes.data.find(h => h.effectiveFrom === '2026-07-01');

  if (!cappedItem || cappedItem.effectiveTo !== '2026-06-30') {
    console.error('ERROR: Capping failed. Expected first pricing to end on 2026-06-30, got:', cappedItem?.effectiveTo);
    process.exit(1);
  }
  if (!newItem || newItem.effectiveTo !== null) {
    console.error('ERROR: New pricing should have null effectiveTo, got:', newItem?.effectiveTo);
    process.exit(1);
  }
  console.log('SUCCESS: Level pricing auto-capping verified!');

  // 5.5 Test updating the active pricing with the same start date (should overwrite/update)
  console.log('Testing updating active pricing with same effectiveFrom date (2026-07-01)...');
  const updateSameDateRes = await request('POST', `/courses/levels/${levelId}/pricing`, {
    pricePerSession: 220000,
    teacherWagePerSession: 110000,
    effectiveFrom: '2026-07-01',
  }, token);

  console.log('  Status:', updateSameDateRes.status);
  if (updateSameDateRes.status !== 200 && updateSameDateRes.status !== 201) {
    console.error('ERROR: Failed to update pricing for the same date:', updateSameDateRes.data);
    process.exit(1);
  }

  // Fetch pricing history again to verify overwrite
  const historyAfterUpdateRes = await request('GET', `/courses/levels/${levelId}/pricing`, null, token);
  console.log('Pricing history after update:');
  console.table(historyAfterUpdateRes.data);

  if (historyAfterUpdateRes.data.length !== 2) {
    console.error('ERROR: Expected exactly 2 pricing records, got:', historyAfterUpdateRes.data.length);
    process.exit(1);
  }

  const updatedItem = historyAfterUpdateRes.data.find(h => h.effectiveFrom === '2026-07-01');
  if (!updatedItem || Number(updatedItem.pricePerSession) !== 220000 || Number(updatedItem.teacherWagePerSession) !== 110000) {
    console.error('ERROR: Overwrite failed. Expected price 220000 and wage 110000, got:', updatedItem);
    process.exit(1);
  }
  console.log('SUCCESS: Updating active pricing for the same date verified!');

  // 6. Test isEndingSoon flag for classes
  console.log('Creating class ending in 5 days...');
  const today = new Date();
  const finishDate = new Date(today.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const startDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const classRes = await request('POST', '/classes', {
    courseId,
    courseLevelId: levelId,
    classCode: `CLS_END_${randSuffix}`,
    className: `Lớp Sắp Kết Thúc ${randSuffix}`,
    startDate,
    finishDate,
    centerId,
    status: 'Active',
    schedules: [
      { weekday: 'Mon', startTime: '08:00', endTime: '09:30', roomId }
    ]
  }, token);

  if (classRes.status !== 201 && classRes.status !== 200) {
    console.error('ERROR: Failed to create class:', classRes.status, classRes.data);
    process.exit(1);
  }
  const classId = classRes.data.id;
  const mainTeacherId = classRes.data.mainTeacherId;

  // Retrieve class detail and check ending soon
  const classDetail = await request('GET', `/classes/${classId}`, null, token);
  console.log(`Class finishDate: ${classDetail.data.finishDate}, isEndingSoon: ${classDetail.data.isEndingSoon}`);
  if (classDetail.data.isEndingSoon !== true) {
    console.error('ERROR: Class ending in 5 days must have isEndingSoon = true!');
    process.exit(1);
  }

  // Retrieve class list and check ending soon
  const classList = await request('GET', `/classes?search=CLS_END_${randSuffix}`, null, token);
  const foundClass = classList.data.classes.find(c => c.id === classId);
  console.log(`Class List item isEndingSoon: ${foundClass?.isEndingSoon}`);
  if (foundClass?.isEndingSoon !== true) {
    console.error('ERROR: Class list item must have isEndingSoon = true!');
    process.exit(1);
  }
  console.log('SUCCESS: Class ending soon flags verified!');

  // 7. Verify Tuition and Wages Calculation Reports
  // Create a separate class for billing spanning multiple weeks in the future to naturally generate sessions across pricing periods
  console.log('Creating billing class spanning June and July...');
  const billingClassRes = await request('POST', '/classes', {
    courseId,
    courseLevelId: levelId,
    classCode: `CLS_BIL_${randSuffix}`,
    className: `Lớp Tính Phí ${randSuffix}`,
    startDate: '2026-06-15',
    finishDate: '2026-07-15',
    centerId,
    status: 'Active',
    schedules: [
      { weekday: 'Mon', startTime: '08:00', endTime: '09:30', roomId }
    ]
  }, token);

  if (billingClassRes.status !== 201 && billingClassRes.status !== 200) {
    console.error('ERROR: Failed to create billing class:', billingClassRes.data);
    process.exit(1);
  }
  const billClassId = billingClassRes.data.id;

  // Create student
  console.log('Creating test student...');
  const studentRes = await request('POST', '/students', {
    firstName: `Student ${randSuffix}`,
    lastName: 'Trần',
    nickName: 'Tí',
    gender: 'Nam',
    mobile: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
    birthdate: '2015-05-15',
    primaryAddress: '123 Đường Cầu Giấy',
    status: 'Waiting for class'
  }, token);
  const studentId = studentRes.data.id;

  // Add student to class
  await request('POST', `/classes/${billClassId}/students`, { studentId }, token);

  // Generate sessions
  await request('POST', `/classes/${billClassId}/generate-sessions`, null, token);

  // Get sessions list
  const sessionsRes = await request('GET', `/classes/${billClassId}/sessions`, null, token);
  const sessions = sessionsRes.data;
  console.log(`Generated ${sessions.length} sessions.`);

  // Find sessions in June and July
  const testSess1 = sessions.find(s => s.date < '2026-07-01');
  const testSess2 = sessions.find(s => s.date >= '2026-07-01');

  if (!testSess1 || !testSess2) {
    console.error('ERROR: Expected sessions in both June and July pricing periods, but was missing!');
    process.exit(1);
  }

  console.log(`Using session 1: ${testSess1.id} on date ${testSess1.date}`);
  console.log(`Using session 2: ${testSess2.id} on date ${testSess2.date}`);

  // Create a new teacher to avoid accumulation of sessions from previous test runs
  console.log('Creating a new teacher...');
  const teacherRes = await request('POST', '/teachers', {
    firstName: `Teacher ${randSuffix}`,
    lastName: 'Nguyễn',
    gender: 'Nam',
    type: 'Teacher',
    status: 'Active',
    mobile: `09${Math.floor(10000000 + Math.random() * 90000000)}`,
  }, token);
  const teacherId = teacherRes.data.id;
  console.log(`Using newly created teacher ID: ${teacherId}`);

  await request('PUT', `/classes/${billClassId}`, { mainTeacherId: teacherId }, token);

  // Mark student present in both sessions
  await request('POST', `/classes/sessions/${testSess1.id}/attendance`, {
    attendance: [{ studentId, isPresent: true }]
  }, token);
  await request('POST', `/classes/sessions/${testSess2.id}/attendance`, {
    attendance: [{ studentId, isPresent: true }]
  }, token);

  // Complete both sessions
  await request('POST', `/classes/sessions/${testSess1.id}/complete`, null, token);
  await request('POST', `/classes/sessions/${testSess2.id}/complete`, null, token);

  // Call tuition-report
  console.log('Fetching tuition report...');
  const tuitionRes = await request('GET', `/students/${studentId}/tuition-report?startDate=2026-06-01&endDate=2026-07-31`, null, token);
  console.log('Tuition Report Response:', tuitionRes.data);

  if (tuitionRes.status !== 200) {
    console.error('ERROR: Failed to get tuition report!');
    process.exit(1);
  }

  // Session 1 should charge 150000, Session 2 should charge 200000. Total = 350000.
  if (tuitionRes.data.totalAmount !== 350000) {
    console.error(`ERROR: Expected tuition totalAmount to be 350000, got: ${tuitionRes.data.totalAmount}`);
    process.exit(1);
  }
  console.log('SUCCESS: Student tuition report calculation verified!');

  // Call wages-report
  console.log('Fetching teacher wages report...');
  const wagesRes = await request('GET', `/teachers/${teacherId}/wages-report?startDate=2026-06-01&endDate=2026-07-31`, null, token);
  console.log('Wages Report Response:', wagesRes.data);

  if (wagesRes.status !== 200) {
    console.error('ERROR: Failed to get wages report!');
    process.exit(1);
  }

  // Session 1 should pay 80000, Session 2 should pay 100000. Total = 180000.
  if (wagesRes.data.totalAmount !== 180000) {
    console.error(`ERROR: Expected wages totalAmount to be 180000, got: ${wagesRes.data.totalAmount}`);
    process.exit(1);
  }
  console.log('SUCCESS: Teacher wages report calculation verified!');

  console.log('=== ALL PRICING & BILLING INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉 ===');
}

verify().catch(console.error);
