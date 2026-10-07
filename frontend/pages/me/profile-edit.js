const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    userId: null,
    nickname: '',
    avatarUrl: '/images/default-avatar.png',
    saving: false
  },

  onLoad() {
    const token = wx.getStorageSync('token')
    const currentUser = wx.getStorageSync('currentUser') || {}
    if (!token || !currentUser.id) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }

    this.setData({
      userId: currentUser.id,
      nickname: currentUser.nickname || currentUser.username || '',
      avatarUrl: currentUser.avatarUrl || '/images/default-avatar.png'
    })
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  chooseAvatar() {
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const list = res.tempFilePaths || []
        if (list.length > 0) {
          this.setData({ avatarUrl: list[0] })
        }
      }
    })
  },

  saveProfile() {
    const nickname = (this.data.nickname || '').trim()
    const avatarUrl = (this.data.avatarUrl || '').trim()
    if (!nickname) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    this.setData({ saving: true })
    wx.request({
      url: 'http://127.0.0.1:8080/api/user/update',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: {
        id: this.data.userId,
        nickname,
        avatarUrl
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          wx.showToast({ title: body.message || '保存失败', icon: 'none' })
          return
        }

        const updated = body.data
        const currentUser = wx.getStorageSync('currentUser') || {}
        const merged = {
          ...currentUser,
          id: updated.id,
          username: updated.username || currentUser.username,
          nickname: updated.nickname || nickname,
          avatarUrl: updated.avatarUrl || avatarUrl,
          points: typeof updated.points === 'number' ? updated.points : currentUser.points,
          isFollowed: typeof updated.isFollowed === 'number' ? updated.isFollowed === 1 : currentUser.isFollowed,
          role: typeof updated.role === 'number' ? updated.role : currentUser.role,
          isAuthenticated: !!updated.isAuthenticated
        }

        wx.setStorageSync('currentUser', merged)
        if (typeof merged.role === 'number') {
          wx.setStorageSync('userRole', merged.role)
        }

        wx.showToast({ title: '已保存', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 300)
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ saving: false })
      }
    })
  }
})
