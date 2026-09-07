const crypto = require('crypto');

// ==================== CẤU HÌNH THIẾT BỊ ====================
const DEVICE_IP = '192.168.22.123';
const USERNAME = 'admin';
const PASSWORD = '28022000a'; // <-- Thay mật khẩu của bạn vào đây
// ==========================================================

// Hàm băm MD5
function md5(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

// Hàm parse WWW-Authenticate Header của Digest Auth
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

// Hàm tính toán Authorization Header cho Digest Auth
function buildDigestAuthHeader(method, uri, authenticateHeader) {
    const params = parseDigestHeader(authenticateHeader);
    const realm = params.realm;
    const nonce = params.nonce;
    const qop = params.qop;
    const opaque = params.opaque;

    const nc = '00000001';
    const cnonce = crypto.randomBytes(8).toString('hex'); // Client nonce ngẫu nhiên

    // Thuật toán Digest MD5 RFC 2617
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

// Hàm chính gọi API lấy lịch sử chấm công
async function getAttendanceLogs() {
    const url = `http://${DEVICE_IP}/ISAPI/AccessControl/AcsEvent?format=json`;
    const uri = '/ISAPI/AccessControl/AcsEvent?format=json';
    const method = 'POST';

    // Body tìm kiếm chấm công của ngày hôm nay (UTC+7)
    // Bạn có thể chỉnh lại startTime/endTime tùy ý
    const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const body = JSON.stringify({
        "AcsEventCond": {
            "searchID": "search_session_" + Date.now(),
            "searchResultPosition": 0,
            "maxResults": 30, // Lấy tối đa 30 bản ghi
            "startTime": `${todayStr}T00:00:00+07:00`,
            "endTime": `${todayStr}T23:59:59+07:00`,
            "major": 0,
            "minor": 0,
            "timeReverseOrder": true, // Mới nhất xếp trên cùng
            "isAttendanceInfo": true  // Chỉ lấy thông tin liên quan tới chấm công
        }
    });

    console.log(`[1] Đang gửi yêu cầu lần 1 đến ${DEVICE_IP} để lấy thử thách Digest Auth...`);
    let response = await fetch(url, {
        method,
        body,
        headers: {
            'Content-Type': 'application/json'
        }
    });

    // Nếu nhận được mã 401 Unauthorized (Đúng chuẩn Digest Auth của Hikvision)
    if (response.status === 401) {
        const wwwAuthenticate = response.headers.get('www-authenticate');
        if (!wwwAuthenticate) {
            throw new Error("Không nhận được header WWW-Authenticate thách thức từ thiết bị.");
        }

        console.log("[2] Nhận được WWW-Authenticate. Đang tính toán chữ ký Digest...");
        const authHeader = buildDigestAuthHeader(method, uri, wwwAuthenticate);

        console.log("[3] Đang gửi yêu cầu lần 2 kèm Header Authorization...");
        response = await fetch(url, {
            method,
            body,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader
            }
        });
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Gọi API thất bại: ${response.status} - ${errText}`);
    }

    const data = await response.json();
    console.log("\n[4] Thành công! Danh sách chấm công nhận về:");

    const events = data.AcsEvent?.InfoList || [];
    if (events.length === 0) {
        console.log("-> Không có dữ liệu chấm công nào trong khoảng thời gian đã chọn.");
    } else {
        const attendanceEvents = events.filter(ev => ev.employeeNoString);
        if (attendanceEvents.length === 0) {
            console.log("-> Không có dữ liệu quẹt thẻ/chấm công nào của nhân viên trong khoảng thời gian đã chọn.");
        } else {
            function getActualVerifyMethod(minor, cardNo) {
                // 75 (0x4b): Face, 77 (0x4d): Employee ID + Face
                if (minor === 75 || minor === 77) return 'Khuôn mặt (Face)';
                // 38 (0x26): Fingerprint, 69 (0x45): Employee ID + FP
                if (minor === 38 || minor === 69) return 'Vân tay (Fingerprint)';
                // 1 (0x01): Valid Card, 2 (0x02): Card + Password
                if (minor === 1 || minor === 2) return 'Thẻ từ (Card)';
                // 57 (0x39): Face + PIN, 101 (0x65): Employee ID + Password
                if (minor === 57 || minor === 101) return 'Mã PIN (PIN Code)';

                if (cardNo && cardNo.trim() !== "") return `Thẻ từ (${cardNo})`;
                return `Khác (Mã minor: ${minor})`;
            }

            attendanceEvents.forEach((ev, index) => {
                console.log(`\n--- Lượt quẹt ${index + 1} ---`);
                console.log(`Nhân viên: ${ev.name} (Mã: ${ev.employeeNoString})`);
                console.log(`Thời gian: ${ev.time}`);
                console.log(`Cách quẹt: ${getActualVerifyMethod(ev.minor, ev.cardNo)}`);
                console.log(`Số thẻ: ${ev.cardNo || "Không dùng thẻ"}`);
                if (ev.currTemperature) {
                    console.log(`Nhiệt độ: ${ev.currTemperature}°C (Bất thường: ${ev.isAbnomalTemperature})`);
                }
                console.log(`Khẩu trang: ${ev.mask}`);
            });
        }
    }
}

// Chạy hàm
getAttendanceLogs().catch(err => {
    console.error("\n[X] Lỗi xảy ra:", err.message);
});
