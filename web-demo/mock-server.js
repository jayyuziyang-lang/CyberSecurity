// ===========================================================================
//  mock-server.js -- 演示前端的本地假后端（仅用于联调，不参与正式演示）
// ---------------------------------------------------------------------------
//  用途：在没有 PostgreSQL / 没启动 Spring Boot 的情况下，验证 web-demo 前端
//        的界面渲染与交互流程是否正常。
//
//  用法：
//      node web-demo/mock-server.js            # 监听 9090
//      然后浏览器打开： http://127.0.0.1:8081/?api=http://127.0.0.1:9090
//      （8081 是 start-demo.ps1 起的静态网页服务）
//
//  注意：这是假数据假算法，只为打通前端。真实演示请务必用 Spring Boot 后端。
// ===========================================================================

const http = require('http');
const url = require('url');

const PORT = 9090;

/* ------------------------------- 假数据 -------------------------------- */
const users = [
  { id: 1, username: 'admin',    nickname: '系统管理员', points: 0,   role: 1, isFollowed: 0, isAuthenticated: true,  password: 'admin123' },
  { id: 2, username: 'student1', nickname: '安全小卫士', points: 180, role: 0, isFollowed: 1, isAuthenticated: true,  password: '123456' },
  { id: 3, username: 'student2', nickname: '网络萌新',   points: 120, role: 0, isFollowed: 0, isAuthenticated: false, password: '123456' },
  { id: 4, username: 'student3', nickname: '白帽小张',   points: 240, role: 0, isFollowed: 1, isAuthenticated: true,  password: '123456' },
  { id: 5, username: 'student4', nickname: '信安小刘',   points: 90,  role: 0, isFollowed: 0, isAuthenticated: true,  password: '123456' },
  { id: 6, username: 'student5', nickname: '密码学小王', points: 300, role: 0, isFollowed: 0, isAuthenticated: true,  password: '123456' }
];

const knowledgePoints = [
  { id: 1, code: 'KP01', name: '密码安全',     category: '身份认证', description: '口令强度、口令复用、暴力破解与撞库攻击的识别与防护', difficulty: 1 },
  { id: 2, code: 'KP02', name: '钓鱼识别',     category: '社会工程', description: '仿冒网站、钓鱼短信、冒充客服等社会工程手法的识别',     difficulty: 1 },
  { id: 3, code: 'KP03', name: '数据传输安全', category: '通信安全', description: 'HTTP 与 HTTPS 的差异、加密传输与会话安全',            difficulty: 1 },
  { id: 4, code: 'KP04', name: '验证码保护',   category: '身份认证', description: '短信/动态验证码的安全边界，以及索要验证码的诈骗特征', difficulty: 1 },
  { id: 5, code: 'KP05', name: 'SQL 注入',     category: 'Web 安全', description: 'SQL 注入的成因、利用方式与参数化查询等根本性防护',     difficulty: 3 },
  { id: 6, code: 'KP06', name: 'DDoS 攻击',    category: '网络攻击', description: '分布式拒绝服务攻击的原理与影响',                       difficulty: 2 },
  { id: 7, code: 'KP07', name: '勒索软件',     category: '恶意代码', description: '勒索软件的处置原则与应急响应',                         difficulty: 2 },
  { id: 8, code: 'KP08', name: '个人信息保护', category: '数据安全', description: '敏感个人信息的收集、存储、使用与最小必要原则',         difficulty: 2 }
];

