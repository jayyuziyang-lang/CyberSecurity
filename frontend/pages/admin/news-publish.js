const { getAuthHeaders } = require('../../utils/request')

const CATEGORY_COMPETITION = '竞赛信息'
const CATEGORY_SECURITY = '安全动态'
const CATEGORY_ACTIVITY = '网络安全活动'

Page({
  data: {
    title: '',
    categoryOptions: [CATEGORY_COMPETITION, CATEGORY_SECURITY, CATEGORY_ACTIVITY],
    categoryIndex: 0,
    content: ''
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
    }
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value })
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onContentInput(e) {
    this.setData({ content: e.detail.value })
  },

  onSubmit() {
    const { title, categoryOptions, categoryIndex, content } = this.data
    const finalTitle = (title || '').trim()
    const finalContent = (content || '').trim()
    const selectedCategory = categoryOptions[categoryIndex]
    const category = selectedCategory === CATEGORY_ACTIVITY ? CATEGORY_ACTIVITY : selectedCategory
    const isCompetition = selectedCategory === CATEGORY_COMPETITION

    if (!finalTitle) {
      wx.showToast({ title: '请输入标题', icon: 'none' })
      return
    }
    if (!finalContent) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    wx.showLoading({ title: '发布中...' })
    wx.request({
      url: 'http://127.0.0.1:8080/api/admin/news/publish',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: {
        title: finalTitle,
        category,
        isCompetition,
        content: finalContent
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          wx.showToast({ title: '发布成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
          return
        }
        wx.showToast({ title: body.message || '发布失败', icon: 'none' })
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
