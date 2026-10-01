# Plan: รายงานจุดน้ำท่วม (tracer bullet ก่อน แล้วค่อยเติมกติกา)

> ที่มา: `docs/specs/flood-reports.md` (ร่างที่ 2) · กฎความปลอดภัย: `.claude/skills/security-baseline/SKILL.md`
> ตกลงแผนวันที่ 30 ก.ย. 2569 · ติ๊ก `[x]` เมื่อ test ของข้อนั้นผ่านแล้ว · ข้อที่ยังไม่ commit มีหมายเหตุบอกไว้

## Context

ทำเส้นทางที่บางที่สุดให้วิ่งครบทุกชั้นก่อน คือ API (`handle()`) → logic (`src/reports.ts`) → store (`src/store.ts`) → test
แล้วค่อยเติมกติกาหลัก ได้แก่ ตรวจข้อมูล · เวลาและการหมดอายุ · โควตา · จำกัดขนาด body
ส่วนที่เหลืออยู่ใต้หัวข้อ **Later**

"DB" ในรอบนี้คือ store ในหน่วยความจำ (`createMemoryStore`) เพราะการเก็บถาวรอยู่ใน Out of scope ของ spec

ไฟล์ที่แตะทั้งหมดอยู่ใน "ไฟล์ที่แตะได้ (รายการปิด)" ของ spec
**ไฟล์ที่ไม่แตะ:** `data/stations.json` · `src/districts.ts` · `src/stations.ts` · `src/time.ts` · `tests/app.test.ts` · `tests/time.test.ts` · `package.json` · `package-lock.json` · `README.md`

ของเดิมที่ใช้ซ้ำ:
- `toBangkokIso` (`src/time.ts`)
- `districts` (`src/districts.ts`)
- `NOTICE` และ `Context` (`src/app.ts`)
- `randomUUID` (`node:crypto`) และ `isIP` (`node:net`)

กติกาการทำงาน:
- TDD: เขียน test ให้ตกก่อน แล้วค่อยเขียนโค้ดให้ผ่าน
- หนึ่งขั้น = หนึ่ง commit · ทุก commit ต้องขอยืนยันพร้อมแสดง diff
- ทำบน branch `feat/flood-reports`

## ขั้น 0: เตรียม

- [x] รัน `npm install` แล้วรัน `npm test` และ `npm run lint` · ผลที่ได้: 8/8 ผ่าน · `tsc` exit 0
- [x] `npm install` แก้ `package-lock.json` (ลบบรรทัด `libc`) → คืนไฟล์จาก git แล้ว
- [x] commit สกิลที่ staged ค้างไว้แยกออกไป → `a6d6b1a`
- [x] commit `CLAUDE.md` แยกออกไป → `08fcf3e`

## ขั้น 1: Tracer ฝั่งเขียน · `POST /reports` ที่ body ถูกต้องได้ `201`

> test ผ่านแล้ว ยังไม่ commit

- [x] Test RPT-REQ-001: ได้ `201` มี `notice` มีครบ 9 ช่อง `id` เป็น UUID v4 · เวลาเป็น `19:30` / `19:30` / `22:30 +07:00` · `severity` = `"moderate"`
- [x] Test: ไม่มี store ได้ `500 reports not configured`
- [x] Test RPT-REQ-007: ความลึก 1 / 19 / 20 / 49 / 50 / 200
- [x] Test RPT-REQ-015 (ส่วนแรก): `vi.spyOn` ดัก `console.*` ทั้งไฟล์ · คำตอบไม่มี `203.0.113.7` และไม่มี `::/64`
- [x] `src/reports.ts` ใหม่: type · `severityOf` · `SEVERITY_*` · `REPORT_TTL_MS` · `parseReportInput` แบบบางที่สุด
- [x] `src/store.ts` ใหม่: `createMemoryStore` มีแค่ `add` กับ `inDistrict`
- [x] `src/app.ts`: เพิ่ม `reports?` ใน `Context` · route `POST /reports` · `reportJson` ดึงข้อมูลทีละช่อง
- [ ] commit

## ขั้น 2: Tracer ฝั่งอ่าน · `GET /districts/:id` เห็นรายงาน

