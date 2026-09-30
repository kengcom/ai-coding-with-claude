# Spec: รายงานจุดน้ำท่วมจากคนในพื้นที่

> ที่มา: `docs/intent/flood-reports.md` · กฎความปลอดภัย: `.claude/skills/security-baseline/SKILL.md` (อ้างเป็น `SEC-xx`)
> สถานะ: ร่างที่ 2 วันที่ 30 ก.ย. 2569 แก้ตามรีวิว 22 ข้อ · ตัวอย่างเพื่อการเรียนเท่านั้น ไม่ใช่ระบบเตือนภัยทางการ

## ค่าคงที่

ค่าเหล่านี้เป็นค่าเริ่มต้น รอคนยืนยันตาม Open questions ข้อ 1–3 ใน intent ให้เขียนเป็น `export const` ในไฟล์ที่ใช้ค่านั้น ห้ามเขียนตัวเลขซ้ำไว้ที่อื่น

| ชื่อ | ค่า | อยู่ใน | ใช้ทำอะไร |
| ---- | --- | ------ | --------- |
| `LANDMARK_MAX` | 100 | `src/reports.ts` | ความยาวสูงสุดของจุดสังเกต หน่วยเป็น code point (`[...s].length`) |
| `DEPTH_MIN_CM` / `DEPTH_MAX_CM` | 1 / 200 | `src/reports.ts` | ช่วงความลึกที่รับ |
| `SEVERITY_MODERATE_CM` / `SEVERITY_SEVERE_CM` | 20 / 50 | `src/reports.ts` | เกณฑ์ระดับความรุนแรง |
| `OBSERVED_MAX_PAST_MS` | 6 ชั่วโมง | `src/reports.ts` | `observedAt` เก่าได้ไม่เกินนี้ |
| `OBSERVED_MAX_FUTURE_MS` | 5 นาที | `src/reports.ts` | `observedAt` ล้ำอนาคตได้ไม่เกินนี้ เผื่อนาฬิกาเครื่องคนส่งคลาด |
| `REPORT_TTL_MS` | 3 ชั่วโมง | `src/reports.ts` | อายุรายงาน นับจาก `observedAt` |
| `MAX_ACTIVE_REPORTS` | 10,000 | `src/store.ts` | เพดานจำนวนรายงานใน store |
| `QUOTA_MAX` / `QUOTA_WINDOW_MS` | 5 / 10 นาที | `src/limiter.ts` | โควตาต่อ client key |
| `MAX_TRACKED_KEYS` | 10,000 | `src/limiter.ts` | เพดานจำนวน key **ต่อ Map** ในตัวจำกัด (มี 2 Map) |
| `BODY_LIMIT_BYTES` | 10,240 | `src/request.ts` | ขนาด body สูงสุด นับเป็นไบต์ |

## คำศัพท์

- **client key**: IP ที่ปรับรูปแล้วด้วย `clientKeyOf` (RPT-REQ-013) ใช้แทน IP ในทุกจุดที่ต้องนับหรือจำคนส่ง
- **landmark key**: ค่าที่ได้จาก `landmarkKey()` (RPT-REQ-010) ใช้ตัดสินว่าสองรายงานเป็นจุดเดียวกันหรือไม่
- **point key**: `districtId + "\n" + landmark key` ใช้ `\n` คั่นได้เพราะ `\n` ไม่มีทางอยู่ในจุดสังเกต (RPT-REQ-003)
- **ตัวจำกัด**: `Limiter` ใน `src/limiter.ts` เป็นที่เดียวในระบบที่ถือ client key (`SEC-10`)

## Requirements

ใน acceptance criteria ถ้าไม่ได้บอกเป็นอย่างอื่น ให้ถือค่าตามนี้:
- `now` = `2026-09-30T12:30:00Z` (ค่าเดียวกับใน `tests/app.test.ts`)
- `clientKey` = `"203.0.113.7"`
- store และตัวจำกัดเริ่มว่างทุก test
- "body ถูกต้อง" หมายถึง `{ "districtId": "lat-phrao", "landmark": "หน้าเซ็นทรัลลาดพร้าว", "depthCm": 30 }`

test ของ RPT-REQ-001 ถึง 012 และ 015 ถึง 016 อยู่ใน `tests/reports.test.ts` ส่วน test ของ RPT-REQ-013 ถึง 014 อยู่ใน `tests/request.test.ts`

### RPT-REQ-001: ส่งรายงานได้

`POST /reports` ที่ body ถูกต้อง ต้องเก็บรายงานและตอบ `201`

- `status` = `201` และ body มี `notice` = `NOTICE` (`SEC-12`)
- `report` มีช่องครบตามนี้ ไม่มีช่องอื่น:
  - `id`: ตรงกับ `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/`
  - `districtId` = `"lat-phrao"`
  - `landmark` = `"หน้าเซ็นทรัลลาดพร้าว"`
  - `depthCm` = `30`
  - `severity` = `"moderate"`
  - `verified` = `false`
  - `observedAt` = `"2026-09-30T19:30:00+07:00"`
  - `receivedAt` = `"2026-09-30T19:30:00+07:00"`
  - `expiresAt` = `"2026-09-30T22:30:00+07:00"`
- หลัง `POST` แล้ว `GET /districts/lat-phrao` ต้องเห็นรายงานนี้ตาม RPT-REQ-009

