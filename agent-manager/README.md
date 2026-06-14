# DAO EDU Agent Manager

Python service quản lý multi-agent bằng LangGraph, được đặt dưới backend như một
subproject độc lập về dependency và runtime với ứng dụng NestJS.

## Kiến trúc

```text
request
  -> context loader (source index + long-term memory)
  -> deterministic supervisor
  -> one or two specialist agents in parallel
  -> synthesis only when multiple agents ran
  -> SQLite memory
```

- `LangGraph StateGraph`: orchestration fan-out/fan-in và checkpoint theo `thread_id`.
- `ModelRouter`: agent chỉ khai báo `task_type`; model và chuỗi fallback nằm trong YAML.
- `config/models.yaml`: model, provider, retry và fallback theo loại task.
- `config/agents.yaml`: prompt, chuyên môn và keyword routing.
- `SQLite checkpoints`: bộ nhớ ngắn hạn theo cuộc hội thoại.
- `SQLite long-term memory`: nhớ kết quả giữa nhiều thread của cùng `user_id`.
- `RepositoryIndex`: đọc source cục bộ, truy hồi lexical và chỉ đưa đoạn liên quan vào prompt.
- Logging JSON xoay vòng tại `logs/agent-manager.jsonl`.

Supervisor mặc định dùng luật keyword, không gọi LLM. Một task đơn chuyên môn trả thẳng
kết quả agent, không gọi thêm model tổng hợp. Hai lựa chọn này giảm đáng kể token.

## Cài đặt

Yêu cầu Python 3.11+.

```powershell
cd D:\DAOG\BE_DAO_EDU\agent-manager
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -e ".[dev]"
Copy-Item .env.example .env
```

Điền API key vào `.env` hoặc biến môi trường. Tên model có thể đổi hoàn toàn bằng biến
môi trường hoặc sửa `config/models.yaml`; không cần sửa code agent.

## Chạy CLI

```powershell
daog-agents run "Review luồng thanh toán học phí" --thread-id review-01 --user-id admin
daog-agents index --project-root ..
daog-agents models
```

CLI trả về response, agent đã chạy, model thực tế và lý do routing.

## Chạy API

```powershell
uvicorn daog_agents.api:app --host 0.0.0.0 --port 8001
```

```http
POST /v1/agents/run
Content-Type: application/json

{
  "message": "Kiểm tra contract giữa trang accounting và payment-period controller",
  "thread_id": "accounting-01",
  "user_id": "admin"
}
```

Health check: `GET /health`.

## Model routing và fallback

Ví dụ task backend:

```yaml
task_routes:
  backend: [balanced, reliable]
```

Router thử `balanced` theo số retry cấu hình. Nếu vẫn lỗi, router tự chuyển sang
`reliable`. Client model được cache theo alias, và mọi lần thử/fallback đều được log.

## Tiết kiệm token và tăng bộ nhớ

1. Route bằng keyword trước, không dùng một model supervisor cho mọi request.
2. Giới hạn tối đa hai agent song song và cấu hình được.
3. Không synthesis khi chỉ một agent trả lời.
4. Source retrieval cục bộ không dùng embedding API.
5. Prompt chỉ chứa file/đoạn source liên quan trong ngân sách ký tự.
6. Ký ức dài hạn truy hồi theo user và độ liên quan, không nhét toàn bộ lịch sử.
7. LangGraph checkpoint duy trì trạng thái thread và hỗ trợ tiếp tục phiên.

Điều chỉnh ngân sách tại `config/agents.yaml`.

## Kiểm thử

```powershell
pytest
ruff check .
```

Test router dùng model giả nên kiểm tra retry/fallback mà không tốn API token.
