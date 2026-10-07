const { getAuthHeaders } = require('../../../utils/request')

const REPORT_DETAIL_CACHE_KEY = 'admin_report_detail'

Page({
  data: {
    id: null,
    title: '',
    content: '',
    userId: '-',
    createTime: '-',
    statusText: '待审核'
  },

  onLoad(options) {
    const id = Number((options || {}).id || 0)
    this.setData({ id: id || null })

    const cached = wx.getStorageSync(REPORT_DETAIL_CACHE_KEY)
    if (cached && Number(cached.id) === id) {
      this.renderDetail(cached)
      return
    }

    if (id) {
      this.fetchDetailById(id)
    }
  },

  renderDetail(item) {
    this.setData({
      id: item.id || null,
      title: item.title && String(item.title).trim() ? item.title : '未命名举报',
      content: item.content && String(item.content).trim() ? item.content : '无举报内容',
      userId: item.userId == null ? '-' : String(item.userId),
      createTime: item.createTime && String(item.createTime).trim() ? item.createTime : '-',
      statusText: Number(item.status) === 1 ? '已审核' : '待审核'
    })
  },

  fetchDetailById(id) {
    wx.showLoading({ title: '加载中...' })
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
        const target = (body.data || []).find(item => Number(item.id) === Number(id))
        if (!target) {
          wx.showToast({ title: '未找到该举报', icon: 'none' })
          return
        }
        this.renderDetail(target)
      },
      fail: () => {
        wx.showToast({ title: '网络请求失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  }
})
