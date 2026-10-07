const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    userInfo: null,
    role: 0
  },

  onLoad() {
    this.syncLoginState()
  },

  onShow() {
    this.syncLoginState()
  },

  syncLoginState() {
    const token = wx.getStorageSync('token')
    const user = wx.getStorageSync('currentUser')
    const cachedRole = wx.getStorageSync('userRole')
    const role = typeof cachedRole === 'number' ? cachedRole : 0

    if (!token || !user || !user.id) {
      this.setData({ userInfo: null, role: 0 })
      return
    }

    this.setData({ role, userInfo: user })
    this.refreshUserInfo(user.id)
  },

  handleLogin() {
    const token = wx.getStorageSync('token')
    if (token) return
    wx.navigateTo({ url: '/pages/login/login' })
  },

  refreshUserInfo(userId) {
    wx.request({
      url: `http://127.0.0.1:8080/api/user/info/${userId}`,
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          return
        }
        const dbUser = body.data || {}
        const role = typeof dbUser.role === 'number' ? dbUser.role : this.data.role
        const mergedUser = {
          nickname: dbUser.nickname || dbUser.username || '安全达人',
          username: dbUser.username,
          id: dbUser.id,
          avatarUrl: dbUser.avatarUrl || '/images/default-avatar.png',
          points: dbUser.points || 0,
          isFollowed: dbUser.isFollowed === 1,
          role,
          isAuthenticated: !!dbUser.isAuthenticated
        }
        wx.setStorageSync('currentUser', mergedUser)
        wx.setStorageSync('userRole', role)
        this.setData({ role, userInfo: mergedUser })
      }
    })
  },

  goToRank() {
    wx.navigateTo({ url: '/pages/leaderboard/leaderboard' })
  },

  goToWrongSet() {
    wx.navigateTo({ url: '/pages/wrong-set/wrong-set' })
  },

  goToDiagnosis() {
    wx.navigateTo({ url: '/pages/intelligent/diagnosis' })
  },

  goToRealAuth() {
    wx.navigateTo({ url: '/pages/auth/verify' })
  },

  onFollowTap() {
    wx.showToast({ title: '关注成功', icon: 'success' })
  },

  goToProfileEdit() {
    wx.navigateTo({ url: '/pages/me/profile-edit' })
  },

  goToPublishNews() {
    wx.navigateTo({ url: '/pages/admin/news-publish' })
  },

  goToQuizManager() {
    wx.navigateTo({ url: '/pages/admin/quiz-manager' })
  },

  goToReportManager() {
    wx.navigateTo({ url: '/pages/admin/report-manager' })
  },

  goToAdminDashboard() {
    wx.navigateTo({ url: '/pages/admin/dashboard' })
  },

  goToReport() {
    wx.navigateTo({ url: '/pages/report/submit' })
  }
})
