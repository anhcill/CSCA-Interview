# 📋 BÁO CÁO REVIEW: SPEECH ANALYSIS & RAG DỮ LIỆU TRƯỜNG ĐẠI HỌC

> Ngày review: 19/06/2026  
> Phạm vi: Phần 1 — Speech pronunciation/fluency scoring | Phần 2 — RAG dữ liệu trường đại học Trung Quốc  
> Mức độ: **Mức 3 (Khó)**

---

## ═══════════════════════════════════════
## PHẦN 1: SPEECH ANALYSIS — CHẤM PRONUNCIATION, FLUENCY, PAUSE, SPEAKING SPEED
## ═══════════════════════════════════════

### 1.1 HIỆN TRẠNG

| Tính năng | Trạng thái | Chi tiết |
|---|---|---|
| Transcribe (STT) | ✅ Có | OpenAI Whisper API, `speech.service.ts` |
| Text-to-Speech (TTS) | ✅ Có | OpenAI TTS API, 6 giọng (alloy/echo/fable/onyx/nova/shimmer) |
| Pronunciation scoring | ❌ **CHƯA CÓ** | Không có bất kỳ code nào phân tích pronunciation |
| Fluency scoring | ❌ **CHƯA CÓ** | Không có phân tích fluency |
| Pause detection | ❌ **CHƯA CÓ** | Không có phân tích pause/silence |
| Speaking speed (WPM) | ❌ **CHƯA CÓ** | Whisper trả `duration` nhưng không tính WPM |
| Phoneme analysis | ❌ **CHƯA CÓ** | Không có phân tích âm tiếng Anh/Trung |

### 1.2 PHÂN TÍCH CHI TIẾT

#### `backend/src/modules/speech/speech.service.ts`
```
Chỉ có 2 hàm:
1. transcribeAudio() → gọi Whisper → trả {text, language, duration}
2. synthesizeSpeech() → gọi TTS → trả {audioBuffer, contentType}
```

**Vấn đề cốt lõi:**
- Whisper chỉ trả **text** (nội dung nói), KHÔNG trả pronunciation score
- OpenAI Whisper KHÔNG có tính năng pronunciation assessment built-in
- Không có pipeline nào: audio → phoneme alignment → scoring
- `duration` được trả về nhưng **KHÔNG ai dùng** để tính speaking speed

#### `backend/src/modules/interviews/detailed-scoring.service.ts`
```
Chấm điểm 100% dựa trên TEXT:
- relevance (liên quan câu hỏi)
- logic (cấu trúc logic)  
- language (ngữ pháp/từ vựng TEXT)
- confidence (dựa trên nội dung viết, KHÔNG phải giọng nói)
```

**Vấn đề:** Điểm "confidence" hiện tại chỉ phân tích text, không phải vocal confidence (pitch, volume, hesitation markers).

### 1.3 THIẾU GÌ ĐỂ LÀM PRONUNCIATION/FLUENCY

| Cần | Giải pháp khả thi | Độ khó |
|---|---|---|
| Pronunciation scoring | Azure Speech SDK (Pronunciation Assessment API) hoặc SpeechAce API | ⭐⭐⭐ |
| Phoneme-level analysis | Azure trả phoneme accuracy, word-level timing | ⭐⭐⭐ |
| Fluency scoring | Azure trả fluency score (0-100) tự động | ⭐⭐ |
| Pause detection | Dùng word-level timestamps từ Whisper verbose_json, tính gap > threshold | ⭐⭐ |
| Speaking speed (WPM) | `word_count / duration * 60` — dễ tính từ Whisper output hiện tại | ⭐ |
| Tone/pitch analysis | Praat/parselmouth (Python) hoặc Web Audio API (frontend) | ⭐⭐⭐⭐ |
| Chinese tone scoring | Cần model riêng cho 4 thanh điệu tiếng Trung | ⭐⭐⭐⭐⭐ |

### 1.4 ĐỀ XUẤT IMPLEMENTATION

**Giai đoạn 1 — Quick Win (1-2 ngày):**
```typescript
// Tính WPM từ Whisper output hiện tại
function calcSpeakingSpeed(text: string, durationSec: number): number {
  const wordCount = text.split(/\s+/).length;
  return Math.round((wordCount / durationSec) * 60);
}
// Ideal range: 120-160 WPM (English), 200-250 字/分 (Chinese)
```

