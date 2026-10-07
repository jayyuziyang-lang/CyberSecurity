// validate_miniprogram.js
// ---------------------------------------------------------------------------
// 小程序静态自检（无需微信开发者工具，Node 直接跑）
//
//   node tools/validate_miniprogram.js
//
// 检查项：
//   1. app.json 里注册的每个页面，4 个文件（js/json/wxml/wxss）是否齐全
//   2. 所有 .json 是否能正确解析
//   3. 所有 .js 是否有语法错误（用 vm 编译，不执行）
//   4. WXML 里绑定的每个事件处理函数，是否都能在对应 .js 里找到定义
//      —— 这条最容易漏：bindtap 写了个 JS 里不存在的方法，运行时点了没反应
//
// 退出码：0 全部通过；1 有问题
// ---------------------------------------------------------------------------

const fs = require('fs')
const path = require('path')
const vm = require('vm')

const feRoot = path.resolve(__dirname, '..', 'frontend')
const problems = []

function rel(p) {
  return path.relative(feRoot, p).replace(/\\/g, '/')
}

// ---------- 1. app.json ----------
const appJsonPath = path.join(feRoot, 'app.json')
if (!fs.existsSync(appJsonPath)) {
  console.error('app.json not found at ' + appJsonPath)
  process.exit(1)
}
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
const pages = appJson.pages || []

console.log(`frontend: ${feRoot}`)
console.log(`registered pages: ${pages.length}\n`)

// ---------- 2. JSON validity ----------
function walk(dir, filter, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, filter, out)
    else if (filter(entry.name)) out.push(full)
  }
  return out
}

const jsonFiles = walk(feRoot, n => n.endsWith('.json'))
for (const f of jsonFiles) {
  try {
    JSON.parse(fs.readFileSync(f, 'utf8'))
  } catch (e) {
    problems.push(`JSON 解析失败: ${rel(f)} -> ${e.message}`)
  }
}
console.log(`[1] JSON files parsed: ${jsonFiles.length}`)

// ---------- 3. page file completeness ----------
const EXTS = ['js', 'json', 'wxml', 'wxss']
let missingFiles = 0
for (const p of pages) {
  for (const ext of EXTS) {
    const f = path.join(feRoot, `${p}.${ext}`)
    if (!fs.existsSync(f)) {
      problems.push(`页面文件缺失: ${p}.${ext}`)
      missingFiles++
    }
  }
}
console.log(`[2] page files checked: ${pages.length} x ${EXTS.length}, missing: ${missingFiles}`)

// ---------- 4. JS syntax ----------
const jsFiles = walk(feRoot, n => n.endsWith('.js')).filter(f => !f.includes('node_modules'))
let jsErrors = 0
for (const f of jsFiles) {
  const code = fs.readFileSync(f, 'utf8')
  try {
    new vm.Script(code, { filename: f })
  } catch (e) {
    problems.push(`JS 语法错误: ${rel(f)} -> ${e.message}`)
    jsErrors++
  }
}
console.log(`[3] JS files syntax-checked: ${jsFiles.length}, errors: ${jsErrors}`)

// ---------- 5. WXML event handlers must exist in the page's JS ----------
// 匹配 bindtap="fn" / bind:tap="fn" / catchtap="fn" / bindinput="fn" 等
const BIND_RE = /\b(?:bind|catch|capture-bind|capture-catch)[:-]?([a-zA-Z]+)\s*=\s*"([^"{}]+)"/g

let wxmlChecked = 0
let handlerChecked = 0
for (const p of pages) {
  const wxmlPath = path.join(feRoot, `${p}.wxml`)
  const jsPath = path.join(feRoot, `${p}.js`)
  if (!fs.existsSync(wxmlPath) || !fs.existsSync(jsPath)) continue

  const wxml = fs.readFileSync(wxmlPath, 'utf8')
  const js = fs.readFileSync(jsPath, 'utf8')
  wxmlChecked++

  const handlers = new Set()
  let m
  while ((m = BIND_RE.exec(wxml)) !== null) {
    handlers.add(m[2].trim())
  }

  for (const h of handlers) {
    handlerChecked++
    // 宽松匹配：方法名后跟 ( 或 : 或 = ，覆盖 `fn() {`、`fn: function`、`fn: () =>`
    const defined = new RegExp(`(^|[^\\w.])${h}\\s*[(:]`, 'm').test(js)
    if (!defined) {
      problems.push(`WXML 绑定了不存在的方法: ${p}.wxml -> "${h}" 在 ${p}.js 中未定义`)
    }
  }
}
console.log(`[4] WXML files scanned: ${wxmlChecked}, event handlers verified: ${handlerChecked}`)

// ---------- report ----------
console.log('')
if (problems.length === 0) {
  console.log('RESULT: PASS - 小程序结构、JSON、JS 语法与事件绑定全部正常。')
  process.exit(0)
} else {
  console.log(`RESULT: FAIL (${problems.length} 个问题)`)
  for (const p of problems) console.log('  - ' + p)
  process.exit(1)
}