const quizzes = [
  { id: 1, paperId: 1, kp: 1, question: '以下哪种密码强度最高？', optionA: '123456', optionB: 'password', optionC: 'MyDog2010', optionD: 'X7#kL9@qZ2!', answer: 'D', analysis: '长度足够且混合大小写字母、数字、符号的密码强度最高。' },
  { id: 2, paperId: 1, kp: 1, question: '“撞库攻击”指的是？', optionA: '用暴力方式猜密码', optionB: '用已泄露的账号密码去批量尝试登录其他网站', optionC: '攻击数据库服务器', optionD: '伪造网站证书', answer: 'B', analysis: '很多人在不同网站使用同一套密码，一处泄露后攻击者即可批量尝试其他平台。' },
  { id: 3, paperId: 1, kp: 2, question: '什么是“钓鱼网站”？', optionA: '提供免费WiFi的网站', optionB: '伪装成正规网站骗取账号密码的假网站', optionC: '网速很慢的网站', optionD: '被黑客攻击过的网站', answer: 'B', analysis: '钓鱼网站通过仿冒正规页面诱导用户输入账号密码等敏感信息。' },
  { id: 4, paperId: 1, kp: 3, question: 'HTTP 与 HTTPS 的主要区别是什么？', optionA: 'HTTPS 速度更快', optionB: 'HTTPS 对传输数据做了加密', optionC: 'HTTP 更安全', optionD: '两者没有区别', answer: 'B', analysis: 'HTTPS 在 HTTP 基础上加入 TLS/SSL 加密，防止传输内容被窃听篡改。' },
  { id: 5, paperId: 1, kp: 4, question: '收到自称“客服”要求提供短信验证码的电话，正确做法是？', optionA: '直接告知验证码', optionB: '先告知再挂断', optionC: '挂断并通过官方渠道核实', optionD: '把验证码发到群里确认', answer: 'C', analysis: '短信验证码等同于临时密码，任何人索要都应拒绝，并通过官方渠道核实。' },
  { id: 6, paperId: 2, kp: 5, question: 'SQL 注入攻击的核心原理是？', optionA: '让数据库服务器宕机', optionB: '把恶意 SQL 语句拼进输入参数并被数据库执行', optionC: '破解数据库密码', optionD: '窃取数据库备份文件', answer: 'B', analysis: '当程序把用户输入直接拼接进 SQL 语句时，攻击者可构造输入改变原语句语义。' },
  { id: 7, paperId: 2, kp: 5, question: '防范 SQL 注入最有效的手段是？', optionA: '过滤单引号', optionB: '隐藏数据库报错', optionC: '使用参数化查询（预编译语句）', optionD: '限制输入长度', answer: 'C', analysis: '参数化查询把 SQL 结构与数据分离，使输入无法改变语句语义。' },
  { id: 8, paperId: 2, kp: 6, question: 'DDoS 攻击的主要目的是？', optionA: '窃取用户数据', optionB: '消耗目标资源使其无法正常提供服务', optionC: '篡改网页内容', optionD: '植入病毒', answer: 'B', analysis: 'DDoS 通过大量分布式流量耗尽带宽或连接资源，导致服务不可用。' },
  { id: 9, paperId: 2, kp: 7, question: '发现电脑中了勒索病毒，最不应该做的是？', optionA: '立即断网', optionB: '向安全机构求助', optionC: '支付赎金', optionD: '保留现场并上报', answer: 'C', analysis: '支付赎金不保证能恢复数据，还会助长犯罪，且可能被二次勒索。' },
  { id: 10, paperId: 3, kp: 8, question: '以下哪种做法最容易导致个人信息泄露？', optionA: '定期修改密码', optionB: '在公共电脑上勾选“记住密码”', optionC: '开启二次验证', optionD: '使用密码管理器', answer: 'B', analysis: '公共电脑上的“记住密码”会把凭据留在本地，极易被他人获取。' },
  { id: 11, paperId: 3, kp: 8, question: '关于身份证号等敏感信息，正确的做法是？', optionA: '随意发到微信群', optionB: '在不明网站填写', optionC: '仅在必要场合通过官方渠道提供', optionD: '写进公开简历', answer: 'C', analysis: '敏感个人信息应遵循最小必要原则，只在可信官方渠道按需提供。' },
  { id: 12, paperId: 3, kp: 1, question: '开启双因素认证（2FA）的作用是？', optionA: '让密码更复杂', optionB: '即使密码泄露，攻击者仍难以登录', optionC: '加快登录速度', optionD: '替代密码', answer: 'B', analysis: '双因素认证要求同时提供密码和第二种凭证，显著提高账号安全性。' }
];

const papers = [
  { id: 1, title: '网络安全基础入门' },
  { id: 2, title: '常见网络攻击与防范' },
  { id: 3, title: '个人信息保护与密码安全' }
];