- [ ] Test RPT-REQ-001 ส่วนท้าย: `POST` แล้ว `GET` ต้องเห็นรายงาน
- [ ] Test RPT-REQ-009:
  - เขตที่ไม่มีรายงานได้ `points` = `[]`
  - ไม่ส่ง `reports` ใน ctx ได้ `[]`
  - `stations` ต้อง `toEqual` กับตอนที่ยังไม่มีรายงาน
  - point ไม่มี `id` หรือ `landmarkKey`
- [ ] Test RPT-REQ-010: 2 แถวแรก ("Central Ladprao" ได้ 1 point · zero-width ได้ 1 point)
- [ ] `src/reports.ts`: `landmarkKey` (ครบ 4 ขั้น) · `pointKeyOf` · `groupReports` (กรองตาม RPT-REQ-011 · จัดกลุ่ม · latest ใช้ `observedAt` ตามด้วย `receivedAt`)
- [ ] `src/app.ts`: เพิ่ม `reports` ที่มี `verified: false`, `label` และ `points` · เวลาผ่าน `toBangkokIso` · ไม่ส่ง `receivedAt` ออก
- [ ] commit

## ขั้น 3: ต่อเข้า server จริง (จบขั้นนี้ tracer ครบทุกชั้น)

- [ ] `src/server.ts`: สร้าง `createMemoryStore()` หนึ่งตัวตอนเริ่ม server แล้วส่งไปใน `ctx`
- [ ] ตรวจด้วยมือ:
  - `npm run dev` แล้ว `curl -X POST localhost:3000/reports -d '{"districtId":"lat-phrao","landmark":"x","depthCm":30}'` ต้องได้ `"verified":false`
  - `curl localhost:3000/districts/lat-phrao` ต้องเห็น `"reportCount":1`
- [ ] commit

## ขั้น 4: ตรวจ body ทั้งก้อน เขต และความลึก

- [ ] Test RPT-REQ-002:
  - `"atlantis"` · `"LAT-PHRAO"` · `" lat-phrao"` · `42` · ไม่ส่งช่องนี้ → `400`
  - หลัง `400` แล้ว `GET` ได้ `points` = `[]`
- [ ] Test RPT-REQ-004:
  - 1 และ 200 → `201`
  - `0` · `-5` · `201` · `30.5` · `"30"` · `null` · `NaN` · ไม่ส่งช่องนี้ → `400`
- [ ] Test RPT-REQ-006:
  - `null` · `[]` · `"x"` · `5` · `undefined` → `fields` = `["body"]`
  - หลายช่องผิดต้องได้ครบและเรียงถูก
  - `phone` และ `verified` ถูกทิ้ง
  - `__proto__` จาก `JSON.parse` ไม่ทำให้ prototype เปลี่ยน
  - body ของ `400` ไม่มีค่าที่ผู้ใช้ส่งมา
- [ ] `src/reports.ts`: ดึงข้อมูลทีละช่อง · `DEPTH_MIN_CM` / `DEPTH_MAX_CM`
- [ ] commit

## ขั้น 5: ตรวจจุดสังเกต

- [ ] Test RPT-REQ-003:
  - ทุกค่าในรายการ รวม `"ab\n"` · `"\tab"` · zero-width
  - `"ก".repeat(100)` ผ่าน แต่ `101` ไม่ผ่าน
  - `"เซ็น".repeat(25)` ผ่าน แต่เติมอีก 1 ตัวไม่ผ่าน
  - ช่องว่างหัวท้ายถูกตัดออก
- [ ] Test RPT-REQ-010: NFC กับไม่ใช่ NFC ได้ 1 point · `"หน้า เซ็นทรัล"` ได้ 2 points
- [ ] `src/reports.ts`: NFC → ตรวจอักขระควบคุม**ก่อน** trim → ความยาวตาม code point → `landmarkKey` ต้องไม่ว่าง · `LANDMARK_MAX`
- [ ] commit

## ขั้น 6: `observedAt` เวลา และการหมดอายุ

