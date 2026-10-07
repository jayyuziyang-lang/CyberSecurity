const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    loading: false,
    creatingPaper: false,
    deletingId: null,
    newPaperTitle: '',
    papers: []
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
    this.loadPaperData()
  },

  request(options) {
    return new Promise((resolve, reject) => {
      wx.request({
        ...options,
        header: getAuthHeaders(options.header || {}),
        success: resolve,
        fail: reject
      })
    })
  },

  onNewPaperInput(e) {
    this.setData({ newPaperTitle: e.detail.value })
  },

  async createPaper() {
    const title = (this.data.newPaperTitle || '').trim()
    if (!title) {
      wx.showToast({ title: '请输入作业包标题', icon: 'none' })
      return
    }

    this.setData({ creatingPaper: true })
    try {
      const res = await this.request({
        url: 'http://127.0.0.1:8080/api/admin/paper/add',
        method: 'POST',
        header: { 'content-type': 'application/json' },
        data: { title }
      })
      const body = res.data || {}
      if (body.code !== 200) {
        wx.showToast({ title: body.message || '作业包创建失败', icon: 'none' })
        return
      }
      wx.showToast({ title: '作业包已创建', icon: 'success' })
      this.setData({ newPaperTitle: '' })
      this.loadPaperData()
    } catch (e) {
      wx.showToast({ title: '请求失败', icon: 'none' })
    } finally {
      this.setData({ creatingPaper: false })
    }
  },

  async loadPaperData() {
    this.setData({ loading: true })
    try {
      const paperRes = await this.request({
        url: 'http://127.0.0.1:8080/api/paper/list',
        method: 'GET'
      })
      const paperBody = paperRes.data || {}
      if (paperBody.code !== 200) {
        wx.showToast({ title: paperBody.message || '作业包加载失败', icon: 'none' })
        return
      }

      const papers = (paperBody.data || []).map(item => ({
        ...item,
        expanded: false,
        quizzes: []
      }))
      this.setData({ papers })

      await Promise.all(papers.map(item => this.loadPaperQuizzes(item.id, false)))
    } catch (e) {
      wx.showToast({ title: '请求失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  async loadPaperQuizzes(paperId, showLoading = true) {
    if (!paperId) {
      return
    }
    if (showLoading) {
      wx.showLoading({ title: '题目加载中...' })
    }
    try {
      const res = await this.request({
        url: `http://127.0.0.1:8080/api/paper/quizzes/${paperId}`,
        method: 'GET'
      })
      const body = res.data || {}
      if (body.code !== 200) {
        wx.showToast({ title: body.message || '题目加载失败', icon: 'none' })
        return
      }
      const index = this.data.papers.findIndex(item => Number(item.id) === Number(paperId))
      if (index < 0) {
        return
      }
      this.setData({ [`papers[${index}].quizzes`]: body.data || [] })
    } catch (e) {
      wx.showToast({ title: '请求失败', icon: 'none' })
    } finally {
      if (showLoading) {
        wx.hideLoading()
      }
    }
  },

  togglePaper(e) {
    const paperId = Number(e.currentTarget.dataset.id)
    if (!paperId) return
    const index = this.data.papers.findIndex(item => Number(item.id) === paperId)
    if (index < 0) return
    const expanded = !!this.data.papers[index].expanded
    this.setData({ [`papers[${index}].expanded`]: !expanded })
  },

  goToAdd(e) {
    const paperId = Number(e.currentTarget.dataset.paperId || 0)
    if (paperId) {
      wx.navigateTo({ url: `/pages/admin/quiz-add?paperId=${paperId}` })
      return
    }
    wx.navigateTo({ url: '/pages/admin/quiz-add' })
  },

  goToEdit(e) {
    const id = Number(e.currentTarget.dataset.id)
    const paperId = Number(e.currentTarget.dataset.paperId || 0)
    if (!id) return
    const query = paperId ? `?id=${id}&paperId=${paperId}` : `?id=${id}`
    wx.navigateTo({ url: `/pages/admin/quiz-add${query}` })
  },

  deleteQuiz(e) {
    const id = Number(e.currentTarget.dataset.id)
    const paperId = Number(e.currentTarget.dataset.paperId || 0)
    if (!id) return
    wx.showModal({
      title: '确认删除',
      content: '确定删除这道题目吗？',
      confirmColor: '#e54d42',
      success: (modalRes) => {
        if (!modalRes.confirm) return
        this.setData({ deletingId: id })
        wx.request({
          url: `http://127.0.0.1:8080/api/quiz/delete/${id}`,
          method: 'DELETE',
          header: getAuthHeaders(),
          success: (res) => {
            const body = res.data || {}
            if (body.code !== 200) {
              wx.showToast({ title: body.message || '删除失败', icon: 'none' })
              return
            }
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadPaperQuizzes(paperId, false)
          },
          fail: () => {
            wx.showToast({ title: '请求失败', icon: 'none' })
          },
          complete: () => {
            this.setData({ deletingId: null })
          }
        })
      }
    })
  }
})
