const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')
const { BASE_URL } = require('../../utils/config')

Page({
  data: {
    strategy: '',
    knowledgePointName: '',
    quizzes: [],
    currentIndex: 0,
    current: null,
    optionList: [],
    selected: '',        // 已选选项
    submitted: false,    // 是否已提交本题
    isCorrect: false,
    correctAnswer: '',
    analysis: '',
    correctCount: 0,
    wrongCount: 0,
    finished: false
  },

  onLoad() {
    const payload = wx.getStorageSync('practice_payload') || {}
    const quizzes = payload.quizzes || []
    if (!quizzes.length) {
      wx.showToast({ title: '练习数据已失效', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 800)
      return
    }
    this.userId = getCurrentUserId()
    this.setData({
      strategy: payload.strategy || '专项练习',
      knowledgePointName: payload.knowledgePointName || '',
      quizzes
    })
    this.renderQuestion(0)
  },

  renderQuestion(index) {
    const quiz = this.data.quizzes[index]
    if (!quiz) {
      return
    }
    this.setData({
      currentIndex: index,
      current: quiz,
      optionList: [
        { key: 'A', text: quiz.optionA || '' },
        { key: 'B', text: quiz.optionB || '' },
        { key: 'C', text: quiz.optionC || '' },
        { key: 'D', text: quiz.optionD || '' }
      ],
      selected: '',
      submitted: false,
      isCorrect: false,
      correctAnswer: '',
      analysis: ''
    })
  },

  /** 选择选项（提交后不再允许改选） */
  selectOption(e) {
    if (this.data.submitted) {
      return
    }
    this.setData({ selected: e.currentTarget.dataset.ans })
  },

  /**
   * 提交本题。
   * 关键点：调用 /api/wrong-set/record —— 后端在该接口里会顺带重算知识点掌握度，
   * 所以答题行为会实时反映到诊断页，不需要额外同步。
   */
  submitAnswer() {
    const { selected, current } = this.data
    if (!selected || !current) {
      wx.showToast({ title: '请先选择答案', icon: 'none' })
      return
    }
    if (!this.userId) {
      wx.showToast({ title: '登录已失效', icon: 'none' })
      return
    }

    wx.showLoading({ title: '判卷中...' })
    wx.request({
      url: `${BASE_URL}/api/wrong-set/record`,
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: {
        userId: this.userId,
        quizId: current.id,
        selectedAnswer: selected
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          wx.showToast({ title: body.message || '提交失败', icon: 'none' })
          return
        }
        const result = body.data
        this.setData({
          submitted: true,
          isCorrect: !!result.correct,
          correctAnswer: result.correctAnswer || '',
          analysis: result.analysis || '',
          correctCount: this.data.correctCount + (result.correct ? 1 : 0),
          wrongCount: this.data.wrongCount + (result.correct ? 0 : 1)
        })
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  /** 下一题 / 结束 */
  nextQuestion() {
    const next = this.data.currentIndex + 1
    if (next >= this.data.quizzes.length) {
      this.setData({ finished: true })
      return
    }
    this.renderQuestion(next)
  },

  /** 结束练习，回诊断页看更新后的掌握度 */
  backToDiagnosis() {
    wx.navigateBack()
  }
})