- [ ] Test RPT-REQ-005: ทุกแถวของตาราง รวมกรณีตรงขอบพอดี และเกินขอบไป 1 วินาที
- [ ] Test RPT-REQ-008: `expiresAt` คำนวณจากค่าหลังตัด
- [ ] Test RPT-REQ-011:
  - ที่ +2:59:59 ยังเห็น แต่ที่ +3:00:00 ไม่เห็น
  - `GET` ก่อน `receivedAt` ไม่เห็น
  - รายงานหมดอายุไป 1 จาก 2 ได้ `reportCount` = `1`
- [ ] `src/reports.ts`:
  - ตรวจด้วย regex · ตรวจวันที่มีจริงด้วย `Date.UTC` · ตรวจช่วง offset · ตรวจช่วง −6 ชั่วโมง / +5 นาที
  - ตัดค่าด้วย `min(ค่าที่ส่งมา, now)`
  - `OBSERVED_MAX_PAST_MS` · `OBSERVED_MAX_FUTURE_MS`
- [ ] commit

## ขั้น 7: โควตาต่อ client key

- [ ] Test RPT-REQ-012:
  - ทุกแถวของตาราง
  - ส่ง 20 ครั้งที่ +5:00 แล้วยังได้ `201` ที่ +10:00
  - JSON เสีย และ `{}` ต้องถูกนับ
- [ ] Test RPT-REQ-013 (ส่วน `clientKeyOf`) ใน `tests/request.test.ts`: ตาราง 7 แถว
- [ ] Test RPT-REQ-015: คำตอบ `429` ไม่มี IP และไม่มี `::/64` · ใส่ `clientKey` ใน ctx ของ test
- [ ] `src/limiter.ts` ใหม่:
  - `hit` · `QUOTA_MAX` · `QUOTA_WINDOW_MS`
  - เก็บเวลาไม่เกิน 5 ค่าต่อ key
  - คำขอที่ได้ `429` ไม่ถูกนับ
- [ ] `src/request.ts` ใหม่: `clientKeyOf`
- [ ] `src/app.ts`:
  - เพิ่ม `limiter?` และ `clientKey?` ใน `Context`
  - `hit` **ก่อน**ตรวจ body
  - ไม่มี limiter ตอบ `500`
- [ ] `src/server.ts`: สร้าง limiter หนึ่งตัว · ส่ง `clientKeyOf(req)`
- [ ] commit

## ขั้น 8: จำกัดขนาด body และ `INVALID_JSON`

- [ ] Test RPT-REQ-014 ด้วย `Readable` ปลอม:
  - 10,240 ไบต์ผ่าน แต่ 10,241 ไบต์ไม่ผ่าน
  - 3 chunk: ต้องเรียก `pause` และไม่รับ chunk ที่ 3
  - `content-length: 20000`
  - `น` ที่ถูกตัดคร่อม chunk
  - `parseJsonBody` 3 ค่า
- [ ] Test RPT-REQ-017: JSON เสียที่ route อื่นได้ `400 invalid JSON`
- [ ] Test RPT-REQ-006: `INVALID_JSON` ที่ `POST /reports` ได้ `fields` = `["body"]`
- [ ] `src/request.ts`:
  - `readBody` (ใช้ `pause()` ห้าม `destroy()` · ใช้ `Buffer.concat` ก่อนแล้วค่อย decode)
  - `parseJsonBody` · `INVALID_JSON` · `BODY_LIMIT_BYTES`
- [ ] `src/server.ts`: ใช้ `readBody` · ตอบ `413` พร้อม `connection: close` · ส่ง `INVALID_JSON` ต่อให้ `handle()`
- [ ] `src/app.ts`: ถ้าได้ `INVALID_JSON` ที่ route อื่นตอบ `400 invalid JSON`
- [ ] ตรวจด้วยมือ: `head -c 20000 /dev/zero | curl -s -o /dev/null -w "%{http_code}" -X POST --data-binary @- localhost:3000/reports` ต้องพิมพ์ `413`
- [ ] commit

## Later (ไม่ทำคืนนี้)

- [ ] RPT-REQ-013 ส่วนแทนรายงานเดิม:
  - `limiter.previous` / `limiter.remember` · `store.remove`
  - ลำดับ 6–8 ของ `POST /reports`
  - test ตาราง 8 แถว
