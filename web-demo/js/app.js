// ===========================================================================
//  app.js -- 网页演示版主逻辑
// ---------------------------------------------------------------------------
//  视图：登录 → 资讯 / 智能诊断 / 答题 / 排行榜
//  重点演示对象是「智能诊断」：知识点掌握度 + 薄弱点定位 + 个性化推荐练习。
// ===========================================================================

/* ---------------------------------- 工具 --------------------------------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

let toastTimer = null;
function toast(msg, isError) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'show' + (isError ? ' err' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, isError ? 4200 : 2200);
}

const LEVEL = {
  WEAK:       { text: '薄弱', color: '#e54d42', bg: '#fdeceb' },
  BASIC:      { text: '合格', color: '#f0a020', bg: '#fdf5e6' },
  PROFICIENT: { text: '熟练', color: '#19be6b', bg: '#e8f8f0' }
};

/* --------------------------------- 状态 ---------------------------------- */
const state = {
  user: null,
  view: 'diagnosis',
  newsCategory: '全部',
  practice: null
};

/* -------------------------------- 视图切换 -------------------------------- */
const VIEWS = ['diagnosis', 'practice', 'news', 'quiz', 'rank'];

function show(view) {
  state.view = view;
  VIEWS.forEach(v => {
    const el = $('#view-' + v);
    if (el) el.classList.toggle('active', v === view);
  });
  $$('.nav button').forEach(b => b.classList.toggle('active', b.dataset.view === view));
  $('#topbar').style.display = 'block';
}

/* --------------------------------- 登录 ---------------------------------- */
async function doLogin(username, password) {
  const btn = $('#loginBtn');
  btn.disabled = true;
  btn.textContent = '登录中...';
  try {
    const data = await API.login(username, password);
    if (!data || !data.userInfo) throw new Error('登录返回数据异常');

    state.user = data.userInfo;
    API.setUser(data.userInfo.id);

    $('#loginView').style.display = 'none';
    renderUserChip();
    show('diagnosis');
    await loadDiagnosis();
    toast('登录成功，已进入学习诊断报告');
  } catch (e) {
    toast(e.message, true);
  } finally {
    btn.disabled = false;
    btn.textContent = '登 录';
  }
}

function logout() {
  state.user = null;
  API.setUser(null);
  $('#loginView').style.display = 'flex';
  $('#topbar').style.display = 'none';
  VIEWS.forEach(v => { const el = $('#view-' + v); if (el) el.classList.remove('active'); });
}

function renderUserChip() {
  const u = state.user;
  $('#userChip').innerHTML =
    '<span class="avatar">' + esc((u.nickname || u.username || '?').charAt(0)) + '</span>' +
    '<span>' + esc(u.nickname || u.username) + '</span>';
  $('#userRole').textContent = (u.role === 1 ? '管理员' : '学生') + ' · ' + (u.points || 0) + ' 分';
}

/* ------------------------------ 智能诊断报告 ------------------------------ */
async function loadDiagnosis() {
  const host = $('#diagnosisContent');
  host.innerHTML = '<div class="loading">正在分析作答记录并生成诊断报告...</div>';
  try {
    const data = await API.diagnosis(state.user.id);
    renderDiagnosis(data);
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>诊断加载失败</b>' + esc(e.message) + '</div>';
  }
}