**Giai đoạn 2 — Azure Pronunciation Assessment (3-5 ngày):**
```
npm install microsoft-cognitiveservices-speech-sdk

Azure trả về:
- PronunciationScore (0-100)
- AccuracyScore (phoneme level)
- FluencyScore
- CompletenessScore  
- Word-level timing + error detail
- Hỗ trợ: en-US, zh-CN, vi-VN
```

**Giai đoạn 3 — Advanced (7-10 ngày):**
- Custom pause analysis (long pause > 3s = penalty)
- Filler word detection ("uh", "um", "嗯", "那个")
- Speaking confidence from audio features
- Per-phoneme feedback cho Chinese tones

### 1.5 KẾT LUẬN SPEECH

| Tiêu chí | Đánh giá |
|---|---|
| Có STT/TTS | ✅ Đạt |
| Chấm pronunciation | ❌ **Hoàn toàn chưa có** |
| Chấm fluency | ❌ **Hoàn toàn chưa có** |
| Phân tích pause | ❌ **Chưa có** |
| Speaking speed | ❌ **Dữ liệu có, code tính chưa có** |
| Phân tích âm EN/ZH | ❌ **Chưa có** |
| **Tổng: 1/6 tính năng Speech Analysis** | **🔴 Cần xây dựng từ đầu** |

---

## ═══════════════════════════════════════
## PHẦN 2: RAG DỮ LIỆU TRƯỜNG ĐẠI HỌC TRUNG QUỐC
## ═══════════════════════════════════════

### 2.1 HIỆN TRẠNG

| Thành phần | Trạng thái | Chi tiết |
|---|---|---|
| Database schema (schools/majors/scholarships) | ✅ Có | Bảng `schools`, `majors`, `scholarships`, `school_majors`, `school_scholarships` |
| CRUD API cho schools | ✅ Có | `schools.routes.ts` — GET/POST/PUT/DELETE |
| CRUD API cho majors | ✅ Có | `majors.routes.ts` — GET/POST/PUT/DELETE |
| CRUD API cho scholarships | ✅ Có | `scholarships.routes.ts` — GET/POST/PUT/DELETE |
| Admin UI quản lý | ✅ Có | `admin/schools/page.tsx`, `admin/majors/page.tsx`, `admin/scholarships/page.tsx` |
| Questions linked to school/major/scholarship | ✅ Có | Bảng `questions` có FK: `school_id`, `major_id`, `scholarship_id` |
| **RAG pipeline: DB → tìm → inject prompt → AI hỏi sát** | ❌ **CHƯA CÓ** | Đây là phần quan trọng nhất |
| Seed data trường TQ | ❌ **CHƯA CÓ** | Database rỗng, chưa có trường nào |

### 2.2 PHÂN TÍCH CHI TIẾT

#### A. Database Schema — ĐÃ CÓ nhưng THIẾU TRƯỜNG QUAN TRỌNG

**Bảng `schools` hiện tại:**
```sql
id, name, name_zh, name_en, city, province, website_url, description, is_active
```

**THIẾU các trường cần thiết cho RAG:**
| Trường thiếu | Tại sao cần |
|---|---|
| `ranking` / `ranking_type` | AI cần biết "Zhejiang Uni ranking 3 toàn TQ" để hỏi sát |
| `strong_majors` / `research_areas` | "Trường này mạnh về AI, Engineering" |
| `admission_requirements` | Yêu cầu đầu vào cụ thể |
| `interview_tips` | Câu hỏi phỏng vấn thường gặp cho trường này |
| `program_language` | Chương trình dạy bằng tiếng gì (EN/ZH/mixed) |
| `campus_info` | Thông tin campus cho câu hỏi "Why this school?" |
| `notable_alumni` / `achievements` | Dữ liệu để AI gợi ý answer |

**Bảng `scholarships` hiện tại:**
```sql
id, name, code, description, is_active
```

**THIẾU:**
| Trường thiếu | Tại sao cần |
|---|---|
| `requirements` | Yêu cầu cụ thể (GPA, tuổi, quốc tịch...) |
| `deadline` | Thời hạn nộp |
| `coverage` | Bao gồm gì (tuition, living, travel) |
| `study_plan_requirements` | Yêu cầu study plan cụ thể |
| `interview_format` | Online/offline, thời lượng, ngôn ngữ |
| `common_interview_questions` | JSON array câu hỏi hay gặp |
| `tips` | Mẹo phỏng vấn cho học bổng này |

