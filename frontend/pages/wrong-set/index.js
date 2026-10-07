const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')

Page({
  data: {
    wrongList: []
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadWrongList()
  },

  loadWrongList() {
    const userId = getCurrentUserId()
    if (!userId) {
      return
    }
    wx.request({
      url: `http://127.0.0.1:8080/api/wrong-set/list?userId=${userId}`,
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          this.setData({ wrongList: body.data || [] })
          return
        }
        wx.showToast({ title: body.message || '加载失败', icon: 'none' })
      }
    })
  },

  redoAnswer(e) {
    const wrongId = Number(e.currentTarget.dataset.id)
    const selectedAnswer = e.currentTarget.dataset.ans
    const userId = getCurrentUserId()
    if (!wrongId || !userId) {
      return
    }

    wx.request({
      url: 'http://127.0.0.1:8080/api/wrong-set/resolve',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: { wrongId, userId, selectedAnswer },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          wx.showToast({ title: body.message || '提交失败', icon: 'none' })
          return
        }

        if (body.data.correct) {
          wx.showToast({ title: '回答正确，已移除', icon: 'success' })
          const nextList = this.data.wrongList.filter(item => item.wrongId !== wrongId)
          this.setData({ wrongList: nextList })
          return
        }
        wx.showToast({
          title: `回答错误，答案：${body.data.correctAnswer || ''}`,
          icon: 'none'
        })
      }
    })
  }
})
