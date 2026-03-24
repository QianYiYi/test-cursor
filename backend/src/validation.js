import { z } from 'zod';
import { NOTIFY_METHODS, PLATFORMS, STATUS } from './constants.js';

const notifyMethodSchema = z.array(z.enum(NOTIFY_METHODS)).max(10).optional().nullable();

const contractNoSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-\/]*$/, '合同编号仅允许字母数字及 . _ - /');

/** 中国大陆手机号：11 位 1[3-9]…，提交前去除空白 */
const mobilePhoneSchema = z
  .string()
  .min(1)
  .max(64)
  .transform((s) => String(s).replace(/\s+/g, ''))
  .refine((s) => /^1[3-9]\d{9}$/.test(s), '手机格式错误');

const dateTimeSchema = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s.replace(' ', 'T'))), '上门时间格式不合法');

function parseDt(s) {
  return Date.parse(String(s).replace(' ', 'T'));
}

/** 日期部分 YYYY-MM-DD（用于判断是否同一天出差） */
function ymdPart(s) {
  return String(s).slice(0, 10);
}

/**
 * 出差服务范围 [tripStart, tripEnd] 与上门 [visitTime, serviceEndTime] 一致性
 * - 单日出差：上门须与出差范围完全一致（由前端同步）
 * - 多日出差：具体上门服务时刻 visitTime 须在出差区间内；结束时间由前端按「上门后 1 小时」等规则生成，且须落在区间内
 */
export function assertBookingTripVisitConsistency(v) {
  const t0 = parseDt(v.tripStart);
  const t1 = parseDt(v.tripEnd);
  const vs = parseDt(v.visitTime);
  const ve = parseDt(v.serviceEndTime);
  if (![t0, t1, vs, ve].every(Number.isFinite)) return '时间格式不合法';
  if (!(t1 > t0)) return '出差服务结束须晚于开始';
  if (!(ve > vs)) return '服务结束须晚于上门服务时间';
  if (ymdPart(v.tripStart) === ymdPart(v.tripEnd)) {
    if (vs !== t0 || ve !== t1) {
      return '单日出差时，上门订单时间须与出差服务范围一致';
    }
  } else {
    if (vs < t0 || vs > t1) {
      return '上门服务时间须在出差服务范围之内';
    }
    if (ve > t1) {
      return '服务结束时间须在出差服务范围之内';
    }
  }
  return null;
}

const bookingBaseSchema = z.object({
  salesName: z.string().min(1).max(64),
  contractNo: contractNoSchema,
  customerUnit: z.string().min(1).max(128),
  customerName: z.string().min(1).max(64),
  customerContact: mobilePhoneSchema,

  needDissociation: z.boolean().default(false),
  sampleInfo: z.string().min(1).max(255),

  /** 实验员出差 / 现场服务可覆盖的时间范围 */
  tripStart: dateTimeSchema,
  tripEnd: dateTimeSchema,
  /** 实际上门订单时段（日历、排期、冲突检测均以此为准） */
  visitTime: dateTimeSchema,
  serviceEndTime: dateTimeSchema,
  experimenter: z.string().trim().min(1).max(64),
  sampleCount: z.number().int().min(1),

  seqType: z.string().trim().min(1).max(128),
  seqDataVolume: z.string().trim().max(64).optional().nullable(),
  pmOwner: z.string().trim().max(64).optional().nullable(),
  platform: z.enum(PLATFORMS),
  notifyMethods: notifyMethodSchema,
  remark: z.string().trim().max(1000).optional().nullable()
});

export const bookingCreateSchema = bookingBaseSchema.superRefine((v, ctx) => {
  const msg = assertBookingTripVisitConsistency(v);
  if (msg) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['visitTime'],
      message: msg
    });
  }
});

export const bookingUpdateSchema = bookingBaseSchema
  .partial()
  .extend({
    status: z.enum(STATUS).optional()
  })
  .superRefine((v, ctx) => {
    if (v.visitTime && v.serviceEndTime) {
      const start = Date.parse(v.visitTime.replace(' ', 'T'));
      const end = Date.parse(v.serviceEndTime.replace(' ', 'T'));
      if (Number.isFinite(start) && Number.isFinite(end) && end <= start) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['serviceEndTime'],
          message: '服务结束时间必须晚于开始时间'
        });
      }
    }
    const hasTrip = v.tripStart !== undefined || v.tripEnd !== undefined;
    if (hasTrip && (v.tripStart === undefined || v.tripEnd === undefined)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['tripStart'],
        message: '出差服务范围需同时填写开始与结束'
      });
    }
    if (v.tripStart && v.tripEnd && v.visitTime && v.serviceEndTime) {
      const msg = assertBookingTripVisitConsistency({
        tripStart: v.tripStart,
        tripEnd: v.tripEnd,
        visitTime: v.visitTime,
        serviceEndTime: v.serviceEndTime
      });
      if (msg) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['visitTime'], message: msg });
      }
    }
  });

export const bookingListQuerySchema = z.object({
  salesName: z.string().optional(),
  contractNo: z.string().optional(),
  customerUnit: z.string().optional(),
  customerName: z.string().optional(),
  needDissociation: z.string().optional(), // 'true'|'false'
  sampleInfo: z.string().optional(),
  experimenter: z.string().optional(),
  sampleCount: z.string().optional(),
  seqType: z.string().optional(),
  pmOwner: z.string().optional(),
  platform: z.string().optional(),
  status: z.string().optional(),
  visitFrom: z.string().optional(),
  visitTo: z.string().optional(),
  onDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.string().optional(),
  pageSize: z.string().optional()
});

