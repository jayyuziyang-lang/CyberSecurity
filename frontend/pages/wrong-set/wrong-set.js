const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')

Page({
  data: {
    loading: false,
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
      this.setData({ wrongList: [] })
      return
    }

    this.setData({ loading: true })
    wx.request({
      url: `http://127.0.0.1:8080/api/wrong-set/list?userId=${userId}`,
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '加载失败', icon: 'none' })
          return
        }
        const list = (body.data || []).map(item => this.formatWrongItem(item))
        this.setData({ wrongList: list })
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  toggleItem(e) {
    const wrongId = Number(e.currentTarget.dataset.id)
    if (!wrongId) return
    const index = this.data.wrongList.findIndex(item => item.wrongId === wrongId)
    if (index < 0) return
    const key = `wrongList[${index}].expanded`
    this.setData({ [key]: !this.data.wrongList[index].expanded })
  },

  formatWrongItem(item) {
    const normalizedAnswer = this.normalizeAnswer(item.answer)
    return {
      ...item,
      expanded: false,
      normalizedAnswer,
      optionList: [
        { key: 'A', text: item.optionA || '' },
        { key: 'B', text: item.optionB || '' },
        { key: 'C', text: item.optionC || '' },
        { key: 'D', text: item.optionD || '' }
      ]
    }
  },

  normalizeAnswer(answer) {
    if (!answer) return ''
    return String(answer).trim().toUpperCase().charAt(0)
  }
})