### RPT-REQ-002: ตรวจเขต

`districtId` ต้องเป็น string ที่ตรงกับ key ใน `src/districts.ts` ทุกตัวอักษร (`SEC-03`)

- `"atlantis"` · `"LAT-PHRAO"` · `" lat-phrao"` · `42` · ไม่ส่งช่องนี้ ได้ `400` และ `fields` มี `"districtId"`
- ทุกกรณี `400` ใน RPT-REQ-002 ถึง RPT-REQ-006 ต้องไม่ถูกเก็บลง store (หลัง `POST` แล้ว `GET` ได้ `points` = `[]`)

### RPT-REQ-003: ตรวจจุดสังเกต

ตรวจ `landmark` ตามลำดับนี้ (`SEC-05`) ผิดขั้นไหน ได้ `400` ที่ช่อง `landmark`:

1. ต้องเป็น string
2. ปรับเป็น NFC
3. ถ้ามีอักขระที่ตรงกับ `/[\u0000-\u001F\u007F]/` ปฏิเสธ · **ตรวจก่อนตัดช่องว่าง**
4. ตัดช่องว่างหัวท้ายด้วย `String.prototype.trim()`
5. ความยาว `[...s].length` ต้องอยู่ใน 1–100
6. `landmarkKey(s)` ต้องไม่เป็น string ว่าง (กันข้อความที่มีแต่ zero-width)

ค่าที่เก็บและแสดงคือผลหลังขั้น 4

- `"  หน้าเซ็นทรัล  "` เก็บและตอบกลับเป็น `"หน้าเซ็นทรัล"`
- `""` · `"   "` · `"​"` · `"ab\ncd"` · `"ab\n"` · `"\tab"` · `"ab\u0000cd"` · `123` · ไม่ส่งช่องนี้ ได้ `400` และ `fields` มี `"landmark"`
- `"ก".repeat(100)` ได้ `201` แต่ `"ก".repeat(101)` ได้ `400`
- `"เซ็น".repeat(25)` ยาว 100 code point ได้ `201` แต่ `"เซ็น".repeat(25) + "ก"` ได้ `400`

### RPT-REQ-004: ตรวจความลึก

`depthCm` ต้องเป็น number ที่ `Number.isInteger` เป็นจริง และอยู่ในช่วง 1–200 ห้ามแปลงชนิดให้

- `1` และ `200` ได้ `201`
- `0` · `-5` · `201` · `30.5` · `"30"` · `null` · `NaN` · ไม่ส่งช่องนี้ ได้ `400` และ `fields` มี `"depthCm"` (`NaN` มาจาก JSON ไม่ได้ แต่ส่งเข้า `handle()` ตรงๆ ใน test ได้)

### RPT-REQ-005: ตรวจเวลาที่เห็น

`observedAt` ไม่บังคับ ถ้าไม่ส่ง ใช้ `now` ถ้าส่งมา ต้องผ่านทุกข้อต่อไปนี้:

1. เป็น string ที่ตรงกับ regex นี้ทุกตัวอักษร:
   `/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?(Z|[+-]\d{2}:\d{2})$/`
   - ต้องมีวินาที · เศษวินาทีใส่ได้ 0–3 หลัก
   - `Z` ต้องเป็นตัวใหญ่ · offset ต้องมี `:` คั่น
2. ส่วนประกอบของวันเวลาต้องมีจริง: เดือน 01–12 · วันต้องมีจริงในเดือนนั้น · ชั่วโมง 00–23 · นาที 00–59 · วินาที 00–59 · ตรวจวันที่โดยสร้างด้วย `Date.UTC` แล้วอ่านค่า UTC กลับมาให้ตรงกับที่ส่งมา
3. offset อยู่ในช่วง `-14:00` ถึง `+14:00` และนาทีของ offset อยู่ใน 00–59
4. เวลาที่ได้หลังหัก offset แล้ว ต้องอยู่ในช่วง `now − 6 ชั่วโมง` ถึง `now + 5 นาที` นับรวมขอบทั้งสองข้าง

ก่อนเก็บ ให้**ตัด**ค่าลงมาไม่ให้เกินเวลาที่ได้รับ: `observedAt = min(ค่าที่ส่งมา, now)` แล้วคำนวณ `expiresAt` จากค่าหลังตัด

| `observedAt` ที่ส่งมา | ผล | `observedAt` ที่ตอบกลับ |
| --------------------- | -- | ----------------------- |
| `"2026-09-30T19:00:00+07:00"` | `201` | `"2026-09-30T19:00:00+07:00"` · `expiresAt` = `"2026-09-30T22:00:00+07:00"` |
| `"2026-09-30T12:00:00Z"` | `201` | `"2026-09-30T19:00:00+07:00"` |
| `"2026-09-30T12:00:00.123Z"` | `201` | `"2026-09-30T19:00:00+07:00"` (`toBangkokIso` ตัดเศษวินาทีทิ้งตอนแสดง) |
| `"2026-10-01T02:00:00+14:00"` | `201` | `"2026-09-30T19:00:00+07:00"` |
| `"2026-09-30T06:30:00Z"` (6 ชั่วโมงพอดี) | `201` | `"2026-09-30T13:30:00+07:00"` |
| `"2026-09-30T06:29:59Z"` | `400` | - |
| `"2026-09-30T12:35:00Z"` (+5 นาทีพอดี) | `201` | `"2026-09-30T19:30:00+07:00"` (ถูกตัด) · `expiresAt` = `"2026-09-30T22:30:00+07:00"` |
| `"2026-09-30T12:35:01Z"` | `400` | - |
| `"2026-09-30T19:00:00"` · `"2026-09-30T19:00+07:00"` · `"2026-09-30T12:00:00z"` · `"2026-09-30T19:00:00+0700"` · `"2026-09-30T12:00:00.1234Z"` · `"2026-02-30T10:00:00Z"` · `"2026-09-30T24:00:00Z"` · `"2026-09-30T12:00:00+15:00"` · `"30/09/2026 19:00"` · `1759233600000` · `null` | `400` | - |