function renderDiagnosis(data) {
  const ov = data.overview || {};
  const items = data.items || [];
  const host = $('#diagnosisContent');

  if (!items.length) {
    host.innerHTML =
      '<div class="empty"><b>还没有诊断数据</b>' +
      '先去「答题」完成一次作业包，系统就会自动分析知识点掌握情况。<br>' +
      '诊断是实时联动的：答题后回到这里，数字会跟着变。</div>';
    return;
  }

  let html = '';

  // 概览
  html +=
    '<div class="overview">' +
      '<div class="ov-head">' +
        '<div class="ov-score"><span class="num">' + Number(ov.averageMastery || 0).toFixed(2) + '</span><span class="unit">分</span></div>' +
        '<div>' +
          '<div class="ov-label">综合掌握度</div>' +
          '<div class="ov-sub">已覆盖 ' + (ov.pointCount || 0) + ' 个知识点</div>' +
        '</div>' +
      '</div>' +
      '<div class="ov-stats">' +
        '<div class="ov-stat"><div class="n weak">' + (ov.weakCount || 0) + '</div><div class="l">薄弱</div></div>' +
        '<div class="ov-stat"><div class="n basic">' + (ov.basicCount || 0) + '</div><div class="l">合格</div></div>' +
        '<div class="ov-stat"><div class="n proficient">' + (ov.proficientCount || 0) + '</div><div class="l">熟练</div></div>' +
      '</div>' +
      '<div class="ov-summary">' + esc(ov.summary || '') + '</div>' +
    '</div>';

  // 推荐（取最薄弱的那个知识点）
  const weakest = items[0];
  html +=
    '<div class="card rec-card" style="margin-top:18px">' +
      '<div class="rec-head">' +
        '<span class="badge">智能推荐</span>' +
        '<span>最需要加强的知识点</span>' +
      '</div>' +
      '<div class="rec-target">当前薄弱知识点：<b>' + esc(weakest.name) + '</b>' +
        '（掌握度 ' + Number(weakest.mastery || 0).toFixed(2) + '）</div>' +
      '<div class="rec-desc">系统会从该知识点中挑选你尚未答对的题目组成专项练习，' +
        '答完立即更新掌握度。</div>' +
      '<div class="point-actions">' +
        '<button class="btn-primary" style="width:auto;padding:0 26px;height:40px" ' +
          'onclick="startPractice(' + weakest.knowledgePointId + ',\'' + esc(weakest.name).replace(/'/g, "\\'") + '\')">' +
          '开始专项练习</button>' +
      '</div>' +
    '</div>';

  // 知识点明细（由弱到强）
  html += '<div class="section-title">知识点掌握度明细（由弱到强）</div>';
  items.forEach(it => {
    const lv = LEVEL[it.level] || LEVEL.BASIC;
    const m = Number(it.mastery || 0);
    const acc = it.accuracy == null ? null : Math.round(Number(it.accuracy) * 100);
    const attempts = Number(it.attemptCount || 0);

    html +=
      '<div class="point-card">' +
        '<div class="point-head">' +
          '<div>' +
            '<div class="point-name">' + esc(it.name) +
              '<span class="pill" style="color:' + lv.color + ';background:' + lv.bg + '">' + lv.text + '</span>' +
            '</div>' +
            '<div class="point-cat">' + esc(it.category || '') + '</div>' +
          '</div>' +
          '<div class="point-mastery" style="color:' + lv.color + '">' + m.toFixed(2) + '</div>' +
        '</div>' +
        '<div class="bar"><i style="width:' + Math.max(2, Math.min(100, m)) + '%;background:' + lv.color + '"></i></div>' +
        '<div class="point-meta">' +
          (attempts > 0
            ? '已作答 ' + attempts + ' 题 · 正确率 ' + (acc == null ? '-' : acc + '%') +
              ' · 近期正确率 ' + (it.recentAccuracy == null ? '样本不足' : Math.round(Number(it.recentAccuracy) * 100) + '%')
            : '尚未练习该知识点') +
        '</div>' +
        (it.description ? '<div class="point-desc">' + esc(it.description) + '</div>' : '') +
        '<div class="point-actions">' +
          '<button class="btn-outline btn-sm" onclick="startPractice(' + it.knowledgePointId + ',\'' +
            esc(it.name).replace(/'/g, "\\'") + '\')">针对练习</button>' +
        '</div>' +
      '</div>';
  });

  host.innerHTML = html;
}

/* -------------------------------- 专项练习 -------------------------------- */
async function startPractice(knowledgePointId, pointName) {
  show('practice');
  const host = $('#practiceContent');
  host.innerHTML = '<div class="loading">正在生成专项练习...</div>';
  try {
    const data = await API.recommend(state.user.id, knowledgePointId, 5);
    const quizzes = data.quizzes || [];
    if (!quizzes.length) {
      host.innerHTML = '<div class="empty"><b>该知识点暂无可用题目</b>请换一个知识点试试。</div>';
      return;
    }
    state.practice = {
      strategy: data.strategy || '专项练习',
      pointName: pointName || data.knowledgePointName || '',
      quizzes,
      index: 0,
      selected: null,
      submitted: false,
      correct: 0,
      wrong: 0
    };
    renderPractice();
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>生成练习失败</b>' + esc(e.message) + '</div>';
  }
}

function renderPractice() {
  const p = state.practice;
  const host = $('#practiceContent');
  if (!p) { host.innerHTML = ''; return; }

  const total = p.quizzes.length;
  if (p.index >= total) { renderPracticeFinish(); return; }

  const q = p.quizzes[p.index];
  const opts = [['A', q.optionA], ['B', q.optionB], ['C', q.optionC], ['D', q.optionD]];
  const answer = String(q.answer || '').trim().toUpperCase();

  let html =
    '<div class="card">' +
      '<div class="practice-head">' +
        '<div>' +
          '<div style="font-weight:600">' + esc(p.strategy) + '</div>' +
          '<div style="font-size:12px;color:var(--brand);margin-top:2px">' + esc(p.pointName) + '</div>' +
        '</div>' +
        '<div style="color:var(--text-mute)">第 ' + (p.index + 1) + ' / ' + total + ' 题</div>' +
      '</div>' +
      '<div class="progress"><i style="width:' + ((p.index + 1) / total * 100) + '%"></i></div>' +
    '</div>';

  html += '<div class="card">' +
    '<div class="question">' + esc(q.question) + '</div>' +
    '<div class="options">';

  opts.forEach(([k, text]) => {
    let cls = 'option';
    if (p.submitted && k === answer) cls += ' correct locked';
    else if (p.submitted && k === p.selected) cls += ' wrong locked';
    else if (!p.submitted && k === p.selected) cls += ' selected';
    if (p.submitted) cls += ' locked';
    const click = p.submitted ? '' : ' onclick="selectOption(\'' + k + '\')"';
    html += '<div class="' + cls + '"' + click + '>' +
              '<span class="key">' + k + '</span><span>' + esc(text || '') + '</span>' +
            '</div>';
  });
  html += '</div>';

  if (p.submitted) {
    const ok = p.selected === answer;
    html += '<div class="result ' + (ok ? 'ok' : 'no') + '">' +
      '<h4>' + (ok ? '✅ 回答正确' : '❌ 回答错误，正确答案是 ' + answer) + '</h4>' +
      (q.analysis ? '<div class="ana"><b>解析</b>' + esc(q.analysis) + '</div>' : '') +
    '</div>';
  }

  html += '<div style="margin-top:20px">' +
    (p.submitted
      ? '<button class="btn-primary" style="width:auto;padding:0 32px" onclick="nextQuestion()">' +
        (p.index + 1 < total ? '下一题' : '完成练习') + '</button>'
      : '<button class="btn-primary" style="width:auto;padding:0 32px" onclick="submitAnswer()">提交答案</button>') +
    '<button class="btn-ghost" style="margin-left:10px" onclick="backToDiagnosis()">返回诊断报告</button>' +
  '</div>';

  html += '</div>';
  host.innerHTML = html;
}

function selectOption(key) {
  if (!state.practice || state.practice.submitted) return;
  state.practice.selected = key;
  renderPractice();
}

async function submitAnswer() {
  const p = state.practice;
  if (!p || !p.selected) { toast('请先选择一个答案', true); return; }
  const q = p.quizzes[p.index];
  try {
    const r = await API.recordAnswer(state.user.id, q.id, p.selected);
    p.submitted = true;
    if (r && r.correct) p.correct++; else p.wrong++;
    renderPractice();
  } catch (e) {
    toast(e.message, true);
  }
}

function nextQuestion() {
  const p = state.practice;
  p.index++;
  p.selected = null;
  p.submitted = false;
  renderPractice();
}

function renderPracticeFinish() {
  const p = state.practice;
  const total = p.correct + p.wrong;
  const rate = total ? Math.round(p.correct * 100 / total) : 0;
  $('#practiceContent').innerHTML =
    '<div class="card" style="text-align:center;padding:40px 20px">' +
      '<div style="font-size:17px;font-weight:600">练习完成</div>' +
      '<div style="margin-top:18px"><span style="font-size:52px;font-weight:700;color:var(--brand)">' +
        p.correct + '</span><span style="font-size:18px;color:var(--text-mute)"> / ' + total + '</span></div>' +
      '<div style="color:var(--text-mute);font-size:12.5px;margin-top:6px">本次正确率 ' + rate + '%</div>' +
      '<div class="ov-stats" style="background:#f7f9fc;margin-top:24px">' +
        '<div class="ov-stat"><div class="n" style="color:var(--proficient)">' + p.correct + '</div><div class="l" style="color:var(--text-mute)">答对</div></div>' +
        '<div class="ov-stat"><div class="n" style="color:var(--weak)">' + p.wrong + '</div><div class="l" style="color:var(--text-mute)">答错</div></div>' +
      '</div>' +
      '<div style="margin-top:24px;color:var(--text-mute);font-size:12.5px">' +
        '掌握度已实时更新，返回诊断页即可看到最新结果。</div>' +
      '<div style="margin-top:18px">' +
        '<button class="btn-primary" style="width:auto;padding:0 32px" onclick="backToDiagnosis()">返回诊断报告</button>' +
      '</div>' +
    '</div>';
}

async function backToDiagnosis() {
  show('diagnosis');
  await loadDiagnosis();
}

/* --------------------------------- 资讯 ---------------------------------- */
const CATEGORIES = ['全部', '竞赛信息', '安全动态', '系统公告', '网络安全活动'];

async function loadNews() {
  const host = $('#newsList');
  host.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const cat = state.newsCategory === '全部' ? '' : state.newsCategory;
    const list = await API.newsList(cat);
    renderNews(list || []);
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>加载失败</b>' + esc(e.message) + '</div>';
  }
}

function renderNews(list) {
  const host = $('#newsList');
  if (!list.length) {
    host.innerHTML = '<div class="empty"><b>该分类下暂无资讯</b>换个分类看看。</div>';
    return;
  }
  host.innerHTML = list.map(n =>
    '<div class="news-item" onclick="openNews(' + n.id + ')">' +
      '<div class="news-title">' + esc(n.title) + '</div>' +
      '<div class="news-meta">' +
        (n.category ? '<span class="tag' + (n.isCompetition ? ' comp' : '') + '">' + esc(n.category) + '</span>' : '') +
        '<span>' + esc(n.author || '') + '</span>' +
        '<span>' + esc(n.createTime || '') + '</span>' +
      '</div>' +
      '<div class="news-body">' + esc(n.content || '') + '</div>' +
    '</div>'
  ).join('');
}

async function openNews(id) {
  try {
    const n = await API.newsDetail(id);
    const canRegister = n.category === '竞赛信息' || n.category === '网络安全活动';
    $('#newsDetailBody').innerHTML =
      '<h2 style="font-size:18px;margin-bottom:10px">' + esc(n.title) + '</h2>' +
      '<div class="news-meta" style="margin-bottom:16px">' +
        (n.category ? '<span class="tag">' + esc(n.category) + '</span>' : '') +
        '<span>' + esc(n.author || '') + '</span><span>' + esc(n.createTime || '') + '</span>' +
      '</div>' +
      '<div style="font-size:13.5px;line-height:1.9;color:#444;white-space:pre-wrap">' + esc(n.content || '') + '</div>' +
      (canRegister
        ? '<div style="margin-top:22px"><button class="btn-primary" style="width:auto;padding:0 28px" ' +
          'onclick="signUp(' + n.id + ')">立即报名</button></div>'
        : '');
    $('#newsModal').classList.add('show');
  } catch (e) {
    toast(e.message, true);
  }
}

async function signUp(newsId) {
  try {
    await API.registerActivity(newsId, state.user.id);
    toast('报名成功');
    $('#newsModal').classList.remove('show');
  } catch (e) {
    toast(e.message, true);
  }
}

function closeNewsModal() { $('#newsModal').classList.remove('show'); }

async function searchNews() {
  const kw = ($('#searchInput').value || '').trim();
  if (!kw) { loadNews(); return; }
  const host = $('#newsList');
  host.innerHTML = '<div class="loading">搜索中...</div>';
  try {
    let list = await API.newsSearch(kw);
    if (state.newsCategory !== '全部') {
      list = (list || []).filter(n => n.category === state.newsCategory);
    }
    renderNews(list || []);
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>搜索失败</b>' + esc(e.message) + '</div>';
  }
}

/* --------------------------------- 答题 ---------------------------------- */
async function loadPapers() {
  const host = $('#paperList');
  host.innerHTML = '<div class="loading">加载作业包...</div>';
  try {
    const papers = await API.paperList();
    if (!papers || !papers.length) {
      host.innerHTML = '<div class="empty"><b>暂无作业包</b>请先用管理员账号在后台创建。</div>';
      return;
    }
    host.innerHTML = papers.map(p =>
      '<div class="point-card" style="display:flex;align-items:center;justify-content:space-between;gap:14px">' +
        '<div><div class="point-name">' + esc(p.title) + '</div>' +
        '<div class="point-cat">作业包 ID：' + p.id + '</div></div>' +
        '<button class="btn-outline btn-sm" onclick="openPaper(' + p.id + ')">开始答题</button>' +
      '</div>'
    ).join('');
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>加载失败</b>' + esc(e.message) + '</div>';
  }
}

async function openPaper(paperId) {
  const host = $('#paperList');
  host.innerHTML = '<div class="loading">加载题目...</div>';
  try {
    const quizzes = await API.paperQuizzes(paperId);
    state.paper = { paperId, quizzes: quizzes || [], index: 0, selected: null, submitted: false, correct: 0 };
    renderPaperQuestion();
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>加载失败</b>' + esc(e.message) + '</div>';
  }
}

function renderPaperQuestion() {
  const s = state.paper;
  const host = $('#paperList');
  if (!s || !s.quizzes.length) { host.innerHTML = '<div class="empty">该作业包暂无题目</div>'; return; }

  if (s.index >= s.quizzes.length) {
    host.innerHTML =
      '<div class="card" style="text-align:center;padding:36px 20px">' +
        '<div style="font-size:17px;font-weight:600">作业包已完成</div>' +
        '<div style="margin-top:16px"><span style="font-size:46px;font-weight:700;color:var(--brand)">' +
          s.correct + '</span><span style="color:var(--text-mute)"> / ' + s.quizzes.length + '</span></div>' +
        '<div style="margin-top:20px"><button class="btn-primary" style="width:auto;padding:0 28px" ' +
          'onclick="finishPaper()">提交并领取积分</button></div>' +
        '<div style="margin-top:12px;color:var(--text-mute);font-size:12.5px">' +
          '提交后积分 +20，并自动更新知识掌握度</div>' +
      '</div>';
    return;
  }

  const q = s.quizzes[s.index];
  const opts = [['A', q.optionA], ['B', q.optionB], ['C', q.optionC], ['D', q.optionD]];
  const answer = String(q.answer || '').trim().toUpperCase();

  let html = '<div class="card">' +
    '<div class="practice-head"><div style="font-weight:600">作业包答题</div>' +
    '<div style="color:var(--text-mute)">第 ' + (s.index + 1) + ' / ' + s.quizzes.length + ' 题</div></div>' +
    '<div class="progress"><i style="width:' + ((s.index + 1) / s.quizzes.length * 100) + '%"></i></div>' +
    '</div><div class="card">' +
    '<div class="question">' + esc(q.question) + '</div><div class="options">';

  opts.forEach(([k, text]) => {
    let cls = 'option';
    if (s.submitted && k === answer) cls += ' correct locked';
    else if (s.submitted && k === s.selected) cls += ' wrong locked';
    else if (!s.submitted && k === s.selected) cls += ' selected';
    if (s.submitted) cls += ' locked';
    const click = s.submitted ? '' : ' onclick="selectPaperOption(\'' + k + '\')"';
    html += '<div class="' + cls + '"' + click + '><span class="key">' + k + '</span><span>' +
            esc(text || '') + '</span></div>';
  });
  html += '</div>';

  if (s.submitted) {
    const ok = s.selected === answer;
    html += '<div class="result ' + (ok ? 'ok' : 'no') + '"><h4>' +
      (ok ? '✅ 回答正确' : '❌ 回答错误，正确答案是 ' + answer) + '</h4>' +
      (q.analysis ? '<div class="ana"><b>解析</b>' + esc(q.analysis) + '</div>' : '') + '</div>';
  }

  html += '<div style="margin-top:20px">' +
    (s.submitted
      ? '<button class="btn-primary" style="width:auto;padding:0 32px" onclick="nextPaperQuestion()">' +
        (s.index + 1 < s.quizzes.length ? '下一题' : '查看结果') + '</button>'
      : '<button class="btn-primary" style="width:auto;padding:0 32px" onclick="submitPaperAnswer()">提交答案</button>') +
    '</div></div>';

  host.innerHTML = html;
}

function selectPaperOption(k) {
  if (!state.paper || state.paper.submitted) return;
  state.paper.selected = k;
  renderPaperQuestion();
}

async function submitPaperAnswer() {
  const s = state.paper;
  if (!s.selected) { toast('请先选择答案', true); return; }
  const q = s.quizzes[s.index];
  try {
    const r = await API.recordAnswer(state.user.id, q.id, s.selected);
    s.submitted = true;
    if (r && r.correct) s.correct++;
    renderPaperQuestion();
  } catch (e) {
    toast(e.message, true);
  }
}

function nextPaperQuestion() {
  state.paper.index++;
  state.paper.selected = null;
  state.paper.submitted = false;
  renderPaperQuestion();
}

async function finishPaper() {
  try {
    await API.submitPaper(state.user.id);
    toast('作业完成，积分 +20！');
    const u = await API.userInfo(state.user.id);
    state.user = u;
    renderUserChip();
    loadPapers();
  } catch (e) {
    toast(e.message, true);
  }
}

/* -------------------------------- 排行榜 --------------------------------- */
async function loadRank() {
  const host = $('#rankList');
  host.innerHTML = '<div class="loading">加载中...</div>';
  try {
    const list = await API.leaderboard();
    if (!list || !list.length) { host.innerHTML = '<div class="empty">暂无排行数据</div>'; return; }
    host.innerHTML =
      '<div class="card">' +
      list.map((u, i) => {
        const cls = i === 0 ? 'top1' : i === 1 ? 'top2' : i === 2 ? 'top3' : '';
        const me = state.user && u.id === state.user.id;
        return '<div class="rank-row">' +
          '<div class="rank-no ' + cls + '">' + (i + 1) + '</div>' +
          '<div class="rank-name' + (me ? ' style="font-weight:700;color:#2b5cff"' : '') + '">' +
            esc(u.nickname || u.username) + (me ? '（我）' : '') + '</div>' +
          '<div class="rank-pts">' + (u.points || 0) + '</div>' +
        '</div>';
      }).join('') +
      '</div>';
  } catch (e) {
    host.innerHTML = '<div class="empty"><b>加载失败</b>' + esc(e.message) + '</div>';
  }
}

/* --------------------------------- 初始化 -------------------------------- */
function init() {
  // 登录表单
  $('#loginForm').addEventListener('submit', ev => {
    ev.preventDefault();
    doLogin($('#username').value.trim(), $('#password').value.trim());
  });

  // 演示账号一键填充
  $$('.demo-account-row button').forEach(b => {
    b.addEventListener('click', () => {
      $('#username').value = b.dataset.user;
      $('#password').value = b.dataset.pass;
      toast('已填入 ' + b.dataset.user + '，点击登录');
    });
  });

  // 导航
  $$('.nav button').forEach(b => {
    b.addEventListener('click', () => {
      const v = b.dataset.view;
      if (v === 'diagnosis') { show(v); loadDiagnosis(); }
      else if (v === 'news') { show(v); loadNews(); }
      else if (v === 'quiz') { show(v); loadPapers(); }
      else if (v === 'rank') { show(v); loadRank(); }
      else show(v);
    });
  });

  // 资讯分类
  $('#categoryChips').innerHTML = CATEGORIES.map((c, i) =>
    '<button class="chip' + (i === 0 ? ' active' : '') + '" data-cat="' + c + '">' + c + '</button>'
  ).join('');
  $$('#categoryChips .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      $$('#categoryChips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.newsCategory = chip.dataset.cat;
      loadNews();
    });
  });

  // 后端地址提示
  $('#apiBase').textContent = API.base();

  $('#topbar').style.display = 'none';
  $('#loginView').style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', init);
