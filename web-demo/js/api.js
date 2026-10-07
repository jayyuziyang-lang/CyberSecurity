// ===========================================================================
//  api.js -- 后端接口封装
// ---------------------------------------------------------------------------
//  后端地址按以下优先级确定（第一个非空者胜出）：
//
//    1. URL 参数      ?api=https://xxx.onrender.com
//         —— 临时指向别的后端，不改代码就能切环境
//    2. config.js     window.API_CONFIG.BASE_URL
//         —— 部署到 GitHub Pages 时用它填云端后端地址
//            （Pages 只有静态文件，后端在 Railway/Render 上，两者不同源，
//             所以必须显式指定，不能靠同源）
//    3. 同源
//         —— 本地开发 / 内网 IP / 内网穿透场景，谁托管页面谁就是后端
//            （web-demo/serve_demo.js 会把 /api 反代到后端）
//
//  这条链路的意义：同一份代码，既能本地一键跑，也能部署到云端。
// ===========================================================================

const API = (() => {
  const params = new URLSearchParams(location.search);
  const override = params.get('api');
  const fromConfig = (window.API_CONFIG && window.API_CONFIG.BASE_URL) || '';
  const BASE = (override || fromConfig || '').replace(/\/+$/, '');

  let userId = null;

  function setUser(id) { userId = id; }
  function getUser() { return userId; }

  function headers(extra) {
    const h = Object.assign({}, extra || {});
    if (userId) h['X-User-Id'] = String(userId);
    return h;
  }

  async function request(path, options) {
    const opt = options || {};
    const init = {
      method: opt.method || 'GET',
      headers: headers(opt.body ? { 'Content-Type': 'application/json' } : {})
    };
    if (opt.body) init.body = JSON.stringify(opt.body);

    let url = BASE + path;
    if (opt.query) {
      const qs = new URLSearchParams();
      Object.keys(opt.query).forEach(k => {
        if (opt.query[k] !== undefined && opt.query[k] !== null && opt.query[k] !== '') {
          qs.append(k, opt.query[k]);
        }
      });
      const s = qs.toString();
      if (s) url += (url.includes('?') ? '&' : '?') + s;
    }

    let res;
    try {
      res = await fetch(url, init);
    } catch (e) {
      throw new Error('无法连接后端（' + url + '）。请确认后端已启动，且地址可达。');
    }

    let body = null;
    try { body = await res.json(); } catch (e) { /* 非 JSON 响应 */ }

    if (!body || typeof body.code === 'undefined') {
      throw new Error('后端返回格式异常（HTTP ' + res.status + '）');
    }
    if (body.code !== 200) {
      throw new Error(body.message || ('请求失败（code=' + body.code + '）'));
    }
    return body.data;
  }

  return {
    setUser, getUser,
    base: () => BASE || location.origin,

    login: (username, password) =>
      request('/api/user/login', { method: 'POST', body: { username, password } }),

    register: (username, password) =>
      request('/api/user/register', { method: 'POST', body: { username, password } }),

    userInfo: (id) => request('/api/user/info/' + id),
    leaderboard: () => request('/api/user/leaderboard'),

    newsList: (category) => request('/api/news/list', { query: { category } }),
    newsDetail: (id) => request('/api/news/get/' + id),
    newsSearch: (keyword) => request('/api/news/search', { query: { keyword } }),
    registerActivity: (newsId, uid) =>
      request('/api/registration/submit', { method: 'POST', body: { newsId, userId: uid } }),

    paperList: () => request('/api/paper/list'),
    paperQuizzes: (paperId) => request('/api/paper/quizzes/' + paperId),

    submitPaper: (uid) => request('/api/quiz/submit', { method: 'POST', body: { userId: uid } }),
    recordAnswer: (uid, quizId, selectedAnswer) =>
      request('/api/wrong-set/record', { method: 'POST', body: { userId: uid, quizId, selectedAnswer } }),
    wrongList: (uid) => request('/api/wrong-set/list', { query: { userId: uid } }),

    diagnosis: (uid) => request('/api/intelligent/diagnosis/' + uid),
    weakPoints: (uid, limit) => request('/api/intelligent/weak-points', { query: { userId: uid, limit } }),
    recommend: (uid, knowledgePointId, limit) =>
      request('/api/intelligent/recommend', { query: { userId: uid, knowledgePointId, limit } }),
    knowledgePoints: () => request('/api/intelligent/knowledge-points')
  };
})();