### RPT-REQ-006: body ทั้งก้อน

- body ต้องเป็น object ที่ไม่ใช่ `null` และไม่ใช่ array ถ้าเป็น `null` `[]` `"x"` `5` `undefined` หรือ JSON เสีย ได้ `400` และ `fields` = `["body"]`
- ดึงแค่ 4 ช่อง (`districtId` `landmark` `depthCm` `observedAt`) ทีละช่อง ห้ามใช้ `Object.assign` หรือ `{...body}` (`SEC-03`)
- ถ้ามีหลายช่องผิด `fields` ต้องมีทุกช่องที่ผิด เรียงตามลำดับ `districtId` `landmark` `depthCm` `observedAt`
- ช่องที่ไม่รู้จักถูกทิ้ง: body ถูกต้องที่มี `"phone": "0812345678", "verified": true, "isVerified": true` ได้ `201` แต่ `report` ไม่มี `phone` และ `verified` ยังเป็น `false` (`SEC-09`)
- body ที่ได้จาก `JSON.parse('{"districtId":"lat-phrao","landmark":"x","depthCm":30,"__proto__":{"verified":true}}')` ได้ `201` · `verified` = `false` · หลัง test แล้ว `({} as any).verified` ต้องเป็น `undefined`
- body ของ `400` มีรูปแบบ `{ "error": "invalid report", "fields": [...] }` เท่านั้น ห้ามมีค่าที่ผู้ใช้ส่งมาหรือ stack trace (`SEC-04`)

### RPT-REQ-007: ระดับความรุนแรง

`severityOf(depthCm)`:

| `depthCm` | 1 | 19 | 20 | 49 | 50 | 200 |
| --------- | - | -- | -- | -- | -- | --- |
| `severity` | `"minor"` | `"minor"` | `"moderate"` | `"moderate"` | `"severe"` | `"severe"` |

### RPT-REQ-008: เวลา

- ภายในระบบเก็บเวลาเป็น `Date` (UTC) ทุกคำตอบของ API แสดงเวลาผ่าน `toBangkokIso` จึงลงท้าย `+07:00` เสมอ
- `receivedAt` = `ctx.now`
- `expiresAt` = `observedAt` (หลังตัดแล้ว) + 3 ชั่วโมง
- โค้ดใน `src/` ห้ามเรียก `new Date()` แบบไม่ส่งค่าเข้าไป ยกเว้น 2 จุดที่มีอยู่แล้ว คือค่าเริ่มต้นของ `ctx` ใน `handle()` และใน `src/server.ts` · `new Date(ms)` และ `Date.UTC(...)` ใช้ได้

### RPT-REQ-009: แสดงรายงานในหน้าข้อมูลเขต

`GET /districts/:id` ต้องมี key `reports` เพิ่มจากของเดิม แยกจาก `stations` (`SEC-13`)

- body มี `reports.verified` = `false` และ `reports.label` = `"รายงานจากประชาชน ยังไม่ยืนยัน"`
- เขตที่ไม่มีรายงาน ได้ `reports.points` = `[]`
- `stations` ต้องเหมือนเดิมทุกตัวอักษร ไม่ว่าจะมีรายงานหรือไม่ ตรวจด้วย `toEqual` กับผลของ `GET` ตอนที่ยังไม่มีรายงาน
- ถ้าเรียก `handle()` โดยไม่ส่ง `reports` ใน `Context` (แบบ test เดิม) ได้ `reports.points` = `[]`
- แต่ละ point ใน API มีหน้าตา `{ landmark, reportCount, latest: { depthCm, severity, observedAt } }` และ `observedAt` เป็น `+07:00` · ไม่มี `landmarkKey` `id` หรือ client key

### RPT-REQ-010: จัดกลุ่มรายงานของจุดเดียวกัน

รายงานสองอันเป็น "จุดเดียวกัน" เมื่อ point key ตรงกัน

`landmarkKey(s)` รับค่าที่ผ่าน RPT-REQ-003 ขั้น 4 แล้ว และปรับตามลำดับนี้:

1. ลบ `/[​-‍﻿]/g`
2. แทน `/\s+/g` ด้วยช่องว่าง 1 ตัว
3. `trim()`
4. `toLowerCase()` (ไม่ใช้ `toLocaleLowerCase`)

ค่าที่แต่ละ point ต้องมี:
- **รายงานล่าสุด**: `observedAt` ใหม่สุด → ถ้าเท่ากัน ใช้ `receivedAt` ใหม่สุด → ถ้ายังเท่ากัน ใช้รายงานที่ถูก `add` ทีหลัง
- `landmark` = ข้อความของรายงานล่าสุด
- `reportCount` = จำนวนรายงานที่ยังแสดงอยู่ตาม RPT-REQ-011
- `latest` = `{ depthCm, severity, observedAt }` ของรายงานล่าสุด

