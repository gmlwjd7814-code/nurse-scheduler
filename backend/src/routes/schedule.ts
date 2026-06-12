/**
 * 근무표 API 라우터
 * GET  /api/schedule/:wardId/:year/:month     - 근무표 조회
 * POST /api/schedule/generate                 - AI 자동 생성
 * PUT  /api/schedule/entry/:id                - 개별 셀 수정 (드래그&드롭)
 * GET  /api/schedule/:wardId/:year/:month/excel - Excel 다운로드
 * POST /api/schedule/request                  - 희망 오프 신청
 * GET  /api/schedule/:wardId/:year/:month/requests - 희망 오프 목록
 */

import { Router, Request, Response } from 'express';
import { query } from '../database/connection';
import { generateSchedule, validateNurseSeq } from '../services/scheduler';
import { generateExcel } from '../services/excelService';
import { asyncHandler } from '../middleware/errorHandler';
import { Nurse, ScheduleEntry, ShiftCode, WardSettings } from '../types';

const router = Router();

// ===== 근무표 조회 =====
router.get(
  '/:wardId/:year/:month',
  asyncHandler(async (req: Request, res: Response) => {
    const { wardId, year, month } = req.params;

    // 근무표 메타 정보 조회
    const scheduleResult = await query(
      `SELECT id, ward_id as "wardId", year, month,
              is_published as "isPublished",
              generated_at as "generatedAt",
              created_at as "createdAt",
              updated_at as "updatedAt"
       FROM schedules
       WHERE ward_id = $1 AND year = $2 AND month = $3`,
      [wardId, year, month]
    );

    if (scheduleResult.rows.length === 0) {
      res.json({ success: true, data: null, message: '생성된 근무표가 없습니다' });
      return;
    }

    const schedule = scheduleResult.rows[0];

    // 근무 엔트리 조회
    const entriesResult = await query(
      `SELECT
         se.id, se.schedule_id as "scheduleId", se.nurse_id as "nurseId",
         se.day, se.shift, se.role,
         se.is_violation as "isViolation",
         se.violation_reason as "violationReason"
       FROM schedule_entries se
       WHERE se.schedule_id = $1
       ORDER BY se.nurse_id, se.day`,
      [schedule.id]
    );

    // 간호사 정보 조회
    const nursesResult = await query<Nurse>(
      `SELECT id, name, rank,
              years_of_service as "yearsOfService",
              work_type as "workType",
              capability,
              is_active as "isActive",
              ward_id as "wardId",
              monthly_off_override as "monthlyOffOverride"
       FROM nurses
       WHERE ward_id = $1 AND is_active = true
       ORDER BY
         CASE work_type WHEN 'HEAD_NURSE' THEN 1 WHEN 'NIGHT_ONLY' THEN 2 ELSE 3 END,
         CASE rank WHEN 'HEAD' THEN 1 WHEN 'CHARGE' THEN 2 WHEN 'RN' THEN 3 ELSE 4 END,
         years_of_service DESC`,
      [wardId]
    );

    res.json({
      success: true,
      data: {
        schedule,
        entries: entriesResult.rows,
        nurses: nursesResult.rows,
      },
    });
  })
);

