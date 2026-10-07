// ===========================================================================
//  push-via-api.js -- 通过 GitHub API 上传文件（git push 被网络阻断时的替代方案）
// ---------------------------------------------------------------------------
//  为什么需要这个脚本：
//     国内网络直连 github.com 的 443 经常被重置，git push 会失败：
//         fatal: unable to access ... Failed to connect to github.com port 443
//         schannel: failed to receive handshake, SSL/TLS connection failed
//     但 GitHub CLI（gh）走的是另一条通道，通常还能通。
//     所以用 `gh api` 直接调 GitHub 的 Git Data API：
//     自己创建 blob → tree → commit → 更新分支引用。
//
//  用法：
//      node tools/push-via-api.js <owner/repo> [branch]
//      例：node tools/push-via-api.js jayyuziyang-lang/CyberSecurity main
//
//  注意：
//     这是「上传当前文件内容」，不是上传 git 历史。
//      本地 .git 里的历史不会同步过去 —— 交付够用；
//      想要完整历史，等网络好时在本机执行一次 git push 即可。
//
//  注意：空仓库（尚无任何提交）时，读取 ref 会返回 409，
//        这里把它当成「分支还没建」来处理，而不是致命错误。
// ===========================================================================

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = process.argv[2];
const BRANCH = process.argv[3] || 'main';
if (!REPO || !REPO.includes('/')) {
  console.error('用法: node tools/push-via-api.js <owner/repo> [branch]');
  process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');

// 不传的文件/目录（与 .gitignore 保持一致）
const EXCLUDE_DIRS = new Set(['.git', 'node_modules', 'target', '.idea']);
const EXCLUDE_FILES = [/\.iml$/, /\.log$/];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (EXCLUDE_DIRS.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else {
      if (EXCLUDE_FILES.some(re => re.test(e.name))) continue;
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

// 调用 gh api。
//
// 两个坑（都是实测踩出来的）：
//   1) 请求体不能走 `--input -`（stdin）。
//      建 tree 时 payload 有 28KB，通过 Node 管道喂给 gh 会失败并返回
//      「Not Found (HTTP 404)」这种完全误导人的错误。改成写临时文件再
//      用 `--input <file>` 就正常了。
//   2) 国内网络下 GitHub API 偶发 404/5xx，这些操作都可以安全重试。
function ghApi(endpoint, method, bodyObj, retries = 3) {
  const args = ['api', endpoint, '--method', method];
  let tmpFile = null;

  if (bodyObj !== undefined) {
    tmpFile = path.join(
      require('os').tmpdir(),
      `ghapi-${process.pid}-${Math.random().toString(36).slice(2)}.json`
    );
    fs.writeFileSync(tmpFile, JSON.stringify(bodyObj), 'utf8');
    args.push('--input', tmpFile);
  }

  try {
    let lastErr = null;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const out = execFileSync('gh', args, {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
          stdio: ['ignore', 'pipe', 'pipe']
        });
        return out.trim() ? JSON.parse(out) : null;
      } catch (e) {
        lastErr = e;
        const msg = (e.stderr || e.message || '').toString();
        const retryable = /404|500|502|503|504|timed? ?out|reset|EOF|unexpected/i.test(msg);
        if (!retryable || attempt === retries) break;
        const waitMs = attempt * 1500;
        process.stderr.write(
          `\n  [重试 ${attempt}/${retries - 1}] ${endpoint} -> ${msg.split('\n')[0].slice(0, 70)} (等 ${waitMs}ms)\n`
        );
        sleepSync(waitMs);
      }
    }
    throw lastErr;
  } finally {
    if (tmpFile) { try { fs.unlinkSync(tmpFile); } catch (_) { /* ignore */ } }
  }
}

// 同步睡眠：ghApi 是同步函数，用 Atomics.wait 实现（不需要额外依赖）
function sleepSync(ms) {
  const sab = new SharedArrayBuffer(4);
  Atomics.wait(new Int32Array(sab), 0, 0, ms);
}

// 并发执行，limit 控制同时进行的请求数（gh api 是独立进程，别开太多）
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

(async () => {
  console.log(`仓库: ${REPO}   分支: ${BRANCH}`);

  // 1) 分支当前 commit。
  //    坑：在「完全空的仓库」上，连 git/blobs 都会返回 409 Git Repository is empty。
  //    所以必须先用 Contents API 建一个初始提交把仓库激活，
  //    之后才能正常用 Git Data API。
  let parentSha = null;
  try {
    const ref = ghApi(`repos/${REPO}/git/ref/heads/${BRANCH}`, 'GET');
    parentSha = ref.object.sha;
    console.log(`  当前 HEAD: ${parentSha.slice(0, 7)}`);
  } catch (e) {
    const msg = (e.stderr || e.message || '').toString();
    if (!/409|404|empty|Not Found/i.test(msg)) throw e;

    console.log('  仓库是空的，先用 Contents API 建一个初始提交...');
    const boot = ghApi(`repos/${REPO}/contents/.gitkeep`, 'PUT', {
      message: '初始化仓库',
      content: Buffer.from('').toString('base64'),
      branch: BRANCH
    });
    parentSha = boot.commit.sha;
    console.log(`  初始提交已创建: ${parentSha.slice(0, 7)}`);
  }

  // 2) 并发创建 blob
  //
  //    ⚠️ 坑：路径在 .github/workflows/ 下的文件【不能】放进 tree。
  //    GitHub 对 workflow 文件的创建有额外限制，实测只要 tree 里出现
  //    ".github/workflows/xxx.yml"，整个 POST /git/trees 就返回
  //    「Not Found (HTTP 404)」—— 报错信息完全误导人，很容易以为是
  //    路径写错或权限问题。所以这部分文件单独走 Contents API 提交。
  const allFiles = walk(ROOT);
  const isWorkflow = (rel) => rel.startsWith('.github/workflows/');
  const files = allFiles.filter(f => !isWorkflow(path.relative(ROOT, f).split(path.sep).join('/')));
  const workflowFiles = allFiles.filter(f => isWorkflow(path.relative(ROOT, f).split(path.sep).join('/')));

  console.log(`  待上传文件: ${files.length} 个（另有 ${workflowFiles.length} 个 workflow 单独提交）`);

  let done = 0;
  const tree = await mapLimit(files, 6, async (abs) => {
    const rel = path.relative(ROOT, abs).split(path.sep).join('/');
    const content = fs.readFileSync(abs);
    const blob = ghApi(`repos/${REPO}/git/blobs`, 'POST', {
      content: content.toString('base64'),
      encoding: 'base64'
    });
    done++;
    if (done % 20 === 0 || done === files.length) {
      process.stdout.write(`\r  已上传 ${done}/${files.length} 个文件`);
    }
    return { path: rel, mode: '100644', type: 'blob', sha: blob.sha };
  });
  console.log('');

  // 3) 建 tree。注意 deliberately 不加 base_tree：
  //    初始提交里那个占位 .gitkeep 就不需要单独删了，新 tree 直接覆盖整棵树。
  const newTree = ghApi(`repos/${REPO}/git/trees`, 'POST', { tree });
  console.log(`  tree 已创建:   ${newTree.sha.slice(0, 7)}`);

  // 4) 建 commit
  const commit = ghApi(`repos/${REPO}/git/commits`, 'POST', {
    message: '上传项目源码：微信小程序 + Spring Boot + 知识点掌握度智能诊断\n\n' +
             '（git push 被网络阻断，改用 Git Data API 上传）',
    tree: newTree.sha,
    parents: [parentSha]
  });
  console.log(`  commit 已创建: ${commit.sha.slice(0, 7)}`);

  // 5) 更新分支引用
  ghApi(`repos/${REPO}/git/refs/heads/${BRANCH}`, 'PATCH', { sha: commit.sha, force: true });
  console.log(`  分支 ${BRANCH} 已更新`);

  // 6) workflow 文件单独用 Contents API 提交
  //    （原因见上面第 2 步的注释：放进 tree 会让整个请求 404）
  if (workflowFiles.length) {
    console.log(`\n  提交 ${workflowFiles.length} 个 workflow 文件...`);
    for (const abs of workflowFiles) {
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      // Contents API 需要知道文件是否已存在（存在则必须带 sha 才能覆盖）
      let existingSha = null;
      try {
        const cur = ghApi(`repos/${REPO}/contents/${rel}?ref=${BRANCH}`, 'GET');
        existingSha = cur.sha;
      } catch (_) { /* 不存在，创建即可 */ }

      const body = {
        message: `添加 ${rel}`,
        content: fs.readFileSync(abs).toString('base64'),
        branch: BRANCH
      };
      if (existingSha) body.sha = existingSha;
      ghApi(`repos/${REPO}/contents/${rel}`, 'PUT', body);
      console.log(`    ✓ ${rel}`);
    }
  }

  console.log('');
  console.log(`完成 → https://github.com/${REPO}/tree/${BRANCH}`);
})().catch(err => {
  const msg = (err.stderr || err.message || '').toString();
  console.error('\n失败: ' + msg.slice(0, 800));
  process.exit(1);
});