ลำดับของ points: `latest.observedAt` ใหม่ไปเก่า → `latest.receivedAt` ใหม่ไปเก่า → landmark key เรียงแบบ `<` ของ string (ไม่ใช้ `localeCompare`)

ตัวอย่าง (แต่ละรายงานส่งจากคนละ client key):

| รายงานที่ส่ง | ผล |
| ------------ | -- |
| `"Central Ladprao"` depth 30, `observedAt` 12:00Z · `"  central   LADPRAO "` depth 45, `observedAt` 12:20Z | 1 point · `reportCount` = `2` · `latest.depthCm` = `45` · `landmark` = `"central   LADPRAO"` |
| `"หน้าเซ็นทรัล"` · `"หน้า​เซ็นทรัล"` | 1 point · `reportCount` = `2` |
| `"หน้าเซ็นทรัล"` · `"หน้า เซ็นทรัล"` | 2 points เพราะช่องว่างตรงกลางไม่ถูกลบ เป็นข้อจำกัดที่ยอมรับ ดู Out of scope |
| `"หน้าเซ็นทรัล"` ที่ `lat-phrao` · `"หน้าเซ็นทรัล"` ที่ `chatuchak` | อยู่คนละเขต แต่ละเขตมี 1 point |
| สระไทยแบบไม่ใช่ NFC กับแบบ NFC ของคำเดียวกัน | 1 point |
| A `observedAt` 12:00Z · B `observedAt` 12:10Z (คนละจุด) | points = `[B, A]` |

### RPT-REQ-011: รายงานหมดอายุ และการย้อนเวลา

รายงานแสดงเมื่อ `receivedAt ≤ now` **และ** `now < expiresAt`

- ส่งรายงานตอน `now` แล้ว `GET` ด้วย `now` + 2:59:59 ยังเห็น แต่ `GET` ด้วย `now` + 3:00:00 ไม่เห็น
- ใน point ที่มี 2 รายงาน ถ้าหมดอายุไป 1 รายงาน `reportCount` = `1` และ `latest` เปลี่ยนเป็นรายงานที่เหลือ ถ้าหมดอายุทั้งคู่ point หายไป
- `GET` ด้วย `now` ที่ก่อน `receivedAt` ไม่เห็นรายงานนั้น (สอดคล้องกับที่สถานีวัดไม่แสดงค่าหลัง `now`)

### RPT-REQ-012: จำกัดจำนวนรายงานต่อ client key

(`SEC-07`) กติกา:
- `POST /reports` ทุกครั้งเรียก `limiter.hit(clientKey, now)` **ก่อน**ตรวจ body
- คำขอที่ได้ `400` รวมถึง JSON เสีย ถูกนับ
- คำขอที่ได้ `429` **ไม่ถูกนับ** และไม่ต่อเวลาบล็อก
- `hit` นับเฉพาะคำขอที่ `เวลาของคำขอ > now − 10 นาที` และเก็บเวลาไว้ไม่เกิน 5 ค่าต่อ key
- ถ้าไม่มี client key ใช้ `"unknown"`

| กรณี | ผล |
| ---- | -- |
| ส่ง 5 ครั้งตอน `now` | `201` ทั้ง 5 ครั้ง |
| ครั้งที่ 6 ตอน `now` | `429` body = `{ "error": "too many reports" }` และไม่ถูกเก็บ |
| ส่ง 5 ครั้งตอน `now` แล้วส่ง 20 ครั้งตอน `now` + 5:00 จากนั้นส่งตอน `now` + 9:59 | ทุกครั้งหลัง 5 ครั้งแรกได้ `429` |
| ต่อจากแถวบน ส่งตอน `now` + 10:00 | `201` (การส่ง 20 ครั้งที่ได้ `429` ไม่ได้ต่อเวลา) |
| ส่ง body เป็น `INVALID_JSON` 5 ครั้ง แล้วส่ง body ถูกต้อง | `400` ทั้ง 5 ครั้ง ครั้งที่ 6 ได้ `429` |
| ส่ง `{}` 5 ครั้ง แล้วส่ง body ถูกต้อง | ครั้งที่ 6 ได้ `429` |
| key `"203.0.113.7"` ใช้โควตาหมดแล้ว | key `"198.51.100.1"` ยังได้ `201` |

### RPT-REQ-013: client key และ IP เดิมส่งจุดเดิมซ้ำ

**client key** มาจาก `clientKeyOf(req)` ใน `src/request.ts` (`SEC-08`):
- ใช้ `req.socket.remoteAddress` เท่านั้น ไม่อ่าน header ใดๆ
- ตัด zone id (`%...`) ออก
- ถ้าเป็น IPv4-mapped (`::ffff:a.b.c.d`) ให้ใช้ `a.b.c.d`
- ถ้าเป็น IPv6 ให้ขยายเป็น 8 กลุ่ม เก็บ 4 กลุ่มแรกแบบตัวเล็กและตัด 0 นำหน้า แล้วต่อด้วย `::/64`
- ถ้า `net.isIP()` ได้ 0 หรือไม่มีค่า ให้ใช้ `"unknown"`

