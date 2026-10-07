const { getAuthHeaders } = require('../../utils/request')

Page({
  data: {
    mode: 'add',
    quizId: null,
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    answerOptions: ['A', 'B', 'C', 'D'],
    answerIndex: 0,
    analysis: '',
    paperOptions: [],
    paperIndex: -1,
    presetPaperId: null
  },

  onLoad(options) {
    const id = Number((options || {}).id || 0)
    const presetPaperId = Number((options || {}).paperId || 0) || null
    if (id) {
      this.setData({ mode: 'edit', quizId: id, presetPaperId })
      wx.setNavigationBarTitle({ title: '编辑题目' })
    } else {
      this.setData({ presetPaperId })
      wx.setNavigationBarTitle({ title: '新增题目' })
    }

    this.loadPaperList(() => {
      if (id) {
        this.loadQuizDetail(id)
      }
    })
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

  onInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [field]: e.detail.value })
  },

  onAnswerChange(e) {
    this.setData({ answerIndex: Number(e.detail.value) })
  },

  onPaperChange(e) {
    this.setData({ paperIndex: Number(e.detail.value) })
  },

  loadPaperList(callback) {
    wx.request({
      url: 'http://127.0.0.1:8080/api/paper/list',
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200) {
          wx.showToast({ title: body.message || '作业包加载失败', icon: 'none' })
          return
        }

        const paperOptions = body.data || []
        let paperIndex = -1
        if (paperOptions.length > 0) {
          const presetPaperId = this.data.presetPaperId
          if (presetPaperId) {
            const index = paperOptions.findIndex(item => Number(item.id) === Number(presetPaperId))
            paperIndex = index >= 0 ? index : 0
          } else {
            paperIndex = 0
          }
        }
        this.setData({ paperOptions, paperIndex })
      },
      complete: () => {
        if (typeof callback === 'function') {
          callback()
        }
      }
    })
  },

  loadQuizDetail(id) {
    wx.showLoading({ title: '加载中...' })
    wx.request({
      url: 'http://127.0.0.1:8080/api/quiz/all',
      method: 'GET',
      header: getAuthHeaders(),
      success: (res) => {
        const body = res.data || {}
        if (body.code !== 200 || !Array.isArray(body.data)) {
          wx.showToast({ title: body.message || '加载失败', icon: 'none' })
          return
        }
        const target = body.data.find(item => Number(item.id) === Number(id))
        if (!target) {
          wx.showToast({ title: '题目不存在', icon: 'none' })
          return
        }
        const options = this.data.answerOptions
        const answer = String(target.answer || '').trim().toUpperCase()
        const answerIndex = Math.max(0, options.indexOf(answer))

        const paperOptions = this.data.paperOptions || []
        let paperIndex = this.data.paperIndex
        const existingPaperIndex = paperOptions.findIndex(item => Number(item.id) === Number(target.paperId || 0))
        if (existingPaperIndex >= 0) {
          paperIndex = existingPaperIndex
        }

        this.setData({
          question: target.question || '',
          optionA: target.optionA || '',
          optionB: target.optionB || '',
          optionC: target.optionC || '',
          optionD: target.optionD || '',
          answerIndex,
          analysis: target.analysis || '',
          paperIndex
        })
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  getSelectedPaperId() {
    const { paperOptions, paperIndex } = this.data
    if (!Array.isArray(paperOptions) || paperOptions.length === 0 || paperIndex < 0) {
      return null
    }
    return Number(paperOptions[paperIndex].id || 0) || null
  },

  submitQuiz() {
    const { mode, quizId, question, optionA, optionB, optionC, optionD, answerOptions, answerIndex, analysis } = this.data
    const paperId = this.getSelectedPaperId()

    const payload = {
      question: (question || '').trim(),
      optionA: (optionA || '').trim(),
      optionB: (optionB || '').trim(),
      optionC: (optionC || '').trim(),
      optionD: (optionD || '').trim(),
      answer: answerOptions[answerIndex],
      analysis: (analysis || '').trim(),
      paperId
    }

    if (!payload.paperId) {
      wx.showToast({ title: '请选择作业包', icon: 'none' })
      return
    }
    if (!payload.question) {
      wx.showToast({ title: '请输入题目', icon: 'none' })
      return
    }
    if (!payload.optionA || !payload.optionB || !payload.optionC || !payload.optionD) {
      wx.showToast({ title: '请完善选项', icon: 'none' })
      return
    }

    if (mode === 'edit') {
      payload.id = quizId
      if (!payload.id) {
        wx.showToast({ title: '题目ID无效', icon: 'none' })
        return
      }
    }

    const isEdit = mode === 'edit'
    wx.showLoading({ title: isEdit ? '更新中...' : '保存中...' })
    wx.request({
      url: isEdit ? 'http://127.0.0.1:8080/api/admin/quiz/update' : 'http://127.0.0.1:8080/api/admin/quiz/add',
      method: isEdit ? 'PUT' : 'POST',
      header: getAuthHeaders({ 'content-type': 'application/json' }),
      data: payload,
      success: (res) => {
        const body = res.data || {}
        if (body.code === 200) {
          wx.showToast({ title: isEdit ? '更新成功' : '保存成功', icon: 'success' })
          setTimeout(() => wx.navigateBack(), 500)
          return
        }
        wx.showToast({ title: body.message || (isEdit ? '更新失败' : '保存失败'), icon: 'none' })
      },
      fail: () => {
        wx.showToast({ title: '请求失败', icon: 'none' })
      },
      complete: () => {
        wx.hideLoading()
      }
    })
  },

  importExcel() {
    if (this.data.mode === 'edit') {
      wx.showToast({ title: '编辑模式不可导入', icon: 'none' })
      return
    }

    const paperId = this.getSelectedPaperId()
    if (!paperId) {
      wx.showToast({ title: '请先选择作业包', icon: 'none' })
      return
    }

    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['xlsx', 'xls'],
      success: (chooseRes) => {
        const files = chooseRes.tempFiles || []
        if (!files.length || !files[0].path) {
          wx.showToast({ title: '未选择文件', icon: 'none' })
          return
        }
        const filePath = files[0].path
        wx.showLoading({ title: '导入中...' })
        wx.uploadFile({
          url: 'http://127.0.0.1:8080/api/quiz/import',
          filePath,
          name: 'file',
          formData: {
            paperId: String(paperId)
          },
          header: getAuthHeaders(),
          success: (uploadRes) => {
            let body = {}
            try {
              body = JSON.parse(uploadRes.data || '{}')
            } catch (e) {
              body = {}
            }
            if (body.code === 200) {
              wx.showToast({ title: '导入成功', icon: 'success' })
              return
            }
            wx.showToast({ title: body.message || '导入失败', icon: 'none' })
          },
          fail: () => {
            wx.showToast({ title: '上传失败', icon: 'none' })
          },
          complete: () => {
            wx.hideLoading()
          }
        })
      },
      fail: () => {
        wx.showToast({ title: '已取消选择文件', icon: 'none' })
      }
    })
  }
})
