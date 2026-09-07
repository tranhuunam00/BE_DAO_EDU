const crypto = require('crypto');
const os = require('os');

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

function getLocalIPs() {
    const interfaces = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                ips.push(iface.address);
            }
        }
    }
    return ips;
}

async function run() {
    const args = process.argv.slice(2);
    
    // Nếu chạy không có đối số, liệt kê IP và hướng dẫn sử dụng
    if (args.length === 0) {
        console.log(`\n============================================================`);
        console.log(`HƯỚNG DẪN CẤU HÌNH WEBHOOK (HTTP LISTENING HOST)`);
        console.log(`------------------------------------------------------------`);
        console.log(`Các địa chỉ IP máy tính hiện tại của bạn:`);
        const ips = getLocalIPs();
        ips.forEach(ip => {
            console.log(`  -> ${ip}`);
        });
        console.log(`\nĐể tự động cấu hình webhook trỏ về IP máy tính của bạn, hãy chạy:`);
        console.log(`  node .\\setup_webhook.js <IP_CỦA_BẠN> [Cổng_Port] [Đường_Dẫn_Path]`);
        console.log(`\nVí dụ:`);
        console.log(`  node .\\setup_webhook.js ${ips[0] || '192.168.22.100'} 3000 /api/attendance/webhook`);
        console.log(`============================================================\n`);
        
        console.log("[*] Đang đọc cấu hình Webhook hiện tại trên thiết bị...");
        try {
            const currentConfig = await requestISAPI('GET', '/ISAPI/Event/notification/httpHosts/1');
            console.log("Cấu hình hiện tại của Webhook (Host 1) trên thiết bị:\n", currentConfig);
        } catch (err) {
            console.log("Không thể đọc cấu hình hiện tại:", err.message);
        }
        return;
    }

    const serverIp = args[0];
    const port = args[1] || '3000';
    const path = args[2] || '/api/attendance/webhook';

    console.log(`\n[*] Tiến hành cấu hình Webhook (Host 1):`);
    console.log(`  - IP máy chủ nhận webhook: ${serverIp}`);
    console.log(`  - Cổng (Port): ${port}`);
    console.log(`  - Đường dẫn nhận dữ liệu (Path): ${path}`);

    // Xây dựng XML Body cho PUT request
    const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<HttpHostNotification xmlns="http://www.isapi.org/ver20/XMLSchema" version="2.0">
  <id>1</id>
  <url>${path}</url>
  <protocolType>HTTP</protocolType>
  <parameterFormatType>JSON</parameterFormatType>
  <addressingFormatType>ipaddress</addressingFormatType>
  <ipAddress>${serverIp}</ipAddress>
  <portNo>${port}</portNo>
  <httpAuthenticationMethod>none</httpAuthenticationMethod>
</HttpHostNotification>`;

    console.log("\n[1] Đang gửi yêu cầu cài đặt webhook lên máy chấm công...");
    const resXml = await requestISAPI('PUT', '/ISAPI/Event/notification/httpHosts/1', xmlBody, true);
    console.log("Kết quả phản hồi từ thiết bị:\n", resXml);

    console.log("\n[2] Kiểm tra lại cấu hình...");
    const checkRes = await requestISAPI('GET', '/ISAPI/Event/notification/httpHosts/1');
    console.log("Cấu hình hiện tại sau khi lưu:\n", checkRes);
    console.log("\n=== CẤU HÌNH WEBHOOK THÀNH CÔNG ===");
}

run().catch(err => {
    console.error("Lỗi cấu hình Webhook:", err.message);
});
