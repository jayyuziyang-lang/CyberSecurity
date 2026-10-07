Page({
  data: {
    username: '',
    password: '',
    isRegisterMode: false,
    loading: false
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (token) {
      wx.switchTab({ url: '/pages/news/news' })
    }
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  switchMode() {
    this.setData({
      isRegisterMode: !this.data.isRegisterMode,
      password: ''
    })
  },

  submitLogin() {
    const username = (this.data.username || '').trim()
    const password = (this.data.password || '').trim()
    if (!username || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    wx.request({
      url: 'http://127.0.0.1:8080/api/user/login',
      method: 'POST',
      data: { username, password },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !body.data) {
          wx.showToast({ title: body.message || '登录失败', icon: 'none' })
          return
        }

        const data = body.data
        const token = data.token || ''
        const userInfo = data.userInfo || {}
        const role = typeof data.role === 'number' ? data.role : 0
        const isAuthenticated = !!(data.isAuthenticated || userInfo.isAuthenticated)

        wx.setStorageSync('token', token)
        wx.setStorageSync('currentUser', {
          ...userInfo,
          isAuthenticated
        })
        wx.setStorageSync('userRole', role)

        wx.showToast({ title: '登录成功', icon: 'success' })

        if (role === 0 && !isAuthenticated) {
          wx.showModal({
            title: '实名认证',
            content: '首次登录需要完成实名认证，是否现在前往？',
            confirmText: '去认证',
            cancelText: '稍后',
            success: (modalRes) => {
              if (modalRes.confirm) {
                wx.navigateTo({ url: '/pages/auth/verify' })
                return
              }
              wx.switchTab({ url: '/pages/news/news' })
            }
          })
          return
        }

        setTimeout(() => {
          wx.switchTab({ url: '/pages/news/news' })
        }, 300)
      },
      fail: () => {
        wx.showToast({ title: '网络请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  },

  submitRegister() {
    const username = (this.data.username || '').trim()
    const password = (this.data.password || '').trim()
    if (!username || !password) {
      wx.showToast({ title: '请输入账号和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    wx.request({
      url: 'http://127.0.0.1:8080/api/user/register',
      method: 'POST',
      header: { 'content-type': 'application/json' },
      data: { username, password },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '注册失败', icon: 'none' })
          return
        }

        wx.showToast({ title: '账号注册成功！', icon: 'success' })
        this.setData({
          isRegisterMode: false,
          password: ''
        })
      },
      fail: () => {
        wx.showToast({ title: '网络请求失败', icon: 'none' })
      },
      complete: () => {
        this.setData({ loading: false })
      }
    })
  }
})
