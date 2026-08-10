const http = require('http');
const os = require('os');

const PORT = 3000;

// Hàm phân loại cách quẹt dựa trên mã sự kiện minor
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

// Lấy danh sách IP nội bộ của máy tính chạy server này
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

// Khởi tạo máy chủ HTTP nhận Webhook
const server = http.createServer((req, res) => {
    console.log(`\n=================== YÊU CẦU MỚI: ${req.method} ${req.url} ===================`);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));

    let bodyChunks = [];
    req.on('data', (chunk) => {
        bodyChunks.push(chunk);
    });

    req.on('end', () => {
        const bodyBuffer = Buffer.concat(bodyChunks);
        const contentType = req.headers['content-type'] || '';
        console.log(`Nhận được body: ${bodyBuffer.length} bytes`);

        try {
            if (contentType.includes('application/json')) {
                // Parse dữ liệu JSON trực tiếp
                const jsonText = bodyBuffer.toString('utf8');
                console.log("Nội dung JSON nhận được:\n", jsonText);
                const data = JSON.parse(jsonText);
                handleAccessEvent(data);
            } else if (contentType.includes('multipart/form-data') || contentType.includes('multipart/mixed')) {
                // Nhận diện Multipart (dữ liệu quẹt + ảnh đi kèm)
                console.log("[!] Dữ liệu là Multipart (sự kiện + ảnh). Đang trích xuất phần text...");
                const bodyStr = bodyBuffer.toString('binary');
                
                // Trích xuất ranh giới boundary
                const match = contentType.match(/boundary=(.+)/);
                if (match) {
                    const boundary = match[1];
                    const parts = bodyStr.split('--' + boundary);
                    
                    for (const part of parts) {
                        if (part.includes('Content-Type: application/json')) {
                            // Trích xuất JSON từ phần part
                            const jsonStart = part.indexOf('{');
                            const jsonEnd = part.lastIndexOf('}') + 1;
                            if (jsonStart !== -1 && jsonEnd !== -1) {
                                const jsonText = part.slice(jsonStart, jsonEnd);
                                console.log("Nội dung JSON trích xuất từ Multipart:\n", jsonText);
                                const data = JSON.parse(jsonText);
                                handleAccessEvent(data);
                            }
                        } else if (part.includes('Content-Type: text/xml') || part.includes('application/xml')) {
                            // Trích xuất XML từ phần part
                            const xmlStart = part.indexOf('<');
                            const xmlEnd = part.lastIndexOf('>') + 1;
                            if (xmlStart !== -1 && xmlEnd !== -1) {
                                const xmlText = part.slice(xmlStart, xmlEnd);
                                console.log("Nội dung XML trích xuất từ Multipart:\n", xmlText);
                                handleXmlEvent(xmlText);
                            }
                        }
                    }
                } else {
                    console.log("Không tìm thấy boundary trong Content-Type.");
                }
            } else if (contentType.includes('xml')) {
                // Parse dữ liệu XML trực tiếp
                const xmlText = bodyBuffer.toString('utf8');
                console.log("Nội dung XML nhận được:\n", xmlText);
                handleXmlEvent(xmlText);
            } else {
                // Định dạng khác, in thô text ra màn hình
                console.log("Nội dung text thô nhận được:\n", bodyBuffer.toString('utf8').slice(0, 1000));
            }
        } catch (err) {
            console.error("[Lỗi phân tích cú pháp dữ liệu]:", err.message);
        }

        // BẮT BUỘC phản hồi HTTP 200 OK để thiết bị xác nhận đã gửi thành công
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            statusCode: 1,
            statusString: "OK",
            subStatusCode: "ok"
        }));
        console.log("-> Đã phản hồi HTTP 200 OK về thiết bị.");
    });
});

// Hàm xử lý sự kiện quẹt dạng JSON
function handleAccessEvent(data) {
    const alert = data.EventNotificationAlert || data;
    if (alert.AccessControllerEvent) {
        const ev = alert.AccessControllerEvent;
        const employeeNo = ev.employeeNoString || ev.employeeNo;
        const name = ev.name || ev.employeeName;
        const time = alert.dateTime || ev.time || new Date().toISOString();
        const minor = alert.subEventType || ev.subEventType;
        const cardNo = ev.cardNo || '';

        if (employeeNo) {
            console.log("\n[KẾT QUẢ ĐIỂM DANH REALTIME]");
            console.log(`- Học viên: ${name} (Mã số: ${employeeNo})`);
            console.log(`- Thời gian quẹt: ${time}`);
            console.log(`- Cách thức xác thực: ${getActualVerifyMethod(minor, cardNo)}`);
            console.log(`- Mã sự kiện phụ (minor): ${minor}`);
            console.log(`- Số thẻ: ${cardNo || 'Không dùng thẻ'}`);
        }
    } else {
        // Không in log linh tinh ngoài sự kiện của thiết bị
    }
}

// Hàm xử lý sự kiện quẹt dạng XML (Hikvision đời cũ hoặc cấu hình XML)
function handleXmlEvent(xmlText) {
    const employeeNoMatch = xmlText.match(/<employeeNoString>([^<]+)<\/employeeNoString>/) || xmlText.match(/<employeeNo>([^<]+)<\/employeeNo>/);
    const nameMatch = xmlText.match(/<name>([^<]+)<\/name>/) || xmlText.match(/<employeeName>([^<]+)<\/employeeName>/);
    const timeMatch = xmlText.match(/<dateTime>([^<]+)<\/dateTime>/) || xmlText.match(/<time>([^<]+)<\/time>/);
    const minorMatch = xmlText.match(/<subEventType>([^<]+)<\/subEventType>/) || xmlText.match(/<minor>([^<]+)<\/minor>/);
    const cardNoMatch = xmlText.match(/<cardNo>([^<]+)<\/cardNo>/);

    if (employeeNoMatch) {
        const employeeNo = employeeNoMatch[1];
        const name = nameMatch ? nameMatch[1] : 'Không rõ';
        const time = timeMatch ? timeMatch[1] : new Date().toISOString();
        const minor = minorMatch ? parseInt(minorMatch[1], 10) : 0;
        const cardNo = cardNoMatch ? cardNoMatch[1] : '';

        console.log("\n[KẾT QUẢ ĐIỂM DANH REALTIME - XML]");
        console.log(`- Học viên: ${name} (Mã số: ${employeeNo})`);
        console.log(`- Thời gian quẹt: ${time}`);
        console.log(`- Cách thức xác thực: ${getActualVerifyMethod(minor, cardNo)}`);
        console.log(`- Mã sự kiện phụ (minor): ${minor}`);
        console.log(`- Số thẻ: ${cardNo || 'Không dùng thẻ'}`);
    }
}

// Khởi chạy Server lắng nghe
server.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`MÁY CHỦ WEBHOOK LẮNG NGHE ĐIỂM DANH ĐANG HOẠT ĐỘNG!`);
    console.log(`Cổng: ${PORT}`);
    console.log(`------------------------------------------------------------`);
    console.log(`Hãy cấu hình trong thiết bị Hikvision (Web Admin -> Network -> HTTP Listening hoặc Upload Center):`);
    console.log(`- Địa chỉ Host IP (chọn 1 trong các IP máy tính này của bạn):`);
    getLocalIPs().forEach(ip => {
        console.log(`  -> http://${ip}:${PORT}`);
    });
    console.log(`- URL/Path nhận sự kiện: /api/attendance/webhook`);
    console.log(`============================================================\n`);
});
