# Plan: รายงานจุดน้ำท่วม (tracer bullet ก่อน แล้วค่อยเติมกติกา)

> ที่มา: `docs/specs/flood-reports.md` **ร่างที่ 3** (`cc24e79`) · intent: `docs/intent/flood-reports-2569-10-01.md` · กฎความปลอดภัย: `.claude/skills/security-baseline/SKILL.md`
> แผนฉบับแรก 30 ก.ย. 2569 · เขียนใหม่ 1 ต.ค. 2569 ให้ตรงร่างที่ 3 · ติ๊ก `[x]` เมื่อ test ของข้อนั้นผ่านแล้ว

## Context

ทำเส้นทางที่บางที่สุดให้วิ่งครบทุกชั้นก่อน คือ API (`handle()`) → logic (`src/reports.ts`) → store (`src/store.ts`) → test
แล้วค่อยเติมกติกาหลัก ได้แก่ จำกัดขนาด body · ตรวจข้อมูล · เวลา · โควตา · ส่วนที่เหลืออยู่ใต้หัวข้อ **Later**

"DB" ในงานนี้คือ store ในหน่วยความจำ (`createMemoryStore`) เพราะการเก็บถาวรอยู่ใน Out of scope ของ spec

กติกาการทำงาน:
- TDD: เขียน test ให้ตกก่อน แล้วค่อยเขียนโค้ดให้ผ่าน
- หนึ่งขั้น = หนึ่ง commit · ทุก commit ต้องขอยืนยันพร้อมแสดง diff
- จบทุกขั้น: `npm test` ผ่านทั้งหมด · `npm run lint` exit 0 · `git diff main -- tests/app.test.ts tests/time.test.ts package.json data/` ว่าง
- ทำบน branch `feat/flood-reports`

ไฟล์ที่แตะทั้งหมดอยู่ใน "ไฟล์ที่แตะได้ (รายการปิด)" ของ spec
**ไฟล์ที่ไม่แตะ:** `data/stations.json` · `src/districts.ts` · `src/stations.ts` · `src/time.ts` · `tests/app.test.ts` · `tests/time.test.ts` · `package.json` · `package-lock.json` · `README.md`

### ของที่เกิน spec ร่างที่ 3 (มาจากรีวิว spec 1 ต.ค. 2569)

ทำตามข้อเหล่านี้ไปก่อน แล้วค่อยแก้ spec ตามให้ตรงกันใน commit แยก

| รหัสรีวิว | เรื่อง | อยู่ขั้น |
| --------- | ------ | -------- |
| A1 | นับไบต์จริงเสมอ `content-length` เป็นแค่ทางลัดปฏิเสธเร็ว ไม่ใช่ตัวเชื่อ | 3 |
| D1 | แยกตัวจัดการคำขอ HTTP ออกจาก `listen()` เพื่อให้ test `413` ได้ (`SEC-14`) — วางไว้ใน `src/request.ts` ที่อยู่ในรายการปิดอยู่แล้ว | 4 |
| A2 | ตรวจ URL บน `landmarkKey(s)` (ลบ zero-width แล้ว) ไม่ใช่บนค่าหลัง `trim()` | 6 |
| A3 | `ReportStore.inDistrict` คืนตามลำดับที่ `add` · `visibleReports` อาศัยลำดับนี้ตอนเวลาเท่ากัน | 7 |

## ทำแล้ว

- [x] ขั้น 0 เตรียม: `npm install` · แยก commit สกิลและ `CLAUDE.md` → `a6d6b1a` `08fcf3e`

**ถอยโค้ดออก 1 ต.ค. 2569:** โค้ด tracer ที่เคยทำ (`e8c348e` `b174998` `9450197` และขั้นป้ายที่ branch `backup/step3`) ถูกเอาออกตามที่ KENGCOM สั่งให้เหลือแค่แผน · ดูโค้ดเดิมได้จากประวัติ git · ตอนนี้ `src/` และ `tests/` เหมือน `main` · 8 test เดิมผ่าน

## คืนนี้: 8 ขั้น

### ขั้น 1: tracer ฝั่งเขียน · `POST /reports` ที่ body ถูกต้องได้ `201`

