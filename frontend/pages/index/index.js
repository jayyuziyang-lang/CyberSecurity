const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    papers: [],
    loading: false
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadPaperList()
  },

  loadPaperList() {
    this.setData({ loading: true })
    wx.request({
      url: 'http://127.0.0.1:8080/api/paper/list',
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '作业包加载失败', icon: 'none' })
          return
        }
        this.setData({ papers: body.data || [] })
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  openPaper(e) {
    const paperId = Number(e.currentTarget.dataset.id)
    if (!paperId) {
      wx.showToast({ title: '作业包无效', icon: 'none' })
      return
    }
    wx.navigateTo({ url: `/pages/quiz/quiz?paperId=${paperId}` })
  }
})
