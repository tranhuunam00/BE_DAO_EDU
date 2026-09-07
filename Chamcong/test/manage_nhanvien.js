const crypto = require('crypto');

// ==================== CẤU HÌNH THIẾT BỊ ====================
const DEVICE_IP = '192.168.22.123';
const USERNAME = 'admin'; 
const PASSWORD = '28022000a'; 
// ==========================================================

function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

function parseDigestHeader(header) {
    const params = {};
    const regex = /(\w+)=(?:"([^"]*)"|([^,\s]*))/g;
    let match;
    while ((match = regex.exec(header)) !== null) {
        const key = match[1];
        const val = match[2] !== undefined ? match[2] : match[3];
        params[key] = val;
    }
    return params;
}

function buildDigestAuthHeader(method, uri, authenticateHeader) {
    const params = parseDigestHeader(authenticateHeader);
    const realm = params.realm;
    const nonce = params.nonce;
    const qop = params.qop;
    const opaque = params.opaque;

    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex');

    const HA1 = md5(`${USERNAME}:${realm}:${PASSWORD}`);
    const HA2 = md5(`${method}:${uri}`);

    let response;
    if (qop === 'auth') {
        response = md5(`${HA1}:${nonce}:${nc}:${cnonce}:${qop}:${HA2}`);
    } else {
        response = md5(`${HA1}:${nonce}:${HA2}`);
    }

    let authHeader = `Digest username="${USERNAME}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
    if (qop) {
        authHeader += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
    }
    if (opaque) {
        authHeader += `, opaque="${opaque}"`;
    }
    return authHeader;
}

// Hàm gửi request ISAPI tổng quát hỗ trợ JSON
async function requestISAPI(method, uri, bodyObject = null) {
    const url = `http://${DEVICE_IP}${uri}`;
    const bodyStr = bodyObject ? JSON.stringify(bodyObject) : null;
    
    let response = await fetch(url, {
        method,
        body: bodyStr,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (response.status === 401) {
        const wwwAuthenticate = response.headers.get('www-authenticate');
        if (!wwwAuthenticate) {
            throw new Error("Không nhận được WWW-Authenticate");
        }
        const authHeader = buildDigestAuthHeader(method, uri, wwwAuthenticate);
        
        response = await fetch(url, {
            method,
            body: bodyStr,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            }
        });
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Yêu cầu thất bại: ${response.status} - ${errText}`);
    }

    return await response.json();
}

// 1. Hàm Thêm mới hoặc Cập nhật thông tin nhân viên (Set Up)
// Nếu employeeNo chưa tồn tại -> tạo mới. Nếu đã tồn tại -> cập nhật tên/quyền/mã PIN.
async function setupUser(employeeNo, name, pinCode = "") {
    console.log(`[+] Đang thiết lập nhân viên: ${name} (Mã: ${employeeNo}, PIN: ${pinCode || "Không dùng PIN"})...`);
    const uri = '/ISAPI/AccessControl/UserInfo/SetUp?format=json';
    
    const payload = {
        "UserInfo": {
            "employeeNo": String(employeeNo),
            "name": name,
            "userType": "normal",
            "password": pinCode ? String(pinCode) : "", // Mã PIN đăng nhập bằng số quẹt trên màn hình thiết bị
            "Valid": {
                "enable": true,
                "beginTime": "2026-01-01T00:00:00",
                "endTime": "2036-12-31T23:59:59",
                "timeType": "local"
            },
            "belongGroup": "1", // Nhóm mặc định
            "doorRight": "1",    // Quyền ra vào cửa số 1
            "RightPlan": [
                {
                    "doorNo": 1,
                    "planTemplateNo": "1" // Template thời gian 24/7 mặc định
                }
            ]
        }
    };

    const res = await requestISAPI('PUT', uri, payload);
    console.log("-> Kết quả thiết lập:", JSON.stringify(res));
    return res;
}

// 2. Hàm Xóa nhân viên theo Mã nhân viên (employeeNo)
async function deleteUser(employeeNo) {
    console.log(`[-] Đang yêu cầu xóa nhân viên mã: ${employeeNo}...`);
    const uri = '/ISAPI/AccessControl/UserInfoDetail/Delete?format=json';
    
    const payload = {
        "UserInfoDetail": {
            "mode": "byEmployeeNo",
            "EmployeeNoList": [
                {
                    "employeeNo": String(employeeNo)
                }
            ]
        }
    };

    const res = await requestISAPI('PUT', uri, payload);
    console.log("-> Kết quả yêu cầu xóa:", JSON.stringify(res));
    return res;
}

// 3. Hàm Sửa mã nhân viên (Đổi mã cũ sang mã mới)
// Vì Mã nhân viên (employeeNo) là Khóa chính trên máy chấm công,
// ta phải xóa tài khoản mang mã cũ đi và tạo tài khoản mới mang mã mới.
async function changeEmployeeCode(oldCode, newCode, name, pinCode = "") {
    console.log(`\n=== BẮT ĐẦU ĐỔI MÃ NHÂN VIÊN: ${oldCode} -> ${newCode} ===`);
    
    // Bước 1: Xóa mã cũ
    try {
        await deleteUser(oldCode);
    } catch (err) {
        console.log(`[Cảnh báo] Không thể xóa mã cũ ${oldCode} (có thể mã này không tồn tại trên thiết bị):`, err.message);
    }

    // Đợi 1.5 giây để thiết bị hoàn thành quá trình xóa trong hàng đợi
    console.log("Đợi thiết bị cập nhật tiến trình xóa...");
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Bước 2: Tạo mã mới kèm mã PIN mới
    const res = await setupUser(newCode, name, pinCode);
    console.log(`=== ĐỔI MÃ HOÀN TẤT THÀNH CÔNG ===\n`);
    return res;
}

// 4. Hàm Tìm kiếm thông tin nhân viên theo mã số
async function searchUser(employeeNo) {
    console.log(`[*] Đang tìm kiếm thông tin nhân viên mã: ${employeeNo} trên thiết bị...`);
    const uri = '/ISAPI/AccessControl/UserInfo/Search?format=json';
    
    const payload = {
        "UserInfoSearchCond": {
            "searchID": "search_user_test_" + Date.now(),
            "searchResultPosition": 0,
            "maxResults": 1,
            "EmployeeNoList": [
                {
                    "employeeNo": String(employeeNo)
                }
            ]
        }
    };

    const res = await requestISAPI('POST', uri, payload);
    return res;
}

// ==================== CHẠY THỬ NGHIỆM ====================
// Đoạn code chạy thử bên dưới sẽ truy vấn kiểm tra nhân viên mã 3456 trên thiết bị
async function test() {
    const res = await searchUser('3456');
    console.log("-> Kết quả tìm kiếm nhân viên từ thiết bị:");
    console.log(JSON.stringify(res, null, 2));
}

test().catch(err => {
    console.error("Lỗi:", err.message);
});
