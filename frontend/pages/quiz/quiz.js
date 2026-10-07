const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')

Page({
  data: {
    paperId: null,
    paperTitle: '',
    quizzes: [],
    currentIndex: 0,
    totalScore: 0,
    selectedAnswers: {},
    submitting: false,
    loading: false,
    finished: false
  },

  onLoad(options) {
    const paperId = Number((options || {}).paperId)
    const paperTitle = options && options.paperTitle ? decodeURIComponent(options.paperTitle) : ''
    if (!paperId) {
      wx.showToast({ title: '作业包无效', icon: 'none' })
      setTimeout(() => {
        wx.navigateBack()
      }, 500)
      return
    }
    this.setData({ paperId, paperTitle })
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    if (!this.data.paperId) {
      return
    }
    this.loadQuizzesByPaper()
  },

  loadQuizzesByPaper() {
    this.setData({ loading: true })
    wx.request({
      url: `http://127.0.0.1:8080/api/paper/quizzes/${this.data.paperId}`,
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '题目加载失败', icon: 'none' })
          return
        }
        this.setData({
          quizzes: body.data || [],
          currentIndex: 0,
          totalScore: 0,
          selectedAnswers: {},
          submitting: false,
          finished: false
        })
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  selectOption(e) {
    const selected = e.currentTarget.dataset.ans
    const { quizzes, currentIndex, selectedAnswers } = this.data
    const currentQuiz = quizzes[currentIndex]
    if (!currentQuiz || !selected) {
      return
    }

    const nextAnswers = {
      ...selectedAnswers,
      [currentIndex]: selected
    }

    if (currentIndex < quizzes.length - 1) {
      this.setData({
        selectedAnswers: nextAnswers,
        currentIndex: currentIndex + 1
      })
      return
    }

    this.setData({ selectedAnswers: nextAnswers })
  },

  submitPaper() {
    if (this.data.submitting) {
      return
    }

    const userId = getCurrentUserId()
    if (!userId) {
      wx.showToast({ title: '登录已过期，请重新登录', icon: 'none' })
      return
    }

    const { paperId, quizzes, selectedAnswers } = this.data
    if (!Array.isArray(quizzes) || quizzes.length === 0) {
      return
    }

    const missingIndex = quizzes.findIndex((_, index) => !selectedAnswers[index])
    if (missingIndex >= 0) {
      wx.showToast({ title: `请完成第 ${missingIndex + 1} 题`, icon: 'none' })
      this.setData({ currentIndex: missingIndex })
      return
    }

    this.setData({ submitting: true })
    this.submitCompletion(userId, quizzes, selectedAnswers)
  },

  recordAnswer(userId, quizId, selectedAnswer) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: 'http://127.0.0.1:8080/api/wrong-set/record',
        method: 'POST',
        header: getAuthHeaders({ 'content-type': 'application/json' }),
        data: { userId, quizId, selectedAnswer },
        success: (res) => {
          const body = res.data || {}
          if (res.statusCode === 200 && body.code === 200) {
            resolve(body.data)
            return
          }
          reject()
        },
        fail: reject
      })
    })
  },

  submitCompletion(userId, quizzes, selectedAnswers) {
    wx.request({
      url: 'http://127.0.0.1:8080/api/quiz/submit',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: { userId },
      success: (res) => {
        const body = res.data || {}
        if (res.statusCode !== 200 || body.code !== 200) {
          wx.showToast({ title: body.message || '提交失败', icon: 'none' })
          return
        }

        this.setData({ finished: true })
        Promise.all(quizzes.map((quiz, index) => this.recordAnswer(
          userId,
          quiz.id,
          selectedAnswers[index]
        )))
          .then(() => {
            wx.showToast({ title: '作业完成，积分 +20！', icon: 'success' })
            this.returnToPaperList()
          })
          .catch(() => {
            wx.showToast({ title: '已加分，错题记录失败', icon: 'none' })
            this.returnToPaperList()
          })
      },
      fail: () => {
        wx.showToast({ title: '提交失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ submitting: false })
      }
    })
  },

  returnToPaperList() {
    setTimeout(() => {
      wx.switchTab({ url: '/pages/index/index' })
    }, 1500)
  }
})