| `remoteAddress` | header | client key |
| --------------- | ------ | ---------- |
| `"203.0.113.7"` | `x-forwarded-for: 198.51.100.1` | `"203.0.113.7"` |
| `"::ffff:203.0.113.7"` | - | `"203.0.113.7"` |
| `"2001:db8::1"` | - | `"2001:db8:0:0::/64"` |
| `"2001:0DB8:0000:0000:ffff::2"` | - | `"2001:db8:0:0::/64"` |
| `"fe80::1%eth0"` | - | `"fe80:0:0:0::/64"` |
| `undefined` · `"not-an-ip"` | - | `"unknown"` |

**แทนที่รายงานเดิม**: ถ้า client key เดียวกันส่ง point key เดียวกันซ้ำ ขณะที่รายงานเดิมยังไม่หมดอายุ ให้ลบรายงานเดิมออกจาก store แล้วเก็บรายงานใหม่ **รายงานที่ส่งทีหลังชนะเสมอ** แม้ `observedAt` จะเก่ากว่ารายงานเดิม · ตัวจำกัดเก็บ `clientKey + "\n" + pointKey → { reportId, expiresAt }` และหมดอายุพร้อมรายงานใหม่ · ตัวรายงานไม่มี client key (`SEC-10`)

| กรณี | ผล |
| ---- | -- |
| A ส่ง `"หน้าเซ็นทรัล"` depth 30 แล้วส่งซ้ำ depth 60 | `reportCount` = `1` · `latest.depthCm` = `60` |
| A ส่ง depth 30 `observedAt` 12:20Z แล้วส่งซ้ำ depth 10 `observedAt` 12:00Z | `reportCount` = `1` · `latest.depthCm` = `10` · หมดอายุตอน 15:00Z |
| A และ B ส่งจุดเดียวกัน | `reportCount` = `2` |
| `"::ffff:203.0.113.7"` และ `"203.0.113.7"` ส่งจุดเดียวกัน | `reportCount` = `1` |
| `"2001:db8::1"` และ `"2001:db8::2"` ส่งจุดเดียวกัน | `reportCount` = `1` |
| A ส่งจุดเดียวกันแต่คนละเขต | 2 points แต่ละ point `reportCount` = `1` |
| A ส่งซ้ำหลังรายงานเดิมหมดอายุ | ได้รายงานใหม่ตามปกติ `reportCount` = `1` |
| A ส่งซ้ำ | แต่ละครั้งใช้โควตาตาม RPT-REQ-012 |

### RPT-REQ-014: อ่าน body แบบจำกัดขนาด

`readBody(req)` ใน `src/request.ts` (`SEC-06`):
- ถ้า header `content-length` มากกว่า 10,240 คืน `{ kind: "too-large" }` ทันทีโดยไม่อ่านข้อมูล
- ถ้าไม่มี header ให้อ่านทีละ chunk เป็น `Buffer` และนับไบต์ ถ้ารวมเกิน 10,240 เมื่อไหร่ ให้ถอดตัวรับ `data` ออก เรียก `req.pause()` แล้วคืน `{ kind: "too-large" }` · **ห้าม** `req.destroy()` เพราะ client จะไม่ได้รับคำตอบ `413`
- ถ้าไม่เกิน ให้ `Buffer.concat` ครบก่อน แล้วค่อย decode เป็น UTF-8 คืน `{ kind: "ok", text }`

`parseJsonBody(text)`: ถ้าข้อความว่าง คืน `undefined` · ถ้า `JSON.parse` สำเร็จ คืนผลที่ได้ · ถ้าล้มเหลว คืน `INVALID_JSON` (symbol ที่ export จาก `src/request.ts`)

`src/server.ts`:
- ถ้าได้ `too-large` ไม่ว่า path หรือ method ไหน ให้ตอบ `413` `{ "error": "payload too large" }` พร้อม header `connection: close` และไม่เรียก `handle()` · Node จะปิด socket เองหลังส่งคำตอบ
- ถ้า JSON เสีย ให้ส่ง `INVALID_JSON` ต่อไปให้ `handle()` ตามปกติ

| กรณี | ผล |
| ---- | -- |
| ข้อมูล 10,240 ไบต์พอดี (ไม่มี `content-length`) | `ok` · ความยาวของ `text` เป็นไบต์ = 10,240 |
| ข้อมูล 10,241 ไบต์ | `too-large` |
| ส่ง 3 chunk chunk ละ 6,000 ไบต์ | `too-large` · stream ถูกเรียก `pause()` · ตัวรับ `data` ไม่ถูกเรียกกับ chunk ที่ 3 |
| header `content-length: 20000` และยังไม่มีข้อมูลส่งมาเลย | คืน `too-large` ทันที |
| `"หน้าเซ็นทรัล"` แบบ UTF-8 ที่ถูกตัดเป็น 2 chunk ตรงกลางตัวอักษร `น` | `text` = `"หน้าเซ็นทรัล"` ทุกตัวอักษร |
| `parseJsonBody("")` · `parseJsonBody("{bad")` · `parseJsonBody("[1]")` | `undefined` · `INVALID_JSON` · `[1]` |

ตรวจด้วยมือหลัง `npm run dev` (ใช้ Git Bash):
`head -c 20000 /dev/zero | curl -s -o /dev/null -w "%{http_code}" -X POST --data-binary @- localhost:3000/reports` ต้องพิมพ์ `413`

### RPT-REQ-015: ข้อมูลส่วนบุคคล