- **ไฟล์:** `src/reports.ts` (ใหม่) · `src/store.ts` (ใหม่) · `src/app.ts` · `tests/reports.test.ts` (ใหม่)
- **test ก่อน:**
  - [x] RPT-REQ-001: ได้ `201` มี `notice` · `report` มีแค่ `{ id, landmark, depthCm, seenAt, verified }` · `id` เป็น UUID v4 · `seenAt` = `"2026-09-30T19:30:00+07:00"` · ไม่มี `districtId` `receivedAt` `expiresAt` `severity`
  - [x] ไม่มี store ใน ctx ได้ `500 reports not configured`
  - [x] RPT-REQ-015 (ส่วนแรก): `vi.spyOn` ดัก `console.*` ทั้งไฟล์ · helper `call()` ตรวจว่าทุกคำตอบไม่มี `203.0.113.7` และไม่มี `::/64`
- **โค้ด:**
  - [x] `src/reports.ts`: type `Report` (ไม่มีช่อง PII) · `parseReportInput` แบบบางที่สุด (ยังเชื่อ body · `seenAt` = `now`) · `REPORT_TTL_MS`
  - [x] `src/store.ts`: `ReportStore` · `createMemoryStore` มีแค่ `add` กับ `inDistrict`
  - [x] `src/app.ts`: `reports?` ใน `Context` · route `POST /reports` · `reportJson` ดึงข้อมูลทีละช่อง
- [x] commit

### ขั้น 2: tracer ฝั่งอ่าน · `GET /districts/:id` เห็นรายงานใต้ป้าย "ยังไม่ยืนยัน"

- **ไฟล์:** `src/reports.ts` · `src/app.ts` · `tests/reports.test.ts`
- **test ก่อน:**
  - [ ] RPT-REQ-009: `reports` = `{ verified: false, label: "รายงานจากประชาชน ยังไม่ยืนยัน", items }` ทั้งเขตที่มีและไม่มีรายงาน และตอนไม่ส่ง store
  - [ ] RPT-REQ-001 ส่วนท้าย: item ใน `reports.items` `toEqual` กับ `report` ที่ได้จาก `POST`
  - [ ] RPT-REQ-009: `stations` `toEqual` กับตอนที่ยังไม่มีรายงาน · รายงานเขตอื่นไม่โผล่ · item มีแค่ช่องสาธารณะ
  - [ ] RPT-REQ-011: ที่ `now` + 5:59:59 ยังเห็น · ที่ + 6:00:00 ไม่เห็น · `GET` ก่อน `receivedAt` ไม่เห็น · ส่ง 21 รายงานเห็น 20 อันใหม่สุด เรียง `seenAt` ใหม่ไปเก่า
- **โค้ด:**
  - [ ] `src/reports.ts`: `REPORTS_LABEL` · `MAX_REPORTS_SHOWN` · `visibleReports`
  - [ ] `src/app.ts`: `reports` = `{ verified, label, items }` ผ่าน `reportJson` ตัวเดียวกับ `POST`
- [ ] commit

### ขั้น 3: อ่าน body แบบจำกัดขนาด (logic ล้วน ยังไม่ต่อ server)

- **ไฟล์:** `src/request.ts` (ใหม่) · `tests/request.test.ts` (ใหม่)
- **test ก่อน** (ใช้ `Readable` ปลอมที่บันทึกการเรียก `pause()`):
  - [ ] RPT-REQ-014: 2,048 ไบต์ได้ `ok` · 2,049 ได้ `too-large` · 3 chunk ละ 1,200 ได้ `too-large` และ `pause()` ถูกเรียก และไม่รับ chunk ที่ 3 · `content-length: 20000` คืนทันที · `น` ถูกตัดคร่อม chunk ได้ข้อความถูก · body ที่ landmark 120 ตัวได้ `ok`
  - [ ] **A1**: `content-length: 10` แต่ส่งจริง 3,000 ไบต์ ได้ `too-large`
  - [ ] RPT-REQ-014: `parseJsonBody("")` · `("{bad")` · `("[1]")` ได้ `undefined` · `INVALID_JSON` · `[1]`
- **โค้ด:**
  - [ ] `readBody` (ใช้ `pause()` ห้าม `destroy()` · `Buffer.concat` ก่อน decode · นับไบต์จริงเสมอ)
  - [ ] `parseJsonBody` · `INVALID_JSON` · `BODY_LIMIT_BYTES`
- [ ] commit

### ขั้น 4: ต่อเข้า server จริง (จบขั้นนี้ tracer ครบทุกชั้น)

