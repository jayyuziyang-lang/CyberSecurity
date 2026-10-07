const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')

const CATEGORY_COMPETITION = '竞赛信息'
const CATEGORY_ACTIVITY = '网络安全活动'

Page({
  data: {
    newsInfo: {},
    canRegister: false
  },

  onLoad(options) {
    if (options.id) {
      this.getNewsDetail(options.id)
    }
  },

  getNewsDetail(id) {
    wx.showLoading({ title: '加载中...' })
    wx.request({
      url: `http://127.0.0.1:8080/api/news/get/${id}`,
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200 && body.data) {
          const info = body.data
          const category = info.category || ''
          const canRegister = category === CATEGORY_COMPETITION || category === CATEGORY_ACTIVITY
          this.setData({
            newsInfo: info,
            canRegister
          })
          return
        }
        wx.showToast({ title: body.message || '内容不存在', icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '网络异常', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  submitRegistration() {
    if (!this.data.canRegister) {
      return
    }
    const userId = getCurrentUserId()
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    const role = wx.getStorageSync('userRole')
    if (role !== 0) {
      wx.showToast({ title: '仅学生可报名', icon: 'none' })
      return
    }
    const newsId = this.data.newsInfo.id
    if (!newsId) {
      wx.showToast({ title: '活动无效', icon: 'none' })
      return
    }

    wx.request({
      url: 'http://127.0.0.1:8080/api/registration/submit',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: { newsId, userId },
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          wx.showToast({ title: '报名成功', icon: 'success' })
          return
        }
        wx.showToast({ title: body.message || '报名失败', icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      }
    })
  }
})