const news = [
  { id: 1, title: '2026 年校园网络安全知识竞赛开始报名', category: '竞赛信息', isCompetition: true,  author: '系统管理员',   createTime: '2026-09-30 10:00', content: '为提升全校同学的网络安全意识，现举办网络安全知识竞赛。比赛采用线上答题形式，题目涵盖密码安全、钓鱼识别、数据保护等内容。请有意参赛的同学在资讯详情页点击「立即报名」。' },
  { id: 2, title: '网络安全宣传周活动通知',             category: '网络安全活动', isCompetition: false, author: '系统管理员',   createTime: '2026-09-29 09:00', content: '本周为校园网络安全宣传周，将在图书馆报告厅举办三场专题讲座，内容包括《个人信息保护法》解读、常见网络诈骗手法剖析、安全编码实践。欢迎各年级同学参加。' },
  { id: 3, title: '警惕：近期出现仿冒教务系统的钓鱼页面', category: '安全动态', isCompetition: false, author: '安全预警中心', createTime: '2026-09-28 16:30', content: '近期监测到有仿冒我校教务系统的钓鱼页面，通过短信链接诱导同学输入学号与密码。请注意：学校不会通过短信索要密码，请勿点击陌生链接。如已填写，请立即修改密码并联系信息中心。' },
  { id: 4, title: '关于近期校园网异常流量的说明',         category: '系统公告', isCompetition: false, author: '系统管理员',   createTime: '2026-09-27 14:00', content: '部分宿舍区出现异常流量，经排查为某软件自动更新所致，非安全事件，已处理完毕，网络现已恢复正常。' },
  { id: 5, title: '常见弱口令自查指南',                 category: '安全动态', isCompetition: false, author: '安全预警中心', createTime: '2026-09-26 11:20', content: '请同学们自查是否使用以下弱口令：123456、password、qwerty、生日、学号后六位等。建议使用 12 位以上、混合大小写字母与符号的密码，并为不同网站设置不同密码。' },
  { id: 6, title: '信息安全 CTF 校内选拔赛报名',        category: '竞赛信息', isCompetition: true,  author: '系统管理员',   createTime: '2026-09-25 15:00', content: '面向全校学生的 CTF 校内选拔赛即将开始，赛题方向包括 Web 安全、逆向工程、密码学与杂项。优胜者将代表学校参加省级比赛。请在资讯详情页报名。' }
];

// wrong_set: 按 userId 存 { quizId, resolved, errorCount }
const wrongSets = {
  2: [ { quizId: 1, resolved: false, errorCount: 2 }, { quizId: 7, resolved: false, errorCount: 1 } ],
  4: [ { quizId: 7, resolved: false, errorCount: 1 } ]
};

/* --------------------------- 掌握度算法（同后端） -------------------------- */
const W_ACC = 0.5, W_ERR = 0.3, W_REC = 0.2, RECENT_WINDOW = 5, MIN_SAMPLE = 2, ERR_SCALE = 2.0;

function round2(v) { return Math.round(v * 100) / 100; }
function round4(v) { return Math.round(v * 10000) / 10000; }

function masteryOf(attempts, correct, errors, recent) {
  const A = attempts === 0 ? 0 : correct / attempts;
  if (attempts < MIN_SAMPLE) {
    return { mastery: round2(100 * A), accuracy: round4(A), recentAccuracy: null, level: levelOf(100 * A) };
  }
  const P = Math.min(1, errors / (ERR_SCALE * attempts));
  let R = null;
  if (recent && recent.length) {
    const n = Math.min(RECENT_WINDOW, recent.length);
    let ok = 0;
    for (let i = 0; i < n; i++) if (recent[i]) ok++;
    R = ok / n;
  }
  const effR = R === null ? A : R;
  const m = Math.max(0, Math.min(100, 100 * (W_ACC * A + W_ERR * (1 - P) + W_REC * effR)));
  return { mastery: round2(m), accuracy: round4(A), recentAccuracy: R === null ? null : round4(R), level: levelOf(m) };
}

function levelOf(m) { return m < 60 ? 'WEAK' : m < 75 ? 'BASIC' : 'PROFICIENT'; }