- **ไฟล์:** `src/request.ts` · `src/server.ts` · `src/app.ts` · `tests/request.test.ts` · `tests/reports.test.ts`
- **test ก่อน:**
  - [ ] **D1** / RPT-REQ-014: `handleRequest` กับคำขอเกิน 2 KB ได้ `413` `{ "error": "payload too large" }` · header `connection: close` · handler ที่ส่งเข้าไปไม่ถูกเรียก
  - [ ] RPT-REQ-017: body เป็น `INVALID_JSON` ที่ `GET /districts` ได้ `400` `{ "error": "invalid JSON" }`
  - [ ] `handleRequest` ส่ง `now` และ store ตัวเดียวกันทุกคำขอ: `POST` แล้ว `GET` ผ่าน `handleRequest` เห็นรายงาน
- **โค้ด:**
  - [ ] `src/request.ts`: `handleRequest(req, res, deps)` = `readBody` → `parseJsonBody` → `handle()` → เขียนคำตอบ
  - [ ] `src/server.ts`: เหลือแค่สร้าง store หนึ่งตัว แล้ว `createServer((req, res) => handleRequest(...)).listen()` · ไม่เพิ่ม log ต่อคำขอ
  - [ ] `src/app.ts`: ถ้าได้ `INVALID_JSON` ที่ route อื่นตอบ `400 invalid JSON`
- **ตรวจด้วยมือ** (Git Bash · ยิงแค่ `localhost`):
  - [ ] `curl -s -X POST localhost:3000/reports -d '{"districtId":"lat-phrao","landmark":"x","depthCm":30}'` มี `"verified":false`
  - [ ] `curl -s localhost:3000/districts/lat-phrao` มี `"label":"รายงานจากประชาชน ยังไม่ยืนยัน"` และ `"landmark":"x"`
  - [ ] `head -c 20000 /dev/zero | curl -s -o /dev/null -w "%{http_code}" -X POST --data-binary @- localhost:3000/reports` พิมพ์ `413`
- [ ] commit

### ขั้น 5: ตรวจ body ทั้งก้อน เขต และความลึก

- **ไฟล์:** `src/reports.ts` · `src/app.ts` · `tests/reports.test.ts`
- **test ก่อน:**
  - [ ] RPT-REQ-006: `null` · `[]` · `"x"` · `5` · `undefined` · `INVALID_JSON` ได้ `fields` = `["body"]` · หลายช่องผิดได้ครบและเรียง `districtId` `landmark` `depthCm` `seenAt` · `phone` `verified` `isVerified` ถูกทิ้ง · `__proto__` จาก `JSON.parse` ไม่เปลี่ยน prototype · body ของ `400` ไม่มีค่าที่ผู้ใช้ส่งมา
  - [ ] RPT-REQ-002: `"atlantis"` · `"LAT-PHRAO"` · `" lat-phrao"` · `42` · ไม่ส่ง ได้ `400` · หลัง `400` แล้ว `reports.items` = `[]`
  - [ ] RPT-REQ-004: `1` และ `300` ได้ `201` · `0` `-5` `301` `30.5` `"30"` `null` `NaN` ไม่ส่ง ได้ `400`
- **โค้ด:**
  - [ ] `parseReportInput` ดึงทีละช่อง ไม่ใช้ `{...body}`
  - [ ] `DEPTH_MIN_CM` / `DEPTH_MAX_CM`
- [ ] commit

### ขั้น 6: ตรวจจุดสังเกต

- **ไฟล์:** `src/reports.ts` · `tests/reports.test.ts`
- **test ก่อน:**
  - [ ] RPT-REQ-003: ทุกค่าในรายการปฏิเสธ รวม `"ab\n"` `"\tab"` zero-width · `"ก".repeat(120)` ผ่าน `121` ไม่ผ่าน · `"เซ็น".repeat(30)` ผ่าน เติมอีกตัวไม่ผ่าน · ช่องว่างหัวท้ายถูกตัด
  - [ ] RPT-REQ-003 ขั้น 7: URL 6 ค่าได้ `400` · ไม่ใช่ URL 6 ค่าได้ `201`
  - [ ] **A2**: `"bit​.ly/abc"` ได้ `400`
  - [ ] RPT-REQ-010: ตาราง key เดียวกัน / คนละ key ทั้ง 5 แถว (เรียก `landmarkKey` และ `pointKeyOf` ตรงๆ)