#### B. Adaptive Interview Engine — CÓ nhưng KHÔNG DÙNG RAG

**File:** `adaptive-interview.engine.ts`

```typescript
// Hiện tại chỉ truyền tên trường/ngành dạng string thô:
targetSchool: session.targetSchool ?? "trường bạn apply",
targetMajor: session.targetMajor ?? "ngành bạn apply",  
scholarshipType: session.scholarshipType ?? "học bổng mục tiêu",
```

**Vấn đề:**
- `targetSchool`, `targetMajor`, `scholarshipType` là **plain text string** do user tự nhập
- **KHÔNG query database** để lấy thông tin chi tiết về trường
- **KHÔNG inject** ranking, ngành mạnh, yêu cầu học bổng vào prompt
- AI chỉ biết TÊN trường, không biết GÌ VỀ trường đó

#### C. AI Service — Prompt CHUNG CHUNG, không có RAG context

**File:** `ai.service.ts` → `buildSystemPrompt()`

```typescript
// Prompt hiện tại:
`Context: Candidate applies for ${input.scholarshipType} scholarship.`
`School: ${input.targetSchool}, Major: ${input.targetMajor}, Degree: ${input.degreeLevel}.`
```

**Kết quả:** AI hỏi generic:
- "Why did you choose this university?" (không biết trường gì đặc biệt)
- "What is your study plan?" (không biết trường yêu cầu gì cụ thể)

