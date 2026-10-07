const { getAuthHeaders } = require('../../utils/request')

const REPORT_DETAIL_CACHE_KEY = 'admin_report_detail'

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
    this.fetchReportList()
  },

  fetchReportList() {
    this.setData({ loading: true })
    wx.request({
      url: 'http://localhost:8080/api/admin/report/pending',
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
          statusText: Number(item.status) === 1 ? '已审核' : '待审核',
          title: item.title && String(item.title).trim() ? item.title : '未命名举报',
          content: item.content && String(item.content).trim() ? item.content : '无举报内容',
          displayUserId: item.userId == null ? '-' : String(item.userId),
          displayTime: item.createTime && String(item.createTime).trim() ? item.createTime : '-'
        }))

        this.setData({ reportList: list })
      },
      fail: () => {
        wx.showToast({ title: '网络请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  goDetail(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) {
      return
    }
    const target = this.data.reportList.find(item => Number(item.id) === id)
    if (!target) {
      return
    }

    wx.setStorageSync(REPORT_DETAIL_CACHE_KEY, target)
    wx.navigateTo({ url: `/pages/admin/report-detail/report-detail?id=${id}` })
  },

  approveReport(e) {
    const id = Number(e.currentTarget.dataset.id)
    if (!id) {
      return
    }

    wx.showModal({
      title: '确认审核',
      content: '确认将该举报转化为系统公告并发布吗？',
      success: (modalRes) => {
        if (!modalRes.confirm) {
          return
        }

        this.setData({ approvingId: id })
        wx.request({
          url: `http://localhost:8080/api/admin/report/approve/${id}`,
          method: 'POST',
          header: getAuthHeaders(),
          success: (res) => {
            const body = res.data || {}
            if (body.code !== 200) {
              wx.showToast({ title: body.message || '审核失败', icon: 'none' })
              return
            }

            wx.showToast({ title: '已发布为系统公告', icon: 'success' })
            this.fetchReportList()
          },
          fail: () => {
            wx.showToast({ title: '网络请求失败', icon: 'none' })
          },
          complete: () => {
            this.setData({ approvingId: null })
          }
        })
      }
    })
  }
})
