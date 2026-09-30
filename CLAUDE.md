# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## โปรเจกต์นี้คืออะไร

**น้ำท่วมไหม** เป็น repo ตัวอย่างของคอร์ส AI Coding with Claude (CodePassion Academy) — API เล็กๆ ที่แสดงเขตในกรุงเทพฯ และระดับน้ำจากสถานีวัด **ข้อมูลเป็นข้อมูลสมมติ ไม่ใช่ระบบเตือนภัยทางการ**
งานที่กำลังทำบน branch นี้: ให้คนในพื้นที่รายงานจุดน้ำท่วม (`POST /reports`)

## คำสั่ง

ต้องใช้ Node.js 22 ขึ้นไป

```bash
npm install
npm test                                   # vitest run ทั้งหมด
npx vitest run tests/time.test.ts          # รันไฟล์เดียว
npx vitest run -t "rolls over"             # รันเฉพาะ test ที่ชื่อตรง
npm run lint                               # tsc --noEmit (เช็ก type อย่างเดียว ไม่มี build)
npm run dev                                # tsx watch, http://localhost:3000 (เปลี่ยนด้วย PORT)
```

ไม่มีขั้น build — รัน `.ts` ตรงด้วย `tsx` และ import กันด้วยนามสกุล `.ts` (`allowImportingTsExtensions`, ESM `NodeNext`)

## โครงสร้าง

- `src/app.ts` — `handle(method, path, body, ctx)` คืน `{ status, body }` เป็นที่เดียวที่ทำ routing และ**ไม่ผูกกับ `node:http`** test เรียก `handle()` ตรงๆ ไม่ต้องเปิด server
- `src/server.ts` — ชั้นบางๆ ของ `node:http`: อ่าน body → `JSON.parse` → เรียก `handle()` → เขียนคำตอบ ตรรกะทั้งหมดต้องอยู่ใน `handle()` ไม่ใช่ที่นี่
- `Context` ส่ง `now` เข้ามา **เวลาทั้งหมดใน logic ต้องมาจาก `ctx.now` ห้ามเรียก `new Date()`** (test ใช้ `now` ตายตัว เช่น `2026-09-30T12:30:00Z`)
- `src/stations.ts` โหลด `data/stations.json` ตอน import · `latestReading()` ไม่นับค่าที่อยู่หลัง `now`
- เวลาเก็บเป็น UTC แสดงผลผ่าน `toBangkokIso()` ใน `src/time.ts` (+07:00)
- ความลึกและระดับน้ำเป็น**จำนวนเต็มหน่วยเซนติเมตร**
- คำตอบ `2xx` ทุกตัวต้องมี `notice: NOTICE` คำตอบ error ไม่ต้องมี

## เอกสารที่ต้องอ่านก่อนทำฟีเจอร์รายงานน้ำท่วม

- `docs/intent/flood-reports.md` — ทำไม ตัดสินอะไรไปแล้ว ข้อห้าม และ Open questions
- `docs/specs/flood-reports.md` — requirement `RPT-REQ-001`–`017` ค่าคงที่ (ต้อง `export const` ในไฟล์ที่ระบุไว้ ห้ามเขียนตัวเลขซ้ำที่อื่น) ลำดับการทำงานของ `POST /reports` และ**รายการไฟล์ที่แตะได้แบบปิด** กับไฟล์ที่ตั้งใจไม่แก้
- `.claude/skills/security-baseline/SKILL.md` — กฎ `SEC-01`–`SEC-14` อ้างด้วยรหัส ถ้าทำตามข้อไหนไม่ได้ต้องเขียนเหตุผลลง spec แล้วถามก่อน

## ข้อห้ามที่พลาดง่าย

- **ห้ามส่ง POST/PUT/PATCH/DELETE ไปที่ระบบรายงานน้ำท่วมจริง** เช่น `flood-api.rooptanjai.com` ทั้งในโค้ด test และสคริปต์ — คนใช้แผนที่นั้นตัดสินใจจริงช่วงน้ำท่วม อ่าน (GET) ได้อย่างเดียว (`SEC-01`)
- ห้ามแก้ test เดิม (`tests/app.test.ts` `tests/time.test.ts`) ให้ผ่าน · พฤติกรรมเดิมของ `GET /districts` และ `GET /districts/:id` ต้องคงเดิม เพิ่มได้แค่ key `reports`
- ห้ามแก้ `data/stations.json` และห้ามปนรายงานจากประชาชนกับข้อมูลสถานี (`SEC-13`) · รายชื่อ 12 เขตใน `src/districts.ts` คงเดิม
- ห้ามเพิ่ม dependency ที่ใช้ตอนรัน ใช้แค่สิ่งที่มากับ Node 22 (`SEC-02`)
- IP ใช้ได้แค่ในตัวจำกัดจำนวนคำขอในหน่วยความจำ ห้ามลงข้อมูลหลัก API log หรือข้อความ error (`SEC-10`) · log มีได้แค่ method, path, status, เวลาที่ใช้ (`SEC-11`)

## อื่นๆ

- `.agents/` `.aider-desk/` และ `skills-lock.json` เป็นชุดสกิลของเครื่องมือ AI อื่นที่ติดตั้งไว้ ไม่ใช่โค้ดของแอป
- Branch อ้างอิง: `main` จุดเริ่มคลาส · `class-demo` ผลลัพธ์ครบ มี tag `cp1-intent` ถึง `cp8-hooks` ไว้เทียบ (ดูตารางใน `README.md`)
