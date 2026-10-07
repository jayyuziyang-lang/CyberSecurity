const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    summaryList: [],
    expandedMap: {}
  },

  onShow() {
    const token = wx.getStorageSync('token')
    const role = wx.getStorageSync('userRole')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    if (role !== 1) {
      wx.showToast({ title: '仅管理员可操作', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 300)
      return
    }
    this.loadSummary()
  },

  loadSummary() {
    wx.showLoading({ title: '加载中...' })
    wx.request({
      url: 'http://127.0.0.1:8080/api/admin/summary',
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          this.setData({
            summaryList: body.data || [],
            expandedMap: {}
          })
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
  },

  toggleCard(e) {
    const newsId = e.currentTarget.dataset.id
    if (!newsId) return
    const key = String(newsId)
    const map = { ...this.data.expandedMap }
    map[key] = !map[key]
    this.setData({ expandedMap: map })
  }
})
