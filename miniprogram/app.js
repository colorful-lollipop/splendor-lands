const config = require('./config');

App({
  globalData: {
    gameUrl: config.gameUrl,
  },

  onLaunch() {
    // 小程序更新后提示用户重启，避免旧版本缓存。
    if (!wx.getUpdateManager) return;
    const manager = wx.getUpdateManager();
    manager.onUpdateReady(() => {
      wx.showModal({
        title: '发现新版本',
        content: '新版本已经准备好，是否重启应用？',
        confirmText: '立即重启',
        success: (res) => {
          if (res.confirm) manager.applyUpdate();
        },
      });
    });
  },
});