- **โค้ด:**
  - [ ] ตรวจตามลำดับ: NFC → อักขระควบคุม**ก่อน** trim → ความยาวตาม code point → `landmarkKey` ไม่ว่าง → ไม่มี URL (บน `landmarkKey`)
  - [ ] `LANDMARK_MAX` · `landmarkKey` · `pointKeyOf`
- [ ] commit

### ขั้น 7: เวลาที่เห็น การหมดอายุ และการเรียง

- **ไฟล์:** `src/reports.ts` · `src/store.ts` · `tests/reports.test.ts`
- **test ก่อน:**
  - [ ] RPT-REQ-005: ทุกแถวของตาราง รวมไม่ส่ง · ตรงขอบพอดี · เกินขอบ 1 วินาที · +5 นาทีถูกตัดเป็น `now`
  - [ ] RPT-REQ-006: body มี `receivedAt` ปลอม ยังหายตอน `seenAt` + 6 ชม. (รีวิว A5: ตรวจทางอ้อมเพราะ `receivedAt` ไม่ออก API)
  - [ ] RPT-REQ-011: `seenAt` = `now` − 1 ชม. หายตอน `now` + 5:00:00 · `seenAt` เท่ากัน `receivedAt` ใหม่กว่าขึ้นก่อน
  - [ ] **A3**: `seenAt` และ `receivedAt` เท่ากันทั้งคู่ อันที่ `add` ทีหลังขึ้นก่อน · `inDistrict` คืนตามลำดับ `add`
- **โค้ด:**
  - [ ] regex · ตรวจวันที่มีจริงด้วย `Date.UTC` · ช่วง offset · ช่วง −6 ชม. / +5 นาที
  - [ ] ตัดด้วย `min(ค่าที่ส่งมา, now)` · `SEEN_MAX_PAST_MS` · `SEEN_MAX_FUTURE_MS` · `expiresAtOf`
  - [ ] tie-break ใน `visibleReports` · comment ใน `ReportStore.inDistrict` ว่าคืนตามลำดับ `add`
- [ ] commit

### ขั้น 8: โควตาต่อ client key

- **ไฟล์:** `src/limiter.ts` (ใหม่) · `src/request.ts` · `src/app.ts` · `src/server.ts` · `tests/reports.test.ts` · `tests/request.test.ts`
- **test ก่อน:**
  - [ ] RPT-REQ-012: ทุกแถวของตาราง รวมส่ง 20 ครั้งที่ +5:00 แล้วยังได้ `201` ที่ +10:00 · JSON เสียและ `{}` ถูกนับ · คนละ key ไม่กระทบกัน
  - [ ] RPT-REQ-013 ส่วน `clientKeyOf` ใน `tests/request.test.ts`: ตาราง 7 แถว รวม `x-forwarded-for` ถูกเมิน
  - [ ] RPT-REQ-015: คำตอบ `429` ไม่มี `203.0.113.7` และไม่มี `::/64`
  - [ ] ไม่มี limiter ใน ctx ได้ `500 reports not configured`
- **โค้ด:**
  - [ ] `src/limiter.ts`: `createLimiter` · `hit` · `QUOTA_MAX` · `QUOTA_WINDOW_MS` · เก็บเวลาไม่เกิน 5 ค่าต่อ key · คำขอที่ได้ `429` ไม่ถูกนับ
  - [ ] `src/request.ts`: `clientKeyOf` · `handleRequest` ส่ง `clientKey` และ limiter
  - [ ] `src/app.ts`: `limiter?` `clientKey?` ใน `Context` · `hit` **ก่อน**ตรวจ body
  - [ ] `src/server.ts`: สร้าง limiter หนึ่งตัว
  - [ ] `tests/reports.test.ts`: `beforeEach` สร้าง limiter ด้วย (ไม่งั้น test เดิมของเราได้ `500` ทั้งหมด)
- [ ] commit

## Later (ไม่ทำคืนนี้)

- [ ] RPT-REQ-013 ส่วนแทนรายงานเดิม: `pointKey` ใน `Report` · `limiter.previous` / `remember` · `store.remove` · ลำดับ 6–8 ของ `POST /reports` · ตาราง 9 แถว
  - รีวิว A4: `store.remove` id ที่ไม่มีแล้วต้องไม่ทำอะไร พร้อม test
- [ ] RPT-REQ-016 เพดานหน่วยความจำ: `MAX_ACTIVE_REPORTS` · `MAX_TRACKED_KEYS` แยกต่อ Map พร้อม LRU · test 4 แถว
  - รีวิว A6: limiter ลืม key ตาม LRU แล้วคนเดิมส่งซ้ำจะไม่ถูกแทนที่ — เขียนลง Edge cases ว่ายอมรับ
