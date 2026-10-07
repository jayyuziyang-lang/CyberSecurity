const { getAuthHeaders, getCurrentUserId } = require('../../utils/request')

Page({
  data: {
    categoryOptions: ['钓鱼网站', '诈骗信息', '漏洞风险', '其他'],
    categoryIndex: 0,
    description: '',
    imageList: []
  },

  onShow() {
    const token = wx.getStorageSync('token')
    if (!token) {
      wx.reLaunch({ url: '/pages/login/login' })
    }
  },

  onCategoryChange(e) {
    this.setData({ categoryIndex: Number(e.detail.value) })
  },

  onDescriptionInput(e) {
    this.setData({ description: e.detail.value })
  },

  chooseImages() {
    const remain = 3 - this.data.imageList.length
    if (remain <= 0) {
      wx.showToast({ title: '最多上传3张图片', icon: 'none' })
      return
    }

    wx.chooseImage({
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const nextList = this.data.imageList.concat(res.tempFilePaths || []).slice(0, 3)
        this.setData({ imageList: nextList })
      }
    })
  },

  previewImage(e) {
    const current = e.currentTarget.dataset.src
    wx.previewImage({
      current,
      urls: this.data.imageList
    })
  },

  removeImage(e) {
    const index = Number(e.currentTarget.dataset.index)
    const nextList = this.data.imageList.filter((_, i) => i !== index)
    this.setData({ imageList: nextList })
  },

  submitReport() {
    const { categoryOptions, categoryIndex, description, imageList } = this.data
    const content = description.trim()
    const userId = getCurrentUserId()
    if (!content) {
      wx.showToast({ title: '请输入举报内容', icon: 'none' })
      return
    }
    if (!userId) {
      wx.showToast({ title: '请先登录', icon: 'none' })
      return
    }

    const title = `${categoryOptions[categoryIndex]}举报`
    wx.showLoading({ title: '提交中...' })
    wx.request({
      url: 'http://127.0.0.1:8080/api/report/submit',
      method: 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: {
        userId,
        title,
        content,
        images: JSON.stringify(imageList)
      },
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          wx.showToast({ title: '举报已提交', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
          return
        }
        wx.showToast({ title: body.message || '提交失败', icon: 'none' })
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