(`SEC-09` `SEC-10` `SEC-11`)
- ใช้ `vi.spyOn` ดักไว้ทั้งไฟล์ `tests/reports.test.ts` เพื่อตรวจว่า `console.log` `console.info` `console.warn` และ `console.error` ไม่ถูกเรียกเลย
- `JSON.stringify` ของทุกคำตอบใน `tests/reports.test.ts` (`201` `400` `429` `500` และ `GET`) ต้องไม่มีข้อความ `203.0.113.7` และไม่มี `::/64`
- type `Report` ไม่มีช่องเก็บ client key IP ชื่อ เบอร์โทร อีเมล หรือพิกัด

### RPT-REQ-016: หน่วยความจำมีเพดาน

(`SEC-07`)
- **store**: ทุกครั้งที่ `add(report, now)` ให้ลบรายงานที่ `expiresAt ≤ now` ออกก่อน ถ้ายังมีครบ `maxReports` ให้ลบรายงานที่ `receivedAt` เก่าสุด ถ้าเท่ากัน ลบตัวที่ถูก `add` ก่อน
- **ตัวจำกัด**: มี 2 Map แต่ละ Map มีเพดาน `maxKeys` แยกกัน ได้แก่
  - โควตา: client key → เวลาของคำขอ
  - รายงานซ้ำ: client key + point key → reportId
  ก่อนเพิ่ม key ใหม่ ให้ลบ key ที่หมดเวลาแล้วออกก่อน ถ้ายังเต็ม ให้ลบ key ที่ใช้ล่าสุดนานที่สุด (ทุกครั้งที่ใช้ key ให้ลบแล้วใส่กลับเข้า Map เพื่อย้ายไปไว้ท้ายสุด)

| test | ผล |
| ---- | -- |
| `createMemoryStore({ maxReports: 3 })` แล้ว `add` 4 รายงานในเขตเดียวกัน คนละ `receivedAt` | `inDistrict` คืน 3 รายงาน และรายงานแรกหายไป |
| `add` รายงานที่หมดอายุแล้ว 1 รายงาน แล้ว `add` รายงานใหม่ | `inDistrict` คืนแค่รายงานใหม่ |
| `createLimiter({ maxKeys: 3 })` แล้ว key `k1` `hit` 5 ครั้ง ต่อด้วย `k2` `k3` `k4` `hit` คนละ 1 ครั้ง (เวลาเดียวกันทั้งหมด) | `hit("k1")` ครั้งถัดไปได้ `true` (k1 ถูกลบเพราะใช้ล่าสุดนานที่สุด) |
| `createLimiter({ maxKeys: 3 })` แล้ว `remember` 4 point key | `previous` ของ point key แรกได้ `undefined` |

### RPT-REQ-017: ของเดิมไม่พัง

- `tests/app.test.ts` และ `tests/time.test.ts` ผ่านโดยไม่แก้แม้แต่บรรทัดเดียว
- `npm test` และ `npm run lint` จบด้วย exit code 0
- `package.json` ไม่มี dependency ใหม่ ใช้ได้แค่ `node:crypto` และ `node:net` ที่มากับ Node (`SEC-02`)
- `grep -r rooptanjai src tests` ไม่มีผลลัพธ์ (`SEC-01`)
- ถ้า body เป็น `INVALID_JSON` แต่ route ไม่ใช่ `POST /reports` ได้ `400` `{ "error": "invalid JSON" }` เหมือนที่ `src/server.ts` ตอบอยู่ตอนนี้

## Design

### Data model

```ts
// src/reports.ts
export type Severity = "minor" | "moderate" | "severe"

export type Report = {
  id: string            // randomUUID() จาก node:crypto
  districtId: string
  landmark: string      // หลัง RPT-REQ-003 ขั้น 4 ใช้แสดงผล
  pointKey: string      // districtId + "\n" + landmarkKey(landmark) ไม่ส่งออกใน API
  depthCm: number
  observedAt: Date      // ตัดแล้ว ไม่เกิน receivedAt
  receivedAt: Date
  expiresAt: Date
}
// ไม่มีช่อง ip, clientKey, phone, name, lat, lng — ตั้งใจ (SEC-09 SEC-10)

export type ReportInput = { districtId: string; landmark: string; depthCm: number; observedAt: Date } // observedAt ตัดแล้ว

export type ReportPoint = {
  landmark: string
  reportCount: number
  latest: { depthCm: number; severity: Severity; observedAt: Date; receivedAt: Date }
} // เวลายังเป็น Date app.ts เป็นคนแปลงด้วย toBangkokIso และไม่ส่ง receivedAt ออก

export function parseReportInput(body: unknown, now: Date):
  | { ok: true; value: ReportInput }
  | { ok: false; fields: string[] }
export function severityOf(depthCm: number): Severity
export function landmarkKey(landmark: string): string
export function pointKeyOf(districtId: string, landmark: string): string
export function groupReports(reports: Report[], now: Date): ReportPoint[]  // กรองตาม RPT-REQ-011 แล้วเรียงตาม RPT-REQ-010
```

```ts
// src/store.ts
export interface ReportStore {
  add(report: Report, now: Date): void
  remove(id: string): void
  inDistrict(districtId: string): Report[]   // คืนทุกรายงานที่ยังอยู่ใน store groupReports เป็นคนกรองเวลา
}
export function createMemoryStore(opts?: { maxReports?: number }): ReportStore
```

