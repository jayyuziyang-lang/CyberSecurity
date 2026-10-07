const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')
const { BASE_URL } = require('../../utils/config')

// 掌握度分级配色，与后端 WEAK/BASIC/PROFICIENT 对应
const LEVEL_STYLE = {
  WEAK: { text: '薄弱', color: '#e54d42', bg: '#fdeceb' },
  BASIC: { text: '合格', color: '#f0a020', bg: '#fdf5e6' },
  PROFICIENT: { text: '熟练', color: '#19be6b', bg: '#e8f8f0' }
}

Page({
  data: {
    loading: false,
    overview: null,
    items: [],
    weakPoints: [],
    recommend: null,
    hasData: false
  },

  onLoad() {
    const userId = getCurrentUserId()
    if (!userId) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.userId = userId
  },

  onShow() {
    if (!this.userId) {
      return
    }
    this.loadDiagnosis()
  },

  onPullDownRefresh() {
    this.loadDiagnosis(() => wx.stopPullDownRefresh())
  },

  /**
   * 拉取诊断报告 + 薄弱知识点 + 推荐练习。
   * 后端在 /diagnosis 里会先按最新作答记录重算掌握度，所以每次进页面都是实时数据。
   */
  loadDiagnosis(done) {
    this.setData({ loading: true })
    const userId = this.userId

    wx.request({
      url: `${BASE_URL}/api/intelligent/diagnosis/${userId}`,
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          wx.showToast({ title: body.message || '诊断加载失败', icon: 'none' })
          return
        }
        const { overview, items } = body.data
        const decorated = (items || []).map(item => this.decorate(item))

        this.setData({
          overview,
          items: decorated,
          hasData: decorated.length > 0
        })
      },
      fail: () => {
        wx.showToast({ title: '网络异常，请确认后端已启动', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
        this.loadRecommend(done)
      }
    })
  },

  /** 给单个知识点补上展示用的派生字段 */
  decorate(item) {
    const style = LEVEL_STYLE[item.level] || LEVEL_STYLE.BASIC
    const mastery = Number(item.mastery || 0)
    const accuracy = item.accuracy == null ? null : Math.round(Number(item.accuracy) * 100)
    return {
      ...item,
      mastery,
      masteryText: mastery.toFixed(1),
      levelText: style.text,
      levelColor: style.color,
      levelBg: style.bg,
      barWidth: Math.max(2, Math.min(100, mastery)),
      accuracyText: accuracy == null ? '-' : accuracy + '%',
      hasAttempt: Number(item.attemptCount || 0) > 0
    }
  },

  /** 推荐练习：不传 knowledgePointId，由后端挑最薄弱的知识点 */
  loadRecommend(done) {
    wx.request({
      url: `${BASE_URL}/api/intelligent/recommend`,
      method: 'GET',
      header: getAuthHeaders(),
      data: { userId: this.userId, limit: 5 },
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200 && body.data) {
          const data = body.data
          this.setData({
            recommend: {
              ...data,
              count: (data.quizzes || []).length
            }
          })
        }
      },
      complete: () => {
        if (typeof done === 'function') {
          done()
        }
      }
    })
  },

  /** 进入推荐练习 */
  startRecommend() {
    const recommend = this.data.recommend
    const quizzes = (recommend && recommend.quizzes) || []
    if (!quizzes.length) {
      wx.showToast({ title: '暂无推荐题目', icon: 'none' })
      return
    }
    wx.setStorageSync('practice_payload', {
      strategy: recommend.strategy,
      knowledgePointName: recommend.knowledgePointName || '综合练习',
      quizzes
    })
    wx.navigateTo({ url: '/pages/intelligent/practice' })
  },

  /** 针对某个知识点做专项练习 */
  startPointPractice(e) {
    const pointId = e.currentTarget.dataset.id
    const pointName = e.currentTarget.dataset.name || ''
    if (!pointId) {
      return
    }
    wx.showLoading({ title: '正在生成练习...' })
    wx.request({
      url: `${BASE_URL}/api/intelligent/recommend`,
      method: 'GET',
      header: getAuthHeaders(),
      data: { userId: this.userId, knowledgePointId: pointId, limit: 5 },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          wx.showToast({ title: body.message || '生成失败', icon: 'none' })
          return
        }
        const quizzes = body.data.quizzes || []
        if (!quizzes.length) {
          wx.showToast({ title: '该知识点暂无题目', icon: 'none' })
          return
        }
        wx.setStorageSync('practice_payload', {
          strategy: '知识点专项练习',
          knowledgePointName: pointName,
          quizzes
        })
        wx.navigateTo({ url: '/pages/intelligent/practice' })
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  /** 去错题本 */
  goWrongSet() {
    wx.navigateTo({ url: '/pages/wrong-set/wrong-set' })
  }
})
