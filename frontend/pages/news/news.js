const { getAuthHeaders } = require('../../utils/request')

const MAX_WARNING_COUNT = 30

Page({
  data: {
    newsList: [],
    searchKeyword: '',
    categories: ['全部', '竞赛信息', '安全动态', '系统公告', '网络安全活动'],
    activeCategory: '全部'
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.loadNewsList()
  },

  loadNewsList() {
    const requestData = {}
    if (this.data.activeCategory !== '全部') {
      requestData.category = this.data.activeCategory
    }
    wx.showLoading({ title: '加载中...' })
    wx.request({
      url: 'http://127.0.0.1:8080/api/news/list',
      method: 'GET',
      header: getAuthHeaders(),
      data: requestData,
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          this.setData({ newsList: this.limitWarningList(body.data || []) })
          return
        }
        wx.showToast({ title: body.message || '加载失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  onTabChange(e) {
    const category = e.currentTarget.dataset.category
    if (category === this.data.activeCategory) return
    this.setData({ activeCategory: category })
    this.loadNewsList()
  },

  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value })
    if (!e.detail.value) {
      this.loadNewsList()
    }
  },

  doSearch() {
    const keyword = (this.data.searchKeyword || '').trim()
    if (!keyword) {
      this.loadNewsList()
      return
    }

    wx.request({
      url: 'http://127.0.0.1:8080/api/news/search',
      method: 'GET',
      header: getAuthHeaders(),
      data: { keyword },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '搜索失败', icon: 'none' })
          return
        }
        let list = body.data || []
        if (this.data.activeCategory !== '全部') {
          list = list.filter(item => item.category === this.data.activeCategory)
        }
        this.setData({ newsList: this.limitWarningList(list) })
      }
    })
  },

  limitWarningList(list) {
    return Array.isArray(list) ? list.slice(0, MAX_WARNING_COUNT) : []
  },

  onClearSearch() {
    this.setData({ searchKeyword: '' })
    this.loadNewsList()
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    wx.navigateTo({ url: `/pages/news-detail/news-detail?id=${id}` })
  }
})
