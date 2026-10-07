const { getAuthHeaders } = require('../../../utils/request')

Page({
  data: {
    loading: false,
    approvingId: null,
    reportList: []
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
    this.loadPendingReports()
  },

  loadPendingReports() {
    this.setData({ loading: true })
    wx.request({
      url: 'http://127.0.0.1:8080/api/admin/report/pending',
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '加载失败', icon: 'none' })
          return
        }

        const list = (body.data || []).map(item => ({
          ...item,
          displayTitle: item.title && String(item.title).trim() ? item.title : '未命名举报',
          displayUserId: item.userId == null ? '-' : String(item.userId),
          displayTime: item.createTime && String(item.createTime).trim() ? item.createTime : '-'
        }))
        this.setData({ reportList: list })
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  approveReport(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) {
      return
    }

    wx.showModal({
      title: '确认审核',
      content: '确认审核通过并发布为系统公告吗？',
      success: (modalRes) => {
        if (!modalRes.confirm) {
          return
        }

        this.setData({ approvingId: id })
        wx.request({
          url: `http://127.0.0.1:8080/api/admin/report/approve/${id}`,
          method: 'POST',
          header: getAuthHeaders(),
          success: (res) => {
            const body = res.data || {}
            if (body.code !== 200) {
              wx.showToast({ title: body.message || '审核失败', icon: 'none' })
              return
            }
            wx.showToast({ title: '已发布为公告', icon: 'success' })
            this.loadPendingReports()
          },
          fail: () => {
            wx.showToast({ title: '请求失败', icon: 'none' })
          },
          complete: () => {
            this.setData({ approvingId: null })
          }
        })
      }
    })
  }
})