function buildDiagnosis(userId) {
  const rows = wrongSets[userId] || [];
  const byPoint = {};
  rows.forEach(r => {
    const q = quizzes.find(x => x.id === r.quizId);
    if (!q) return;
    if (!byPoint[q.kp]) byPoint[q.kp] = { attempts: 0, correct: 0, errors: 0, recent: [] };
    const b = byPoint[q.kp];
    b.attempts++;
    if (r.resolved) b.correct++;
    b.errors += (r.errorCount || 1);
    b.recent.push(!!r.resolved);
  });

  const items = Object.keys(byPoint).map(kpId => {
    const kp = knowledgePoints.find(k => k.id === Number(kpId));
    const b = byPoint[kpId];
    const m = masteryOf(b.attempts, b.correct, b.errors, b.recent);
    return {
      knowledgePointId: kp.id, code: kp.code, name: kp.name, category: kp.category,
      description: kp.description, difficulty: kp.difficulty,
      mastery: m.mastery, level: m.level,
      attemptCount: b.attempts, correctCount: b.correct, wrongCount: b.attempts - b.correct,
      accuracy: m.accuracy, recentAccuracy: m.recentAccuracy,
      lastAnswerTime: '2026-10-01 10:00:00'
    };
  }).sort((a, b) => a.mastery - b.mastery);

  const sum = items.reduce((s, i) => s + i.mastery, 0);
  const avg = items.length ? round2(sum / items.length) : 0;
  const weak = items.filter(i => i.level === 'WEAK').length;
  const basic = items.filter(i => i.level === 'BASIC').length;
  const prof = items.filter(i => i.level === 'PROFICIENT').length;

  return {
    overview: {
      pointCount: items.length, averageMastery: avg,
      weakCount: weak, basicCount: basic, proficientCount: prof,
      overallLevel: levelOf(avg),
      summary: items.length
        ? `整体掌握情况中等，覆盖 ${items.length} 个知识点，其中 ${weak} 个低于 60 分，建议优先针对薄弱知识点做专项练习。`
        : '还没有答题记录，先去完成一次作业包，系统就能生成你的知识点诊断报告。'
    },
    items
  };
}

/* --------------------------------- 路由 -------------------------------- */
function send(res, obj, code) {
  const body = JSON.stringify(obj);
  res.writeHead(code || 200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
  });
  res.end(body);
}
const ok = (res, data) => send(res, { code: 200, message: '操作成功', data });
const err = (res, msg, code) => send(res, { code: code || 400, message: msg, data: null });

function readBody(req) {
  return new Promise(resolve => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { resolve(JSON.parse(d || '{}')); } catch (e) { resolve({}); } });
  });
}