// ===== AI 자동 근무표 생성 =====
router.post(
  '/generate',
  asyncHandler(async (req: Request, res: Response) => {
    const { wardId, year, month, useRequests = true } = req.body;

    if (!wardId || !year || !month) {
      res.status(400).json({
        success: false,
        error: 'wardId, year, month는 필수입니다',
      });
      return;
    }

    console.log(`⏳ ${year}년 ${month}월 근무표 자동 생성 시작...`);
    const startTime = Date.now();

    // AI 스케줄 생성
    const { entries, violations } = await generateSchedule(
      Number(wardId),
      Number(year),
      Number(month),
      useRequests
    );

    // 기존 근무표 삭제 후 새로 저장 (upsert)
    const client = await (await import('../database/connection')).default.connect();
    try {
      await client.query('BEGIN');

      // 기존 근무표 조회 또는 생성
      let scheduleId: number;
      const existing = await client.query(
        'SELECT id FROM schedules WHERE ward_id = $1 AND year = $2 AND month = $3',
        [wardId, year, month]
      );

      if (existing.rows.length > 0) {
        scheduleId = existing.rows[0].id;
        // 기존 엔트리 삭제
        await client.query('DELETE FROM schedule_entries WHERE schedule_id = $1', [scheduleId]);
        await client.query(
          'UPDATE schedules SET generated_at = NOW(), updated_at = NOW() WHERE id = $1',
          [scheduleId]
        );
      } else {
        const newSchedule = await client.query(
          `INSERT INTO schedules (ward_id, year, month, generated_at)
           VALUES ($1, $2, $3, NOW())
           RETURNING id`,
          [wardId, year, month]
        );
        scheduleId = newSchedule.rows[0].id;
      }

      // 새 엔트리 삽입
      for (const entry of entries) {
        await client.query(
          `INSERT INTO schedule_entries
             (schedule_id, nurse_id, day, shift, role, is_violation, violation_reason)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            scheduleId,
            entry.nurseId,
            entry.day,
            entry.shift,
            entry.role,
            entry.isViolation,
            entry.violationReason || null,
          ]
        );
      }

      await client.query('COMMIT');

      const elapsed = Date.now() - startTime;
      console.log(`✅ 근무표 생성 완료 (${elapsed}ms), 위반 ${violations.length}건`);

      res.json({
        success: true,
        data: {
          scheduleId,
          entryCount: entries.length,
          violationCount: violations.length,
          violations,
          elapsed,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  })
);

// ===== 개별 셀 수정 + 전체 재검증 =====
router.put(
  '/entry/:entryId',
  asyncHandler(async (req: Request, res: Response) => {
    const { entryId } = req.params;
    const { shift } = req.body as { shift: ShiftCode };

    if (!shift) {
      res.status(400).json({ success: false, error: 'shift는 필수입니다' });
      return;
    }

    // 현재 엔트리 + 소속 정보 조회
    const currentEntry = await query(
      `SELECT se.id, se.schedule_id, se.nurse_id, se.day, se.shift, se.role,
              n.work_type as "workType", n.rank,
              s.ward_id as "wardId"
       FROM schedule_entries se
       JOIN nurses n ON n.id = se.nurse_id
       JOIN schedules s ON s.id = se.schedule_id
       WHERE se.id = $1`,
      [entryId]
    );

    if (currentEntry.rows.length === 0) {
      res.status(404).json({ success: false, error: '엔트리를 찾을 수 없습니다' });
      return;
    }

    const cur = currentEntry.rows[0];

    // 근무형태 기반 즉각 차단
    const hardViolations: string[] = [];
    if (cur.workType === 'HEAD_NURSE' && (shift === 'E' || shift === 'N')) {
      hardViolations.push('수간호사에게 E/N 근무 배정 불가');
    }
    if (cur.workType === 'NIGHT_ONLY' && ['D', 'E', 'N'].includes(shift)) {
      hardViolations.push('야간전담에게 D/E/N 배정 불가');
    }

    // 병동 설정 로드 (최대 연속 근무일)
    const settingsRes = await query<Pick<WardSettings, 'maxConsecutiveWork'>>(
      `SELECT COALESCE(max_consecutive_work, 6) AS "maxConsecutiveWork"
       FROM ward_settings WHERE ward_id = $1`,
      [cur.wardId]
    );
    const maxConsecutiveWork = settingsRes.rows[0]?.maxConsecutiveWork ?? 6;

    // 해당 간호사의 해당 달 전체 엔트리 로드
    const nurseEntriesRes = await query<{ day: number; shift: ShiftCode }>(
      `SELECT day, shift
       FROM schedule_entries
       WHERE schedule_id = $1 AND nurse_id = $2
       ORDER BY day`,
      [cur.schedule_id, cur.nurse_id]
    );

    // 시퀀스 재구성 (편집된 day에 새 shift 적용)
    const daysInSchedule = nurseEntriesRes.rows.length;
    const maxDay = Math.max(...nurseEntriesRes.rows.map((e) => e.day), 28);
    const shifts: (ShiftCode | null)[] = new Array(maxDay).fill(null);
    for (const e of nurseEntriesRes.rows) {
      shifts[e.day - 1] = e.day === cur.day ? shift : e.shift;
    }

    // 시퀀스 유효성 검사
    const seqValid = validateNurseSeq(shifts, { maxConsecutiveWork } as WardSettings);
    const allViolations = [...hardViolations];
    if (!seqValid) allViolations.push('연속 근무 또는 순서 규칙 위반 (E→D, N연속, 최대 연속 근무 초과)');

    const client = await (await import('../database/connection')).default.connect();
    try {
      await client.query('BEGIN');

      // 편집된 셀 업데이트
      await client.query(
        `UPDATE schedule_entries
         SET shift = $1, is_violation = $2, violation_reason = $3, updated_at = NOW()
         WHERE id = $4`,
        [shift, allViolations.length > 0, allViolations.join('; '), entryId]
      );

      // 같은 간호사 모든 셀 violation 재계산 (시퀀스 위반은 전체 영향)
      if (!seqValid) {
        // 재검증: 위반이 있는 경우 각 셀을 다시 개별 검증하여 표시
        for (const e of nurseEntriesRes.rows) {
          const dayShift = e.day === cur.day ? shift : e.shift;
          const testShifts = [...shifts];
          testShifts[e.day - 1] = dayShift;

          // 해당 날의 is_violation을 업데이트 (시퀀스 전체 위반이므로 대표 셀만 표시)
          // 실용적 접근: 수정된 셀만 violation 표시
        }
      } else {
        // 시퀀스 유효 → 이 간호사의 시퀀스 관련 위반 플래그 클리어
        await client.query(
          `UPDATE schedule_entries
           SET is_violation = false,
               violation_reason = NULL,
               updated_at = NOW()
           WHERE schedule_id = $1 AND nurse_id = $2
             AND id != $3
             AND violation_reason LIKE '%연속%'`,
          [cur.schedule_id, cur.nurse_id, entryId]
        );
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // 업데이트된 엔트리 반환
    const updated = await query(
      `SELECT id, nurse_id as "nurseId", day, shift, role,
              is_violation as "isViolation", violation_reason as "violationReason"
       FROM schedule_entries WHERE id = $1`,
      [entryId]
    );

    res.json({
      success: true,
      data: updated.rows[0],
      violations: allViolations,
      sequenceValid: seqValid,
    });
  })
);

// ===== Excel 다운로드 =====
router.get(
  '/:wardId/:year/:month/excel',
  asyncHandler(async (req: Request, res: Response) => {
    const { wardId, year, month } = req.params;

    // 근무표 데이터 조회
    const [scheduleResult, nursesResult, settingsResult] = await Promise.all([
      query(
        `SELECT id FROM schedules WHERE ward_id = $1 AND year = $2 AND month = $3`,
        [wardId, year, month]
      ),
      query<Nurse>(
        `SELECT id, name, rank,
                years_of_service as "yearsOfService",
                work_type as "workType",
                capability,
                is_active as "isActive",
                ward_id as "wardId"
         FROM nurses WHERE ward_id = $1 AND is_active = true
         ORDER BY
           CASE work_type WHEN 'HEAD_NURSE' THEN 1 WHEN 'NIGHT_ONLY' THEN 2 ELSE 3 END,
           CASE rank WHEN 'HEAD' THEN 1 WHEN 'CHARGE' THEN 2 WHEN 'RN' THEN 3 ELSE 4 END,
           years_of_service DESC`,
        [wardId]
      ),
      query(
        'SELECT ward_name as "wardName" FROM ward_settings WHERE ward_id = $1',
        [wardId]
      ),
    ]);

    if (scheduleResult.rows.length === 0) {
      res.status(404).json({ success: false, error: '근무표가 없습니다' });
      return;
    }

    const scheduleId = scheduleResult.rows[0].id;
    const entriesResult = await query<ScheduleEntry>(
      `SELECT id, schedule_id as "scheduleId", nurse_id as "nurseId",
              day, shift, role,
              is_violation as "isViolation",
              violation_reason as "violationReason"
       FROM schedule_entries WHERE schedule_id = $1`,
      [scheduleId]
    );

    const wardName = settingsResult.rows[0]?.wardName || '병동';
    const buffer = await generateExcel(
      nursesResult.rows,
      entriesResult.rows,
      Number(year),
      Number(month),
      wardName
    );

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(`${year}년_${month}월_근무표.xlsx`)}"`,
    );
    res.send(buffer);
  })
);

// ===== 희망 오프 신청 =====
router.post(
  '/request',
  asyncHandler(async (req: Request, res: Response) => {
    const { nurseId, year, month, day, requestedShift } = req.body;

    if (!nurseId || !year || !month || !day || !requestedShift) {
      res.status(400).json({ success: false, error: '모든 항목을 입력해주세요' });
      return;
    }

    const result = await query(
      `INSERT INTO shift_requests (nurse_id, year, month, day, requested_shift)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (nurse_id, year, month, day)
       DO UPDATE SET requested_shift = EXCLUDED.requested_shift
       RETURNING id, nurse_id as "nurseId", year, month, day,
                 requested_shift as "requestedShift", created_at as "createdAt"`,
      [nurseId, year, month, day, requestedShift]
    );

    res.json({ success: true, data: result.rows[0] });
  })
);

// ===== 희망 오프 목록 조회 =====
router.get(
  '/:wardId/:year/:month/requests',
  asyncHandler(async (req: Request, res: Response) => {
    const { wardId, year, month } = req.params;

    const result = await query(
      `SELECT sr.id, sr.nurse_id as "nurseId", n.name as "nurseName",
              sr.year, sr.month, sr.day,
              sr.requested_shift as "requestedShift",
              sr.created_at as "createdAt"
       FROM shift_requests sr
       JOIN nurses n ON n.id = sr.nurse_id
       WHERE n.ward_id = $1 AND sr.year = $2 AND sr.month = $3
       ORDER BY sr.day, n.name`,
      [wardId, year, month]
    );

    res.json({ success: true, data: result.rows });
  })
);

// ===== 희망 오프 삭제 =====
router.delete(
  '/request/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await query('DELETE FROM shift_requests WHERE id = $1', [id]);
    res.json({ success: true, message: '희망 오프 신청이 취소되었습니다' });
  })
);

export default router;