- [ ] RPT-REQ-015 ส่วนที่เหลือ: type `Report` ต้องไม่มีช่อง PII
- [ ] รีวิว A9: `landmarkKey` ลบ `U+2060` และ `U+00AD` ด้วย หรือเขียนเหตุผลที่ไม่ลบ
- [ ] แก้ spec ตามรีวิว A1–A9 และ D1–D3 ให้ตรงกับที่ทำจริง (commit แยก)
- [ ] แก้ intent ใหม่ให้บันทึกข้อตัดสิน 1 ต.ค. (แทนที่รายงานซ้ำ · `reports` เป็น object · `seenAt` ไม่บังคับ) และใส่หมายเหตุหัว intent เดิมว่าถูกแทนแล้ว
- [ ] RPT-REQ-017 ตรวจปิดงาน: `grep -r rooptanjai src tests` ว่าง · `git diff main -- package.json tests/app.test.ts tests/time.test.ts` ว่าง
- [ ] รีวิวเทียบ `SEC-01`–`SEC-14` (checkpoint `cp7-review`)

## ความเสี่ยงและเรื่องที่ยังไม่แน่ใจ

1. **ขั้น 4–7 `POST` เปิดผ่าน server จริงแต่ยังไม่มีโควตา:** จำกัดขนาด body แล้ว (ขั้น 3–4) แต่ยิงรัวได้จนถึงขั้น 8 · ช่วงนี้ใช้แค่ `localhost` ห้ามเปิดให้เครื่องอื่นเข้า
2. **`handleRequest` ใน `src/request.ts` (D1) เกินจากที่ spec บอกว่าไฟล์นี้มี:** ไม่ได้เพิ่มไฟล์นอกรายการปิด แต่ต้องแก้ spec ตาม (อยู่ใน Later)
3. **test ของ `readBody` ต้องปลอม stream:** ต้องตรวจได้ว่า `pause()` ถูกเรียกและ chunk ที่ 3 ไม่ถูกรับ · จะรู้แน่ว่าทำยังไงตอนเขียนจริงในขั้น 3
4. **ขั้น 8 จะทำให้ test ใน `tests/reports.test.ts` ทุกตัวได้ `500` ถ้าลืมเพิ่ม limiter ใน `beforeEach`:** ไม่ใช่ regression · test ตาราง 21 รายงาน (ขั้น 2) ต้องส่งจากคนละ `clientKey` ไม่งั้นติดโควตาที่ครั้งที่ 6
5. **regex URL ของ A2 ทำงานบนค่าที่ `toLowerCase()` แล้ว:** ผลไม่ต่างเพราะ regex มี flag `i` อยู่แล้ว แต่ต้องตรวจซ้ำว่าตัวอย่าง "ไม่ใช่ URL" ทั้ง 6 ค่ายังผ่าน
6. **Open questions ข้อ 1–2 ใน intent ใหม่ยังไม่มีคนยืนยัน (6 ชม. · 5 ครั้ง/10 นาที · 20 อัน):** ใช้ค่าตาม spec เขียนเป็น `export const` ที่เดียว
7. **ผลลบที่ถูกต้อง ไม่ใช่บั๊ก:**
   - `"หน้าเซ็นทรัล"` กับ `"หน้า เซ็นทรัล"` ได้คนละ key
   - `"Soi.Ari"` ได้ `400` (ข้อจำกัดที่ยอมรับใน spec edge case 11)
   - ความลึก `0` ได้ `400`
   - คำตอบ `4xx` และ `5xx` ไม่มี `notice`
   - รายงานที่ 21 ยังอยู่ใน store แต่ไม่แสดง

## Verification

- จบแต่ละขั้น: `npm test` ผ่านทั้งหมด (test เดิม 8 ตัว + test ใหม่) · `npm run lint` exit 0
- จบขั้น 4 ตรวจด้วยมือด้วย curl 3 คำสั่ง ยิงแค่ `localhost` เท่านั้น ห้ามยิง `flood-api.rooptanjai.com` (`SEC-01`)
- ก่อนปิดงาน:
  - `git diff main --stat` มีแค่ไฟล์ในรายการปิดของ spec กับ `docs/`
  - `tests/app.test.ts` และ `tests/time.test.ts` ไม่อยู่ใน diff