- [ ] RPT-REQ-016 เพดานหน่วยความจำ:
  - `MAX_ACTIVE_REPORTS`
  - `MAX_TRACKED_KEYS` แยกต่อ Map พร้อมลบ key ที่ใช้ล่าสุดนานที่สุด (LRU)
  - test 4 แถว
- [ ] RPT-REQ-010 ส่วนที่เหลือ:
  - เรียง points ให้ครบ 3 ชั้น
  - ถ้าเวลาเท่ากัน ใช้รายงานที่ถูก `add` ทีหลัง
  - แถวคนละเขต · แถว `[B, A]`
- [ ] RPT-REQ-015 ส่วนที่เหลือ: `Report` ต้องไม่มีช่อง PII
- [ ] RPT-REQ-017 ตรวจปิดงาน:
  - `grep -r rooptanjai src tests` ต้องว่าง
  - `git diff main -- package.json tests/app.test.ts tests/time.test.ts` ต้องว่าง
- [ ] รีวิวเทียบ `SEC-01`–`SEC-14` (checkpoint `cp7-review`)

## ความเสี่ยงและเรื่องที่ยังไม่แน่ใจ

1. **ขั้น 3–7 `POST` เปิดแต่ยังไม่จำกัดขนาด body:** intent บอกว่าต้องจำกัดก่อนเปิดรับ `POST`
   - ช่วงนี้ใช้แค่ `localhost` ห้ามเปิดให้เครื่องอื่นเข้า
   - ทางเลือก: ย้ายขั้น 8 ขึ้นมาไว้ต่อจากขั้น 3
2. **ก่อนขั้น 7 ยังไม่มี limiter:**
   - spec บอกว่าถ้าไม่มี limiter ต้องตอบ `500` แต่ขั้น 1–6 ตรวจแค่ store แล้วค่อยเติมในขั้น 7
   - test ที่เขียนในรอบนี้จะต้องเพิ่ม limiter เข้าไปทีหลัง (ไม่ใช่ test เดิม)
3. **ก่อนทำ "Later" คนเดิมส่งจุดเดิมซ้ำจะนับเป็น 2 รายงาน:** ยอมรับได้ เพราะยังไม่มีใครใช้ระบบจริง
4. **test ของ `readBody`:** ต้องปลอม stream ให้ตรวจ `pause()` ได้ และตรวจได้ว่าไม่รับ chunk ที่ 3 · จะรู้แน่ว่าทำยังไงตอนเขียนจริง
5. **`NaN` และ `__proto__`:**
   - `NaN` ต้องเรียก `handle()` ตรงๆ เพราะมาจาก JSON ไม่ได้
   - `__proto__` ต้องสร้าง body ด้วย `JSON.parse` ไม่ใช่ object literal
6. **Open questions ข้อ 1–3 ใน intent ยังไม่มีคนยืนยัน:** ใช้ค่าเริ่มต้นจาก spec และเขียนเป็น `export const` ที่เดียว
7. **ผลลบที่ถูกต้อง ไม่ใช่บั๊ก:**
   - `"หน้าเซ็นทรัล"` กับ `"หน้า เซ็นทรัล"` ได้ 2 points
   - ความลึก 0 ได้ `400`
   - คำตอบ `4xx` ไม่มี `notice`

## Verification

- จบแต่ละขั้น:
  - `npm test` ต้องผ่านทั้งหมด (test เดิม 8 ตัว + test ใหม่)
  - `npm run lint` ต้องจบด้วย exit 0
- จบขั้น 3 และขั้น 8 ให้ตรวจด้วยมือด้วย curl
  - ยิงแค่ `localhost` เท่านั้น ห้ามยิง `flood-api.rooptanjai.com` (`SEC-01`)
- ก่อนปิดงาน:
  - `git diff main --stat` ต้องมีแค่ไฟล์ในรายการปิดกับ `docs/plans/flood-reports.md`
  - `tests/app.test.ts` และ `tests/time.test.ts` ต้องไม่อยู่ใน diff
