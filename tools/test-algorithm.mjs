// dsh-price-indicator —— 价格时段算法测试
// 直接从 plugin/client.js 抽取 PRICE_CONFIG / offPeakReason / getPriceStatus（不复制逻辑），
// 用固定的北京时间日期断言，覆盖：工作日峰谷、普通周末、调休上班的周末、法定节假日、跨假期倒计时。
// 政策依据：工作日高峰 09:00-12:00、14:00-18:00；周六、周日与中国法定节假日全天按空闲计费。
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const bundle = readFileSync(join(root, 'plugin', 'client.js'), 'utf8').split('\n')

// 配置段（PRICE_CONFIG / offPeakReason）与计算段（getPriceStatus）之间隔着 store 与样式，分两段抽取。
const cfgStart = bundle.findIndex((line) => line.includes('价格配置'))
const storeStart = bundle.findIndex((line) => line.includes('微 store'))
const calcStart = bundle.findIndex((line) => line.includes('倒计时计算'))
const calcEnd = bundle.findIndex((line) => line.includes('function formatCountdown'))
if (cfgStart < 0 || storeStart < 0 || calcStart < 0 || calcEnd < 0 || cfgStart >= storeStart || calcStart >= calcEnd) {
  console.error('无法从 plugin/client.js 抽取算法段')
  process.exit(2)
}
const code = bundle.slice(cfgStart, storeStart).concat(bundle.slice(calcStart, calcEnd)).join('\n')
const { getPriceStatus } = new Function(code + '\nreturn { getPriceStatus }')()

// 北京时间 y-m-d hh:mm 对应的真实时间戳（北京 = UTC+8）
const bj = (y, m, d, hh, mm) => Date.UTC(y, m - 1, d, hh - 8, mm, 0, 0)

const cases = [
  // 工作日：2026-10-08 周四（国庆假期后首个工作日）
  { t: bj(2026, 10, 8, 8, 59), peak: false, mins: 1, reason: null, note: '周四 08:59 空闲 → 09:00' },
  { t: bj(2026, 10, 8, 9, 0), peak: true, mins: 180, reason: null, note: '周四 09:00 高峰 → 12:00' },
  { t: bj(2026, 10, 8, 11, 59), peak: true, mins: 1, reason: null, note: '周四 11:59 高峰 → 12:00' },
  { t: bj(2026, 10, 8, 12, 0), peak: false, mins: 120, reason: null, note: '周四 12:00 空闲 → 14:00' },
  { t: bj(2026, 10, 8, 14, 0), peak: true, mins: 240, reason: null, note: '周四 14:00 高峰 → 18:00' },
  { t: bj(2026, 10, 8, 17, 59), peak: true, mins: 1, reason: null, note: '周四 17:59 高峰 → 18:00' },
  { t: bj(2026, 10, 8, 18, 0), peak: false, mins: 900, reason: null, note: '周四 18:00 空闲 → 周五 09:00' },
  { t: bj(2026, 10, 8, 21, 30), peak: false, mins: 690, reason: null, note: '周四 21:30 空闲 → 周五 09:00' },
  // 普通周末：2026-10-11 周日
  { t: bj(2026, 10, 11, 10, 0), peak: false, mins: 1380, reason: 'weekend', note: '周日 10:00 周末全天空闲 → 周一 09:00' },
  // 调休上班的周末：2026-10-10 周六上班，仍按空闲计费
  { t: bj(2026, 10, 10, 10, 0), peak: false, mins: 2820, reason: 'weekend', note: '调休上班的周六仍空闲 → 周一 09:00' },
  // 国庆假期：2026-10-01 周四 至 10-07 周三
  { t: bj(2026, 10, 3, 12, 0), peak: false, mins: 7020, reason: 'holiday', note: '国庆假期中（周六）空闲 → 10-08 周四 09:00' },
  { t: bj(2026, 10, 7, 20, 0), peak: false, mins: 780, reason: 'holiday', note: '假期最后一天 20:00 → 10-08 09:00' },
  // 中秋：2026-09-25 周五
  { t: bj(2026, 9, 25, 10, 0), peak: false, mins: 4260, reason: 'holiday', note: '中秋（周五）空闲 → 09-28 周一 09:00' },
  // 元旦调休：2026-01-04 周日上班
  { t: bj(2026, 1, 4, 15, 0), peak: false, mins: 1080, reason: 'weekend', note: '元旦调休的周日仍空闲 → 01-05 周一 09:00' },
  // 春节：2026-02-15 至 02-23 放假，02-14 周六上班
  { t: bj(2026, 2, 14, 10, 0), peak: false, mins: 14340, reason: 'weekend', note: '春节前的调休周六空闲 → 02-24 周二 09:00' },
  { t: bj(2026, 2, 16, 10, 0), peak: false, mins: 11460, reason: 'holiday', note: '春节期间（周一）空闲 → 02-24 周二 09:00' },
  { t: bj(2026, 2, 24, 9, 30), peak: true, mins: 150, reason: null, note: '春节后首个工作日 09:30 高峰 → 12:00' },
]

let ok = true
for (const c of cases) {
  const r = getPriceStatus(c.t)
  const mins = Math.round((r.nextSwitchMs - c.t) / 60000)
  const pass = r.isPeak === c.peak && mins === c.mins && (r.reason || null) === c.reason
  if (!pass) ok = false
  const got = 'peak=' + r.isPeak + ' reason=' + (r.reason || '-') + ' minutes=' + mins
  const want = 'peak=' + c.peak + ' reason=' + (c.reason || '-') + ' minutes=' + c.mins
  console.log((pass ? 'PASS' : 'FAIL') + ' | ' + c.note + ' | ' + got + (pass ? '' : ' | 期望 ' + want))
}
console.log(ok ? 'ALL PASS' : 'SOME FAIL')
process.exit(ok ? 0 : 1)
