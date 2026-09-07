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

async function requestISAPI(method, uri, body = null, isXml = true) {
    const url = `http://${DEVICE_IP}${uri}`;
    const contentType = isXml ? 'application/xml' : 'application/json';
    
    // First request to challenge
    let response = await fetch(url, {
        method,
        body,
        headers: {
            'Content-Type': contentType
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
            body,
            headers: {
                'Content-Type': contentType,
                'Authorization': authHeader
            }
        });
    }

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Yêu cầu thất bại: ${response.status} - ${errText}`);
    }

    return await response.text();
}

async function syncTime() {
    console.log("[1] Đang đọc cấu hình giờ hiện tại trên máy chấm công...");
    const xmlResponse = await requestISAPI('GET', '/ISAPI/System/time');
    console.log("Cấu hình hiện tại:\n", xmlResponse);

    // Ép múi giờ về múi giờ Việt Nam (UTC+7 là CST-7:00:00 trong giao thức ISAPI)
    const timeZone = "CST-7:00:00";
    console.log(`Múi giờ cài đặt: ${timeZone}`);

    // Lấy thời gian hiện tại của máy tính
    const now = new Date();
    // Chuyển đổi thành giờ địa phương theo định dạng YYYY-MM-DDTHH:mm:ss
    // Phép tính này bù giờ múi giờ hệ thống của bạn để ra đúng giờ địa phương
    const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
    const localNow = new Date(now.getTime() - tzOffsetMs);
    const localTimeStr = localNow.toISOString().slice(0, 19);

    console.log(`\nThời gian hiện tại của máy tính: ${localTimeStr}`);

    // Xây dựng XML Payload gửi đi
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<Time xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0">
  <timeMode>manual</timeMode>
  <localTime>${localTimeStr}</localTime>
  <timeZone>${timeZone}</timeZone>
</Time>`;

    console.log("\n[2] Đang cài lại giờ trên máy chấm công...");
    const resultXml = await requestISAPI('PUT', '/ISAPI/System/time', xmlBody, true);
    console.log("Kết quả phản hồi từ thiết bị:\n", resultXml);
    console.log("\n[3] Đồng bộ thời gian hoàn tất thành công!");
}

syncTime().catch(err => {
    console.error("Lỗi:", err.message);
});
