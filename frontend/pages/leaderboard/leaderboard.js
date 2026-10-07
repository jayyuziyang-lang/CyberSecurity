const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    rankList: []
  },

  onShow() {
    this.getRankData()
  },

  getRankData() {
    wx.showLoading({ title: '加载中...' })
    wx.request({
      url: 'http://127.0.0.1:8080/api/user/leaderboard',
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          this.setData({ rankList: body.data || [] })
          return
        }
        wx.showToast({ title: body.message || '加载失败', icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  }
})