**Lý tưởng với RAG:**
```typescript
// Prompt NÊN có:
`School: Zhejiang University (浙江大学)
 - Ranking: #3 China (QS 2026)
 - Strong in: Computer Science (ranked #1 in China), AI, Engineering
 - Campus: Hangzhou (Zijingang campus for CS)
 - Program language: English track available
 
 Scholarship: CSC (China Scholarship Council)
 - Requirements: Under 35, non-Chinese citizen, GPA 3.0+
 - Coverage: Full tuition + living stipend 3500 CNY/month
 - Study plan: Must submit 800-word research-focused study plan
 - Common questions: Why China? Why this school? Research plan? Future career?
 
 Major: Computer Science (Master)
 - Key research labs: CAD&CG Lab, AI Institute
 - Required: Programming background, math foundation`
```

### 2.3 RAG PIPELINE — CẦN XÂY DỰNG

```
Hiện tại (KHÔNG CÓ RAG):
User chọn "Zhejiang Uni" → string "Zhejiang Uni" → AI prompt → AI hỏi generic

Cần xây dựng:
User chọn school_id → Query DB → Lấy school details + majors + scholarships 
                                    + requirements + tips + common questions
                     → Build rich context
                     → Inject vào system prompt  
                     → AI hỏi SÁT theo trường/ngành/học bổng cụ thể
```

**Pipeline cần code:**

```typescript
// rag-context.service.ts (CHƯA TỒN TẠI)
async function buildRAGContext(schoolId: string, majorId: string, scholarshipId: string) {
  const [school, major, scholarship] = await Promise.all([
    prisma.school.findUnique({ where: { id: schoolId } }),
    prisma.major.findUnique({ where: { id: majorId } }),
    prisma.scholarship.findUnique({ where: { id: scholarshipId } }),
  ]);
  
  // Lấy câu hỏi liên quan từ question bank
  const relatedQuestions = await prisma.question.findMany({
    where: { 
      OR: [
        { schoolId }, 
        { majorId }, 
        { scholarshipId }
      ],
      isActive: true 
    },
    take: 10
  });
  
  return formatRAGContext(school, major, scholarship, relatedQuestions);
}
```

### 2.4 SEED DATA — HOÀN TOÀN RỖNG

Kiểm tra seed files:
- `database/seed_day_01.sql` — Chỉ có users, KHÔNG có schools/majors/scholarships
- `database/seed_mvp_day_02_04.sql` — Có thể có nhưng KHÔNG đủ dữ liệu phong phú
- **Không có file seed nào chứa dữ liệu trường đại học TQ thật**

**Cần tạo seed data cho ít nhất 20-30 trường TQ phổ biến:**
- Peking University (北京大学)
- Tsinghua University (清华大学)
- Zhejiang University (浙江大学)
- Fudan University (复旦大学)
- Shanghai Jiao Tong University (上海交通大学)
- Wuhan University (武汉大学)
- ... với đầy đủ ranking, ngành mạnh, yêu cầu

### 2.5 KẾT LUẬN RAG

| Tiêu chí | Đánh giá |
|---|---|
| DB schema schools/majors/scholarships | ✅ Cơ bản có, nhưng thiếu nhiều trường quan trọng |
| CRUD API | ✅ Đạt |
| Admin UI quản lý | ✅ Đạt |
| Questions linked to context | ✅ FK có |
| **RAG pipeline (DB → context → prompt)** | **❌ HOÀN TOÀN CHƯA CÓ** |
| **Rich data (ranking, requirements, tips)** | **❌ Schema thiếu, data rỗng** |
| **AI prompt injection** | **❌ Chỉ dùng tên string thô** |
| **Seed data trường TQ thật** | **❌ Không có** |
| **Tổng: 3/8 tiêu chí RAG** | **🔴 RAG chưa tồn tại thực sự** |

---

## ═══════════════════════════════════════
## PHẦN 3: TỔNG KẾT & KHUYẾN NGHỊ
## ═══════════════════════════════════════

### 3.1 BẢNG TỔNG KẾT

| Phần | Điểm | Nhận xét |
|---|---|---|
| **Speech Analysis** | **1/10** | Chỉ có STT/TTS, hoàn toàn chưa có pronunciation/fluency/pause scoring |
| **RAG Dữ liệu ĐH** | **3/10** | Có CRUD skeleton, nhưng không có RAG pipeline, data rỗng, schema thiếu |

### 3.2 ƯU TIÊN THỰC HIỆN

**🔴 Ưu tiên 1 — RAG (Làm TRƯỚC, tạo giá trị thật):**

1. **Mở rộng DB schema** — Thêm ranking, requirements, tips, deadline vào schools/scholarships (1 ngày)
2. **Tạo seed data** — 20-30 trường TQ phổ biến với đủ thông tin (2 ngày)
3. **Xây RAG context service** — Query DB, build rich context (1 ngày)
4. **Inject vào AI prompt** — Sửa `buildSystemPrompt()` + `adaptive-interview.engine.ts` (1 ngày)
5. **Test end-to-end** — User chọn trường → AI hỏi sát (1 ngày)

**Tổng: ~5-6 ngày cho RAG hoàn chỉnh**

**🟡 Ưu tiên 2 — Speech Analysis (Làm SAU camera):**

1. **Quick win: Speaking speed** — Tính WPM từ Whisper output (0.5 ngày)
2. **Azure Pronunciation Assessment** — Tích hợp SDK, scoring pipeline (3-5 ngày)
3. **Pause detection** — Phân tích word-level timing (1 ngày)
4. **UI hiển thị** — Score radar chart thêm speech metrics (1 ngày)
5. **Chinese tone analysis** — Nâng cao, cần research thêm (5+ ngày)

**Tổng: ~5-7 ngày cho Speech cơ bản, 10-12 ngày cho đầy đủ**

### 3.3 KẾT LUẬN CUỐI

> **Speech Analysis:** Code hiện tại chỉ là "tai nghe" (nghe được gì user nói) chứ KHÔNG phải "giám khảo ngôn ngữ" (đánh giá nói tốt/xấu thế nào). Cần tích hợp service chuyên biệt (Azure Speech hoặc tương đương).

> **RAG:** Có "hộp rỗng" (database tables + CRUD) nhưng chưa có "hàng bên trong" (data thật) và chưa có "người bán hàng" (pipeline đưa data vào AI). Đây là phần TẠO GIÁ TRỊ THẬT cho sản phẩm — user chọn trường X, AI phải biết X là gì, mạnh gì, yêu cầu gì để hỏi sát.

---

---

## ═══════════════════════════════════════
## PHẦN 4: IMPLEMENTATION — ĐÃ THỰC HIỆN (19/06/2026)
## ═══════════════════════════════════════

### 4.1 SPEECH ANALYSIS — ĐÃ XÂY DỰNG GIAI ĐOẠN 1

**Build status:** ✅ Backend TypeScript compile clean | ✅ Frontend TypeScript compile clean

#### A. Backend `speech.service.ts` — Đã thêm:

| Tính năng | Trạng thái | Chi tiết |
|---|---|---|
| `WordSegment` type | ✅ Xong | `{word, start, end}` — word-level timing từ Whisper verbose_json |
| `SpeechMetrics` type | ✅ Xong | Interface đầy đủ: wpm, pauseCount, avgPauseDuration, longestPause, fillerWordCount, fillerWords, fluencyScore, speedRating |
| `calculateWPM()` | ✅ Xong | Tính Words Per Minute từ word count + duration |
| `detectPauses()` | ✅ Xong | Phát hiện pause > 0.8s từ word-level timestamps, trả count + avg + longest |
| `detectFillerWords()` | ✅ Xong | Phát hiện filler words EN ("uh","um","like","you know"...) + ZH ("嗯","那个","就是"...) |
| `rateSpeed()` | ✅ Xong | Đánh giá tốc độ: too_slow / slow / good / fast / too_fast |
| `calculateFluencyScore()` | ✅ Xong | Composite score 0-100 dựa trên WPM + pause + filler word penalties |
| `analyzeSpeechMetrics()` | ✅ Xong | Orchestrator function: segments → full SpeechMetrics object |
| `transcribeAudio()` updated | ✅ Xong | Gọi Whisper với `response_format: "verbose_json"` + `timestamp_granularities: ["word"]`, trả thêm `words` + `speechMetrics` |

#### B. Backend `speech.routes.ts` — Đã cập nhật:

- Route `POST /api/speech/transcribe` trả thêm `words[]` và `speechMetrics{}` trong response

#### C. Frontend `speech-client.ts` — Đã cập nhật:

- Types `WordSegment`, `SpeechMetrics` exported
- `TranscriptionResult` interface mở rộng với `words?` và `speechMetrics?`

#### D. Frontend `SpeechMetricsPanel` component — MỚI:

- File: `frontend/components/interview/speech-metrics-panel.tsx`
- Hiển thị: WPM gauge, pause count, filler words, fluency score
- Speed rating badge với color coding
- Filler words list chi tiết
- Responsive design, dark mode support

### 4.2 BẢNG TỔNG KẾT SAU IMPLEMENTATION

| Tiêu chí | Trước | Sau |
|---|---|---|
| Speaking speed (WPM) | ❌ | ✅ Tính từ Whisper word timestamps |
| Pause detection | ❌ | ✅ Count + avg + longest pause |
| Filler word detection | ❌ | ✅ EN + ZH filler words |
| Fluency scoring | ❌ | ✅ Composite score 0-100 |
| Word-level timing | ❌ | ✅ Whisper verbose_json |
| Frontend hiển thị | ❌ | ✅ SpeechMetricsPanel component |
| Pronunciation scoring (phoneme) | ❌ | ❌ Cần Azure Speech SDK (Giai đoạn 2) |
| Chinese tone analysis | ❌ | ❌ Cần model riêng (Giai đoạn 3) |
| **Tổng Speech Analysis** | **1/8** | **6/8** |

### 4.3 CÒN LẠI — CHƯA IMPLEMENT

| Phần | Lý do | Ưu tiên |
|---|---|---|
| Pronunciation phoneme scoring | Cần Azure Speech SDK + API key | Giai đoạn 2 (3-5 ngày) |
| Chinese tone analysis | Cần custom model / research | Giai đoạn 3 (5+ ngày) |
| RAG pipeline | Cần mở rộng schema + seed data trước | Ưu tiên 1 tiếp theo |
| Seed data 20-30 trường TQ | Data entry / research | 2 ngày |

---

---

## ═══════════════════════════════════════
## PHẦN 5: PRONUNCIATION ASSESSMENT — ĐÃ IMPLEMENT (19/06/2026)
## ═══════════════════════════════════════

### 5.1 AZURE SPEECH SDK INTEGRATION

**Build status:** ✅ Backend tsc clean | ✅ Frontend tsc clean

#### A. Backend `pronunciation-assessment.service.ts` — MỚI

| Thành phần | Chi tiết |
|---|---|
| Package | `microsoft-cognitiveservices-speech-sdk` đã cài |
| Env vars | `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` thêm vào `env.ts` |
| `assessPronunciation()` | Nhận audio base64 → Azure SDK → trả scores |
| `isPronunciationAvailable()` | Check env var có sẵn không |
| Error class | `MissingAzureSpeechKeyError` — trả 503 khi thiếu key |
| Ngôn ngữ hỗ trợ | `en-US`, `zh-CN`, `vi-VN` |

**Kết quả trả về từ Azure:**
```typescript
{
  pronunciationScore: number;   // 0-100 — điểm tổng phát âm
  accuracyScore: number;        // 0-100 — chính xác phoneme
  fluencyScore: number;         // 0-100 — trôi chảy
  completenessScore: number;    // 0-100 — nói đủ từ
  words: [{
    word: string;
    accuracyScore: number;
    errorType: "None" | "Omission" | "Insertion" | "Mispronunciation";
    phonemes?: [{ phoneme: string; accuracyScore: number }];
  }];
  recognizedText: string;
  language: string;
}
```

#### B. Backend Route — `POST /api/speech/pronunciation`

| Input | Type | Mô tả |
|---|---|---|
| `audio` | string (base64) | Audio data |
| `language` | `"en"` / `"zh"` / `"vi"` | Ngôn ngữ (default: "en") |
| `referenceText` | string? | Text mẫu để so sánh (optional) |

#### C. Backend Route — `GET /api/speech/status`

Trả status tất cả speech services:
```json
{
  "transcribe": true,
  "synthesize": true,
  "pronunciationAssessment": true/false  // phụ thuộc Azure key
}
```

#### D. Frontend `speech-client.ts` — Types + API

- `PronunciationResult`, `PronunciationWordDetail`, `PronunciationPhoneme` types
- `assessPronunciation()` API function
- `SpeechStatus` type + `getSpeechStatus()` function

#### E. Frontend `PronunciationPanel` component — MỚI

- 4 score gauges: Pronunciation, Accuracy, Fluency, Completeness
- Color-coded progress bars (green/yellow/orange/red)
- Word-level breakdown với accuracy score per word
- Error type badges: Mispronunciation (đỏ), Omission (xám), Insertion (xanh)
- Smart tips dựa trên scores

### 5.2 BẢNG TỔNG KẾT SAU PRONUNCIATION

| Tiêu chí | Trước P4 | Sau P5 |
|---|---|---|
| Speaking speed (WPM) | ✅ | ✅ |
| Pause detection | ✅ | ✅ |
| Filler word detection | ✅ | ✅ |
| Fluency scoring (OpenAI) | ✅ | ✅ |
| Word-level timing | ✅ | ✅ |
| **Pronunciation scoring (phoneme)** | **❌** | **✅ Azure Speech SDK** |
| **Accuracy per word** | **❌** | **✅ Word-level accuracy + error type** |
| **Fluency scoring (Azure)** | **❌** | **✅ Azure fluency score** |
| **Completeness scoring** | **❌** | **✅ Azure completeness score** |
| Frontend SpeechMetricsPanel | ✅ | ✅ |
| **Frontend PronunciationPanel** | **❌** | **✅ Full UI with word breakdown** |
| Chinese tone analysis | ❌ | ❌ Cần model riêng (Giai đoạn 3) |
| **Tổng Speech Analysis** | **6/12** | **10/12** |

### 5.3 ĐỂ SỬ DỤNG

1. Đăng ký Azure Speech Service: https://portal.azure.com
2. Thêm vào `.env`:
   ```
   AZURE_SPEECH_KEY=your_key_here
   AZURE_SPEECH_REGION=eastasia
   ```
3. Restart backend
4. `GET /api/speech/status` → `pronunciationAssessment: true`
5. Frontend gọi `assessPronunciation(audioBase64, "en")` → nhận scores

### 5.4 CÒN LẠI

| Phần | Trạng thái | Ghi chú |
|---|---|---|
| Chinese tone analysis (4 thanh) | ❌ | Cần custom model, không có off-the-shelf |
| Integrate PronunciationPanel into interview-room | ⚠️ Cần wire | Panel ready, cần gọi sau mỗi answer |
| RAG pipeline | ❌ | Ưu tiên tiếp theo |

---

## ═══════════════════════════════════════
## PHẦN 6: ENHANCED SPEECH ANALYSIS — PAUSE CATEGORIZATION + CONFIDENCE SCORING (19/06/2026)
## ═══════════════════════════════════════

### 6.1 ENHANCED PAUSE ANALYSIS

**Build status:** ✅ Backend TypeScript compile clean

#### A. `PauseDetail` type — MỚI

```typescript
type PauseDetail = {
  durationSec: number;
  category: "short" | "medium" | "long" | "very_long";
  afterWordIndex: number;
  context: string; // e.g. `"...hello" [2.3s] "world..."`
};
```

| Category | Duration | Penalty | Ý nghĩa |
|---|---|---|---|
| `short` | 0.8 – 1.5s | 0 pts | Normal breathing pause |
| `medium` | 1.5 – 3.0s | 3 pts/each | Thinking pause |
| `long` | 3.0 – 5.0s | 7 pts/each | Significant hesitation |
| `very_long` | > 5.0s | 12 pts/each | Major gap, forgot content |

**Penalty capped at 40 points** tổng maximum.

#### B. `pausePenalty` breakdown trong `SpeechMetrics`

```typescript
pausePenalty: {
  shortCount: number;
  mediumCount: number;
  longCount: number;
  veryLongCount: number;
  totalPenalty: number; // capped at 40
}
```

### 6.2 SPEAKING CONFIDENCE SCORING

#### A. `confidenceScore` (0-100) — MỚI

Composite score dựa trên 4 yếu tố vocal:

| Factor | Weight | Logic |
|---|---|---|
| `speedConsistency` | 20% | normal=100, slow/fast=70, too_slow/too_fast=40 |
| `pauseControl` | 35% | 100 - (totalPausePenalty × 2.5), max 0 |
| `fillerAvoidance` | 25% | 100 - (fillerRatio × 300), max 0 |
| `contentLength` | 20% | ≥50 words=100, ≥30=85, ≥15=65, ≥5=40, <5=10 |

#### B. `confidenceFactors` breakdown

```typescript
confidenceFactors: {
  speedConsistency: number;  // 0-100
  pauseControl: number;      // 0-100
  fillerAvoidance: number;   // 0-100
  contentLength: number;     // 0-100
  overallRating: "low" | "medium" | "high" | "excellent";
}
```

| Rating | Score range |
|---|---|
| `excellent` | ≥ 85 |
| `high` | 65 – 84 |
| `medium` | 45 – 64 |
| `low` | < 45 |

### 6.3 FRONTEND UPDATES

- `speech-client.ts`: Types `PauseDetail`, `SpeechMetrics` updated với `pauses[]`, `pausePenalty`, `confidenceScore`, `confidenceFactors`
- `speech-metrics-panel.tsx`: Updated hiển thị confidence score + pause breakdown

### 6.4 BẢNG TỔNG KẾT SAU PHASE 6

| Tiêu chí | Trước P6 | Sau P6 |
|---|---|---|
| Speaking speed (WPM) | ✅ | ✅ |
| Pause detection (count/avg/longest) | ✅ | ✅ |
| **Pause categorization (short/medium/long/very_long)** | **❌** | **✅** |
| **Pause penalty tiers** | **❌** | **✅** |
| **Pause context (surrounding words)** | **❌** | **✅** |
| Filler word detection | ✅ | ✅ |
| Fluency scoring | ✅ | ✅ |
| **Speaking confidence scoring** | **❌** | **✅ Composite 0-100** |
| **Confidence breakdown (4 factors)** | **❌** | **✅** |
| Pronunciation scoring (Azure) | ✅ | ✅ |
| Word-level accuracy | ✅ | ✅ |
| Frontend display | ✅ | ✅ |
| Chinese tone analysis | ❌ | ❌ (Giai đoạn 3) |
| **Tổng Speech Analysis** | **10/14** | **13/14** |

### 6.5 SPEECH ANALYSIS — STATUS TỔNG THỂ

```
██████████████████████████████████████████████████ 93% (13/14)

✅ STT (Whisper)             ✅ TTS (OpenAI)
✅ WPM calculation           ✅ Speed rating (5 levels)
✅ Pause detection            ✅ Pause categorization (4 tiers)
✅ Pause penalty scoring     ✅ Pause context display
✅ Filler word detection     ✅ Fluency score (0-100)
✅ Confidence score (0-100)  ✅ Confidence breakdown (4 factors)
✅ Pronunciation (Azure SDK) ❌ Chinese tone analysis (cần custom model)
```

---

*Report generated by code review analysis — 19/06/2026*
*Updated with implementation results — 19/06/2026*
*Updated with Pronunciation Assessment — 19/06/2026*
*Updated with Enhanced Pause + Confidence Scoring — 19/06/2026*
