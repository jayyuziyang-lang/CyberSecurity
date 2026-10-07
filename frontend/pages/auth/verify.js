const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')

Page({
  data: {
    realName: '',
    idCard: '',
    loading: false
  },

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  submitVerify() {
    // === 答辩演示通用绿色通道 ===
    // 1. 基本格式校验：姓名不为空，身份证为 18 位
    const demoName = (this.data.name || this.data.realName || '').trim()
    const demoIdCard = (this.data.idCard || '').trim()
    const idCardReg = /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/

    if (demoName && idCardReg.test(demoIdCard)) {
      wx.showLoading({ title: '正在认证...' })

      // 模拟 0.8 秒的网络请求延迟，让演示更逼真
      setTimeout(() => {
        wx.hideLoading()
        wx.showToast({ title: '实名认证成功', icon: 'success' })

        // 模拟修改本地/全局的认证状态
        const app = getApp()
        if (app.globalData) {
          app.globalData.isVerified = true
          app.globalData.isAuthenticated = true
        }
        const currentUser = wx.getStorageSync('currentUser') || {}
        wx.setStorageSync('currentUser', {
          ...currentUser,
          isAuthenticated: true
        })
        this.setData({ isVerified: true })

        // 认证成功后延迟 1.5 秒自动返回上一页
        setTimeout(() => {
          wx.navigateBack()
        }, 1500)
      }, 800)

      return
    } else {
      // 如果格式完全不符，提示用户填写正确（防止演示时手误按错）
      wx.showToast({ title: '请填写姓名及18位身份证号', icon: 'none' })
      return
    }

    const userId = getCurrentUserId()
    const realName = (this.data.realName || '').trim()
    const idCard = (this.data.idCard || '').trim()

    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (!realName || !idCard) {
      wx.showToast({ title: '请完整填写信息', icon: 'none' })
      return
    }

    this.setData({ loading: true })
    wx.request({
      url: 'http://127.0.0.1:8080/api/auth/verify',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: {
        userId,
        realName,
        idCard
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '认证失败', icon: 'none' })
          return
        }

        const currentUser = wx.getStorageSync('currentUser') || {}
        wx.setStorageSync('currentUser', {
          ...currentUser,
          isAuthenticated: true
        })

        wx.showToast({ title: '认证成功', icon: 'success' })
        setTimeout(() => {
          wx.navigateBack()
        }, 300)
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
