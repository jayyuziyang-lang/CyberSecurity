// verify_mastery_algorithm.js
// ---------------------------------------------------------------------------
// 掌握度算法的独立验证（纯 JS 复刻，不连数据库）
//
//   node tools/verify_mastery_algorithm.js
//
// 目的有两个：
//   1. 交付前确认公式在边界输入下不会算出 NaN / 越界 / 反常结果
//      （这类 bug 在真实数据上很难一眼看出）
//   2. 生成一组「输入 -> 输出」对照表，答辩时可直接用来解释算法行为
//
// 公式（与 KnowledgeMasteryServiceImpl 保持一致）：
//   mastery = 100 × ( 0.5×A + 0.3×(1−P) + 0.2×R )
//     A = 正确率 = correct / attempts
//     P = 错误频率 = min(1, errors / (2 × attempts))
//     R = 近因 = 最近 5 次作答正确率（无近期记录则退化为 A）
//   样本量 attempts < 2 时退化为纯正确率
// ---------------------------------------------------------------------------

const W_ACCURACY = 0.5
const W_ERROR_FREQUENCY = 0.3
const W_RECENCY = 0.2
const RECENT_WINDOW = 5
const MIN_SAMPLE = 2
const ERROR_FREQUENCY_SCALE = 2.0
const WEAK_THRESHOLD = 60.0
const PROFICIENT_THRESHOLD = 75.0

function round2(v) {
  return Math.round(v * 100) / 100
}

function computeMastery({ attempts, correct, errors, recentAttempts }) {
  const accuracy = attempts === 0 ? 0 : correct / attempts

  if (attempts < MIN_SAMPLE) {
    // 冷启动：样本太少，退化为纯正确率
    return { accuracy: round2(accuracy * 10000) / 10000, mastery: round2(accuracy * 100), coldStart: true }
  }

  const errorFrequency = Math.min(1, errors / (ERROR_FREQUENCY_SCALE * attempts))

  let recency = null
  if (recentAttempts && recentAttempts.length > 0) {
    const n = Math.min(RECENT_WINDOW, recentAttempts.length)
    let ok = 0
    for (let i = 0; i < n; i++) if (recentAttempts[i] === true) ok++
    recency = ok / n
  }
  const effectiveRecency = recency === null ? accuracy : recency

  const mastery = 100 * (W_ACCURACY * accuracy + W_ERROR_FREQUENCY * (1 - errorFrequency) + W_RECENCY * effectiveRecency)

  return {
    accuracy: round2(accuracy * 10000) / 10000,
    recency: recency === null ? null : round2(recency * 10000) / 10000,
    errorFrequency: round2(errorFrequency * 10000) / 10000,
    mastery: round2(Math.max(0, Math.min(100, mastery))),
    coldStart: false
  }
}

function levelOf(m) {
  if (m < WEAK_THRESHOLD) return 'WEAK(薄弱)'
  return m < PROFICIENT_THRESHOLD ? 'BASIC(合格)' : 'PROFICIENT(熟练)'
}

// ---------------------------------------------------------------------------
// 测试用例：覆盖正常、边界与异常输入
// ---------------------------------------------------------------------------
const cases = [
  { name: '冷启动：只做了 1 题且答对', attempts: 1, correct: 1, errors: 0, recentAttempts: [true] },
  { name: '冷启动：只做了 1 题且答错', attempts: 1, correct: 0, errors: 1, recentAttempts: [false] },
  { name: '完全没做过', attempts: 0, correct: 0, errors: 0, recentAttempts: [] },
  { name: '全对且无重复答错', attempts: 4, correct: 4, errors: 0, recentAttempts: [true, true, true, true] },
  { name: '全对但错了很多次才答对（不该给满分）', attempts: 4, correct: 4, errors: 6, recentAttempts: [true, true, true, true] },
  { name: '全错', attempts: 4, correct: 0, errors: 4, recentAttempts: [false, false, false, false] },
  { name: '一半对一半错', attempts: 4, correct: 2, errors: 2, recentAttempts: [true, false, true, false] },
  {
    name: '早期全错、最近全对（近因加权应明显高于反向）',
    attempts: 4, correct: 2, errors: 2, recentAttempts: [true, true, true, true]
  },
  {
    name: '早期全对、最近全错（对照组）',
    attempts: 4, correct: 2, errors: 2, recentAttempts: [false, false, false, false]
  },
  { name: '同一题反复错（错误频率拉满）', attempts: 2, correct: 0, errors: 8, recentAttempts: [false, false] },
  { name: '边界：近因窗口超过 5 条', attempts: 8, correct: 5, errors: 3, recentAttempts: [true, true, true, true, true, false, false, false] },
  { name: '异常：errors 为 0 但全部未答对', attempts: 3, correct: 0, errors: 0, recentAttempts: [false, false, false] }
]