```ts
// src/limiter.ts — ที่เดียวที่ถือ client key
export interface Limiter {
  hit(clientKey: string, now: Date): boolean   // true = รับ และนับ · false = เกินโควตา ไม่นับ
  previous(clientKey: string, pointKey: string, now: Date): string | undefined
  remember(clientKey: string, pointKey: string, reportId: string, expiresAt: Date, now: Date): void
}
export function createLimiter(opts?: { maxKeys?: number }): Limiter
```

```ts
// src/request.ts — ส่วนที่แตะ node:http ซึ่งแยกออกมาให้ test ได้
export const INVALID_JSON: unique symbol
export function readBody(req: Readable & { headers: IncomingHttpHeaders }): Promise<{ kind: "ok"; text: string } | { kind: "too-large" }>
export function parseJsonBody(text: string): unknown   // คืน INVALID_JSON ถ้า JSON เสีย
export function clientKeyOf(req: { socket: { remoteAddress?: string } }): string
```

### Context

```ts
// src/app.ts
export type Context = {
  now: Date
  reports?: ReportStore
  limiter?: Limiter
  clientKey?: string    // มาจาก clientKeyOf(req) เท่านั้น
}
```

ช่องใหม่ทั้งหมดไม่บังคับ test เดิมที่ส่งแค่ `{ now }` จึงยังผ่าน

### API

| Method | Path | เปลี่ยนอะไร |
| ------ | ---- | ----------- |
| `POST` | `/reports` | **ใหม่** |
| `GET` | `/districts/:id` | เพิ่ม key `reports` ส่วน key เดิมคงเดิม |
| `GET` | `/districts` | ไม่เปลี่ยน |
| ทุก route | - | body เกิน 10 KB ได้ `413` จาก server |

**`POST /reports`**: ลำดับการทำงานใน `handle()`
1. ถ้าไม่มี `ctx.reports` หรือ `ctx.limiter` ตอบ `500` `{ "error": "reports not configured" }`
2. `limiter.hit(ctx.clientKey ?? "unknown", now)` ได้ `false` ตอบ `429`
3. ถ้า body เป็น `INVALID_JSON` ตอบ `400` `fields: ["body"]`
4. `parseReportInput` ไม่ผ่าน ตอบ `400`
5. สร้าง `Report`
6. `limiter.previous(...)` ถ้าได้ id กลับมา ให้ `store.remove(id)`
7. `store.add(report, now)`
8. `limiter.remember(..., report.expiresAt, now)`
9. ตอบ `201`

| Status | Body |
| ------ | ---- |
| `201` | `{ notice, report: { id, districtId, landmark, depthCm, severity, verified: false, observedAt, receivedAt, expiresAt } }` |
| `400` | `{ error: "invalid report", fields: [...] }` |
| `413` | `{ error: "payload too large" }` ตอบจาก server |
| `429` | `{ error: "too many reports" }` |
| `500` | `{ error: "reports not configured" }` ไม่ควรเกิดตอนรันจริง |

`/reports` ด้วย method อื่น หรือ `/reports/` ที่มี `/` ท้าย ได้ `404` ตาม route เดิม · คำตอบ `4xx` และ `5xx` ไม่มี `NOTICE` (`SEC-12` และ intent ฉบับแก้)

**`GET /districts/:id`**
```json
{
  "notice": "…",
  "district": { "…": "เหมือนเดิม" },
  "stations": [ "…เหมือนเดิม…" ],
  "reports": {
    "verified": false,
    "label": "รายงานจากประชาชน ยังไม่ยืนยัน",
    "points": [
      { "landmark": "central   LADPRAO", "reportCount": 2,
        "latest": { "depthCm": 45, "severity": "moderate", "observedAt": "2026-09-30T19:20:00+07:00" } }
    ]
  }
}
```

### ไฟล์ที่แตะได้ (รายการปิด)

| ไฟล์ | แก้ยังไง |
| ---- | -------- |
| `src/reports.ts` | **ใหม่** มี type ค่าคงที่ `parseReportInput` `severityOf` `landmarkKey` `pointKeyOf` `groupReports` |
| `src/store.ts` | **ใหม่** มี `ReportStore` `createMemoryStore` `MAX_ACTIVE_REPORTS` |
| `src/limiter.ts` | **ใหม่** มี `Limiter` `createLimiter` และค่าโควตา |
| `src/request.ts` | **ใหม่** มี `readBody` `parseJsonBody` `INVALID_JSON` `clientKeyOf` `BODY_LIMIT_BYTES` |
| `src/app.ts` | ขยาย `Context` · เพิ่ม `POST /reports` · เพิ่ม `reports` ใน `GET /districts/:id` · ถ้าได้ `INVALID_JSON` ที่ route อื่นให้ตอบ `400 invalid JSON` |
| `src/server.ts` | ใช้ `src/request.ts` แทนโค้ดอ่าน body เดิม · สร้าง store และตัวจำกัดตัวละหนึ่งตอนเริ่ม server · ส่ง `clientKey` · ไม่เพิ่ม log ต่อคำขอ |
| `tests/reports.test.ts` | **ใหม่** RPT-REQ-001 ถึง 012 และ 015 ถึง 016 |
| `tests/request.test.ts` | **ใหม่** RPT-REQ-013 ส่วน `clientKeyOf` และ RPT-REQ-014 |