const server = http.createServer(async (req, res) => {
  const u = url.parse(req.url, true);
  const p = u.pathname;

  if (req.method === 'OPTIONS') return send(res, {}, 204);

  // ---- 登录 ----
  if (p === '/api/user/login' && req.method === 'POST') {
    const b = await readBody(req);
    const user = users.find(x => x.username === b.username && x.password === b.password);
    if (!user) return err(res, 'username or password is incorrect', 401);
    const { password, ...safe } = user;
    return ok(res, { token: 'mock-token-' + user.id, role: user.role, isAuthenticated: user.isAuthenticated, userInfo: safe });
  }

  if (p.startsWith('/api/user/info/')) {
    const id = Number(p.split('/').pop());
    const user = users.find(x => x.id === id);
    if (!user) return err(res, 'user not found', 404);
    const { password, ...safe } = user;
    return ok(res, safe);
  }

  if (p === '/api/user/leaderboard') {
    const list = users.filter(x => x.role === 0)
      .map(({ password, ...s }) => s)
      .sort((a, b) => b.points - a.points).slice(0, 10);
    return ok(res, list);
  }

  // ---- 资讯 ----
  if (p === '/api/news/list') {
    const cat = u.query.category;
    const list = cat ? news.filter(n => n.category === cat) : news;
    return ok(res, list);
  }
  if (p.startsWith('/api/news/get/')) {
    const id = Number(p.split('/').pop());
    const n = news.find(x => x.id === id);
    return n ? ok(res, n) : err(res, 'news not found', 404);
  }
  if (p === '/api/news/search') {
    const kw = (u.query.keyword || '').toLowerCase();
    return ok(res, news.filter(n => n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw)));
  }
  if (p === '/api/registration/submit') return ok(res, 'registered');

  // ---- 作业包 ----
  if (p === '/api/paper/list') return ok(res, papers);
  if (p.startsWith('/api/paper/quizzes/')) {
    const pid = Number(p.split('/').pop());
    return ok(res, quizzes.filter(q => q.paperId === pid));
  }

  // ---- 答题 ----
  if (p === '/api/quiz/submit') return ok(res, 'points updated');

  if (p === '/api/wrong-set/record') {
    const b = await readBody(req);
    const q = quizzes.find(x => x.id === Number(b.quizId));
    if (!q) return err(res, 'quiz not found', 404);
    const correct = String(q.answer).toLowerCase() === String(b.selectedAnswer || '').toLowerCase();
    const uid = Number(b.userId);
    const list = wrongSets[uid] || (wrongSets[uid] = []);
    let rec = list.find(r => r.quizId === q.id);
    if (!rec) { rec = { quizId: q.id, resolved: correct, errorCount: correct ? 0 : 1 }; list.push(rec); }
    else {
      if (correct) rec.resolved = true;
      else { rec.resolved = false; rec.errorCount++; }
    }
    return ok(res, {
      correct, quizId: q.id, wrongId: null, errorCount: rec.errorCount,
      isResolved: correct, correctAnswer: q.answer, analysis: q.analysis
    });
  }

  if (p === '/api/wrong-set/list') {
    const uid = Number(u.query.userId);
    const list = (wrongSets[uid] || []).filter(r => !r.resolved).map(r => {
      const q = quizzes.find(x => x.id === r.quizId);
      return {
        wrongId: r.quizId, quizId: q.id, errorCount: r.errorCount, question: q.question,
        optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
        answer: q.answer, analysis: q.analysis
      };
    });
    return ok(res, list);
  }

  // ---- 智能化 ----
  if (p === '/api/intelligent/knowledge-points') return ok(res, knowledgePoints);

  if (p.startsWith('/api/intelligent/diagnosis/')) {
    const uid = Number(p.split('/').pop());
    return ok(res, buildDiagnosis(uid));
  }

  if (p === '/api/intelligent/weak-points') {
    const uid = Number(u.query.userId);
    const limit = Number(u.query.limit || 3);
    const d = buildDiagnosis(uid);
    const weak = d.items.filter(i => i.level === 'WEAK').slice(0, limit)
      .map(i => ({ ...i, reason: `该知识点下 ${i.attemptCount} 道题，尚有 ${i.wrongCount} 题未答对` }));
    return ok(res, weak);
  }

  if (p === '/api/intelligent/recommend') {
    const uid = Number(u.query.userId);
    const limit = Number(u.query.limit || 5);
    let kpId = u.query.knowledgePointId ? Number(u.query.knowledgePointId) : null;
    let strategy = '指定知识点专项练习';
    let pointName = null;

    if (!kpId) {
      const d = buildDiagnosis(uid);
      if (d.items.length) {
        kpId = d.items[0].knowledgePointId;
        pointName = d.items[0].name;
        strategy = '优先推荐最薄弱知识点';
      } else {
        strategy = '冷启动推荐：按知识点难度推荐基础题';
        const basics = quizzes.slice().sort((a, b) => {
          const ka = knowledgePoints.find(k => k.id === a.kp);
          const kb = knowledgePoints.find(k => k.id === b.kp);
          return ka.difficulty - kb.difficulty || a.id - b.id;
        }).slice(0, limit);
        return ok(res, { strategy, knowledgePointId: null, knowledgePointName: null, quizzes: basics });
      }
    } else {
      pointName = (knowledgePoints.find(k => k.id === kpId) || {}).name || null;
    }

    const resolved = new Set((wrongSets[uid] || []).filter(r => r.resolved).map(r => r.quizId));
    let list = quizzes.filter(q => q.kp === kpId && !resolved.has(q.id));
    if (!list.length) list = quizzes.filter(q => q.kp === kpId);

    return ok(res, { strategy, knowledgePointId: kpId, knowledgePointName: pointName, quizzes: list.slice(0, limit) });
  }

  if (p.startsWith('/api/intelligent/refresh/')) return ok(res, { refreshedKnowledgePoints: 8 });

  err(res, 'not found: ' + p, 404);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('mock backend listening on http://127.0.0.1:' + PORT);
  console.log('open:  http://127.0.0.1:8081/?api=http://127.0.0.1:' + PORT);
});