console.log('掌握度算法验证  mastery = 100 × (0.5A + 0.3(1−P) + 0.2R)\n')
console.log(
  '用例'.padEnd(38) +
  'attempts'.padStart(9) + 'correct'.padStart(8) + 'errors'.padStart(7) +
  'A'.padStart(7) + 'P'.padStart(7) + 'R'.padStart(7) +
  'mastery'.padStart(9) + '  level'
)
console.log('-'.repeat(110))

let failures = []
for (const c of cases) {
  const r = computeMastery(c)
  const line =
    c.name.padEnd(38) +
    String(c.attempts).padStart(9) +
    String(c.correct).padStart(8) +
    String(c.errors).padStart(7) +
    (r.accuracy == null ? '-' : r.accuracy.toFixed(2)).padStart(7) +
    (r.errorFrequency == null ? '-' : r.errorFrequency.toFixed(2)).padStart(7) +
    (r.recency == null ? (r.coldStart ? '冷启' : '-') : r.recency.toFixed(2)).padStart(7) +
    r.mastery.toFixed(2).padStart(9) +
    '  ' + levelOf(r.mastery)
  console.log(line)

  // 断言：所有输出必须是 [0,100] 内的有限数
  if (!Number.isFinite(r.mastery)) failures.push(`${c.name}: mastery 不是有限数 (${r.mastery})`)
  if (r.mastery < 0 || r.mastery > 100) failures.push(`${c.name}: mastery 越界 (${r.mastery})`)
}

// 断言：近因加权必须让「最近学会」优于「最近退步」
const improving = computeMastery(cases[7])
const declining = computeMastery(cases[8])
console.log('')
if (!(improving.mastery > declining.mastery)) {
  failures.push(`近因加权失效: 进步型(${improving.mastery}) 未高于 退步型(${declining.mastery})`)
} else {
  console.log(`近因加权生效：同样 2 对 2 错，「最近全对」${improving.mastery} 分 > 「最近全错」${declining.mastery} 分`)
}

// 断言：反复答错必须被惩罚
const clean = computeMastery(cases[3])
const messy = computeMastery(cases[4])
console.log(`错误频率生效：同样 4 题全对，错 0 次 ${clean.mastery} 分 > 错 6 次 ${messy.mastery} 分`)
if (!(clean.mastery > messy.mastery)) {
  failures.push('错误频率维度失效：反复答错未被惩罚')
}

// 断言：单调性 —— 答对数越多，掌握度不应下降
let prev = -1
let monotonic = true
for (let correct = 0; correct <= 6; correct++) {
  const m = computeMastery({ attempts: 6, correct, errors: 6 - correct, recentAttempts: [] }).mastery
  if (m < prev) monotonic = false
  prev = m
}
if (!monotonic) failures.push('单调性被破坏：答对数增加时掌握度出现下降')
else console.log('单调性成立：固定 6 题，答对数从 0 增到 6，掌握度单调不减')

console.log('')
if (failures.length === 0) {
  console.log('RESULT: PASS - 算法在全部用例与不变式下行为正确。')
  process.exit(0)
} else {
  console.log(`RESULT: FAIL (${failures.length})`)
  for (const f of failures) console.log('  - ' + f)
  process.exit(1)
}