### ไฟล์ที่ตั้งใจไม่แก้

| ไฟล์ | เหตุผล |
| ---- | ------ |
| `data/stations.json` | เป็นข้อมูลสถานีวัด รายงานจากประชาชนห้ามปน (`SEC-13`) |
| `src/districts.ts` | รายชื่อ 12 เขตคงเดิม |
| `src/stations.ts` · `src/time.ts` | ใช้ของเดิมตามที่มีอยู่ |
| `tests/app.test.ts` · `tests/time.test.ts` | test เดิมห้ามแก้ให้ผ่าน |
| `package.json` · `package-lock.json` | ไม่เพิ่ม dependency (`SEC-02`) |
| `README.md` | ยังไม่ต้องเขียนเอกสาร API ในรอบนี้ |

## Edge cases

| # | กรณี | ผลที่ต้องได้ | อยู่ใน |
| - | ---- | ------------ | ------ |
| 1 | `observedAt` ไม่มีเขตเวลา | `400` ระบบไม่เดาว่าเป็นเวลาไทยหรือ UTC | 005 |
| 2 | `"2026-02-30T10:00:00Z"` (`Date` ของ JS จะเลื่อนเป็น 2 มี.ค. เอง) | `400` | 005 |
| 3 | `observedAt` ตรงขอบพอดี และเกินขอบไป 1 วินาที | ตรงขอบรับ เกิน 1 วินาทีปฏิเสธ | 005 |
| 4 | `observedAt` ล้ำอนาคต +5 นาที | รับ แต่ตัดลงเป็น `now` จึงใช้เวลาอนาคตแย่งเป็นรายงานล่าสุดไม่ได้ | 005 · 010 |
| 5 | อยู่ตอน `expiresAt` พอดี | หมดอายุแล้ว | 011 |
| 6 | `depthCm` เป็น `"30"` `30.5` หรือ `0` | `400` ไม่แปลงชนิดให้ | 004 |
| 7 | จุดสังเกตลงท้ายด้วย `\n` หรือขึ้นต้นด้วย `\t` | `400` เพราะตรวจก่อนตัดช่องว่าง | 003 |
| 8 | จุดสังเกตมีแต่ zero-width space | `400` | 003 |
| 9 | สระไทยประกอบคนละลำดับ หรือมี zero-width แทรก | ได้ key เดียวกัน | 010 |
| 10 | `verified: true` หรือ `__proto__` ใน body | ถูกทิ้ง prototype ไม่เปลี่ยน | 006 |
| 11 | คนเดิมส่งจุดเดิมหลายครั้ง ด้วย `observedAt` ย้อนหลัง | รายงานที่ส่งทีหลังชนะ นับเป็น 1 | 013 |
| 12 | ส่ง JSON เสียหรือ body ผิดรัวๆ | นับโควตา ได้ `429` ในครั้งที่ 6 | 012 |
| 13 | ยิงไม่หยุดหลังจากโดน `429` | ไม่ต่อเวลาบล็อก หน่วยความจำต่อ key ไม่เกิน 5 ค่า | 012 |
| 14 | ปลอม `X-Forwarded-For` | ไม่มีผล | 013 |
| 15 | เปลี่ยน IPv6 ภายในช่วง /64 หรือสลับ IPv4 กับรูป IPv4-mapped | นับเป็น key เดียว | 013 |
| 16 | body 10 MB หรือ `content-length` ใหญ่เกิน | `413` ไม่เรียก `handle()` | 014 |
| 17 | ตัวอักษรไทยถูกตัดคร่อมรอยต่อระหว่าง chunk | ได้ข้อความถูกต้อง | 014 |
| 18 | IP จำนวนมากทำให้หน่วยความจำเต็ม | ลบ key หรือรายงานเก่าสุดตามเพดาน | 016 |
| 19 | `GET` ด้วย `now` ที่ย้อนไปก่อน `receivedAt` | ไม่เห็นรายงานนั้น | 011 |

## Out of scope

- เก็บรายงานถาวร (SQLite หรือไฟล์) รีสตาร์ต server แล้วรายงานหาย
- ผู้ดูแล ล็อกอิน การซ่อนหรือลบรายงาน · `DELETE /reports/:id`
- รายงานว่า "น้ำลดแล้ว" (ความลึก 0)
- จับคู่จุดสังเกตแบบคลุมเครือ เช่น `"หน้าเซ็นทรัล"` กับ `"หน้า เซ็นทรัล"` หรือให้เลือกจากรายการจุดสังเกตที่มีอยู่แล้ว
- พิกัด lat/lng และแผนที่
- `GET /reports` แบบรวมทุกเขต และจำนวนรายงานใน `GET /districts`
- หน้าจอและปุ่มช่วยเลือกความลึก (intent ฉบับแก้: รอบแรกทำแค่ API)
- header `Retry-After` ของ `429` และการตรวจ `Content-Type`
- เชื่อ proxy และ `X-Forwarded-For`
- กันคนที่มี IPv4 หลายตัว หรือมี IPv6 หลายช่วง /64
- log ต่อคำขอ ถ้าจะเพิ่มทีหลัง ตามกฎ `SEC-11` log ได้แค่ method, path, status และเวลาที่ใช้
- เชื่อมหรือส่งข้อมูลไปยัง ROOP TAN JAI Flood Watch (`SEC-01`)
- ตัววัดจากการใช้งานจริง
