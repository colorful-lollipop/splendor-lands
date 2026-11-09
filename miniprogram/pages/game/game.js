const config = require('../../config');

Page({
  data: {
    url: config.gameUrl,
  },

  roomCode: '',
  baseUrl: config.gameUrl,

  onLoad(options) {
    const room = (options && options.room) || '';
    if (room) {
      this.roomCode = room;
      this.baseUrl = `${config.gameUrl}?room=${encodeURIComponent(room)}`;
      this.setData({ url: this.baseUrl });
    }
    wx.showLoading({ title: '正在进入牌桌', mask: true });
  },

  onUnload() {
    wx.hideLoading();
  },

  onWebviewLoad() {
    wx.hideLoading();
  },

  onWebviewError() {
    wx.hideLoading();
    wx.showModal({
      title: '牌桌加载失败',
      content: '请检查网络连接。若刚完成配置，请确认业务域名已加入小程序白名单。',
      confirmText: '重新加载',
      cancelText: '返回',
      success: (res) => {
        if (res.confirm) {
          const join = this.baseUrl.includes('?') ? '&' : '?';
          this.setData({ url: `${this.baseUrl}${join}retry=${Date.now()}` });
          wx.showLoading({ title: '正在重新加载', mask: true });
        } else {
          wx.navigateBack();
        }
      },
    });
  },

  onShareAppMessage() {
    const path = this.roomCode
      ? `/pages/index/index?room=${encodeURIComponent(this.roomCode)}`
      : '/pages/index/index';
    return {
      title: config.shareTitle,
      path,
      imageUrl: '/assets/share.jpg',
    };
  },
});