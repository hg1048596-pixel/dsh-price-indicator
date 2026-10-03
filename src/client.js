/*
 * dsh-price-indicator —— Client 半端源码
 *
 * 用法：在 DeepSeek Harness 的 Cordis 插件开发流程中（cordis_define），
 * 把本文件内容整体作为 code.client 传入。该函数体返回一个 Cordis Plugin。
 *
 * 功能：
 * 1. 在对话上边框（conversation.session.header.actions）显示当前 DeepSeek
 *    价格处于高峰（梁文峰）还是空闲（梁文谷），并每秒刷新当前时段结束的倒计时。
 *    显示前后一致：现在是 X 时间，距离 X 时间结束还剩 ……
 * 2. 在侧边栏底部（sidebar.footer.action）提供「价格」插件开关按钮，弹出菜单
 *    里可「启用 / 停用」价格指示器（localStorage 持久化）。
 *
 * 价格规则（北京时间 UTC+8，2026 年现行）：
 *   1) 工作日高峰（梁文峰）09:00-12:00、14:00-18:00，其余为空闲（梁文谷，高峰一半价）；
 *   2) 周六、周日全天按空闲计费（含调休上班的周末，DeepSeek 2026-08-23 起）；
 *   3) 中国法定节假日全天按空闲计费（DeepSeek 2026-09-19 说明）。
 */
return {
  inject: ['slots', 'timer'],
  apply(ctx) {
    const slots = ctx.get('slots')
    if (slots === undefined) return

    // -------------------------------- 价格配置 --------------------------------
    // 政策依据（北京时间 UTC+8）：
    //   1) 工作日（周一至周五）高峰 09:00-12:00、14:00-18:00；其余为空闲，
    //      空闲价为高峰价的一半（DeepSeek 2026-08-17 起执行的峰谷定价）。
    //   2) 周六、周日全天不再区分峰谷，统一按空闲时段计费
    //      （DeepSeek 2026-08-23 00:00 起生效；调休上班的周末同样按空闲计费）。
    //   3) 中国法定节假日全天按空闲时段计费（DeepSeek 2026-09-19 说明）。
    // 节假日表依据《国务院办公厅关于2026年部分节假日安排的通知》
    // （国办发明电〔2025〕7号），每年更新一次即可。
    const PRICE_CONFIG = {
      tzOffset: 8,                                  // 北京时间 UTC+8
      peakWindows: [[540, 720], [840, 1080]],       // 工作日高峰窗口 [start,end) 分钟：540=09:00 720=12:00 840=14:00 1080=18:00
      holidays: {
        2026: [
          '01-01', '01-02', '01-03',                                                          // 元旦
          '02-15', '02-16', '02-17', '02-18', '02-19', '02-20', '02-21', '02-22', '02-23',   // 春节
          '04-04', '04-05', '04-06',                                                          // 清明节
          '05-01', '05-02', '05-03', '05-04', '05-05',                                        // 劳动节
          '06-19', '06-20', '06-21',                                                          // 端午节
          '09-25', '09-26', '09-27',                                                          // 中秋节
          '10-01', '10-02', '10-03', '10-04', '10-05', '10-06', '10-07',                      // 国庆节
        ],
      },
    }
    const DAY_MS = 86400000
    const pad2 = (n) => (n < 10 ? '0' + n : String(n))

    /** 北京时间某天是否全天按空闲计费；返回原因（'holiday' 法定节假日 / 'weekend' 周末）或 null。
     *  法定节假日优先标注（节假日落在周末时显示「节假日」）；两者全天都按空闲计费。 */
    function offPeakReason(year, month, day, weekday) {
      const list = PRICE_CONFIG.holidays[year]
      if (list !== undefined && list.indexOf(pad2(month) + '-' + pad2(day)) !== -1) return 'holiday'
      if (weekday === 0 || weekday === 6) return 'weekend'
      return null
    }

    // --------------------------- 微 store（插件 UI 状态） --------------------------
    const STORAGE_KEY = 'dsh_price_indicator_enabled'
    function loadEnabled() {
      try { return localStorage.getItem(STORAGE_KEY) !== 'false' } catch (e) { return true }
    }
    const uiStore = { enabled: loadEnabled(), launcherOpen: false }
    const uiListeners = new Set()
    function setUi(patch) {
      Object.assign(uiStore, patch)
      for (const fn of uiListeners) { try { fn() } catch (e) { /* ignore */ } }
    }
    function subscribeUi(fn) { uiListeners.add(fn); return () => { uiListeners.delete(fn) } }
    function useUi() {
      const [, tick] = React.useState(0)
      React.useEffect(() => subscribeUi(() => tick((n) => n + 1)), [])
      return uiStore
    }
    function toggleEnabled(next) {
      setUi({ enabled: next })
      try { localStorage.setItem(STORAGE_KEY, String(next)) } catch (e) { /* ignore */ }
    }

    // -------------------------------- 样式 ------------------------------------
    styles.insert(`
      .ds-price-indicator{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:999px;font-size:12px;line-height:18px;font-weight:500;white-space:nowrap;flex:none;border:1px solid transparent;}
      .ds-price-indicator .ds-price-dot{width:7px;height:7px;border-radius:50%;flex:none;background:currentColor;}
      .ds-price-indicator.idle{color:var(--dsw-alias-label-on-accent,#ffffff);background:linear-gradient(135deg,#2ecc71,#1f9d55);border-color:rgba(255,255,255,.25);box-shadow:0 1px 6px rgba(31,157,85,.35);}
      .ds-price-indicator.peak{color:var(--dsw-alias-label-on-accent,#ffffff);background:linear-gradient(135deg,#ff7a59,#ee5a24);border-color:rgba(255,255,255,.25);box-shadow:0 1px 6px rgba(238,90,36,.35);}
      .ds-price-indicator .ds-price-tag{font-weight:600;}
      .ds-price-indicator .ds-price-suffix{font-style:normal;opacity:.85;font-size:11px;}
      .ds-price-foot-btn{border:0;background:transparent;color:inherit;cursor:pointer;font-size:12px;padding:6px 10px;border-radius:6px;display:flex;align-items:center;gap:6px;}
      .ds-price-foot-btn:hover{background:rgba(128,128,128,.15);}
      .ds-price-layer{position:fixed;z-index:1250;pointer-events:auto;right:12px;bottom:64px;width:260px;background:var(--dsw-alias-bg-overlay,var(--dsw-alias-bg-layer-1,#fff));border:1px solid var(--dsw-alias-border-l2,rgba(128,128,128,.3));border-radius:12px;box-shadow:0 14px 40px rgba(0,0,0,.35);overflow:hidden;}
      .ds-price-layer-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 12px;font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary,#fff);border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.2));background:rgba(128,128,128,.08);}
      .ds-price-layer-head b{flex:1;}
      .ds-price-layer-close{border:0;background:rgba(128,128,128,.14);color:var(--dsw-alias-label-primary,#fff);width:20px;height:20px;border-radius:6px;font-size:12px;line-height:1;cursor:pointer;padding:0;flex:none;}
      .ds-price-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 12px;font-size:12px;color:var(--dsw-alias-label-primary,#fff);border-bottom:1px solid var(--dsw-alias-border-l1,rgba(128,128,128,.15));}
      .ds-price-row-last{border-bottom:0;}
      .ds-price-switch{position:relative;width:36px;height:20px;border-radius:999px;background:rgba(128,128,128,.35);border:none;cursor:pointer;flex:none;transition:background .2s ease;padding:0;}
      .ds-price-switch.on{background:#27ae60;}
      .ds-price-switch::after{content:"";position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#fff;transition:transform .2s ease;}
      .ds-price-switch.on::after{transform:translateX(16px);}
      .ds-price-desc{font-size:11px;color:var(--dsw-alias-label-secondary,#999);margin-top:2px;}
    `)

    // --------------------------- 价格 / 倒计时计算 ------------------------------
    /**
     * 返回当前价格状态：
     *  - isPeak: 当前是否高峰（梁文峰）
     *  - nextSwitchMs: 下次价格切换的真实时间戳（高峰结束，或下一个高峰窗口开始）
     *  - current / target: 前后一致的时段名（都是当前所处时段）
     *  - reason: 空闲原因（'weekend' 周末 / 'holiday' 法定节假日），工作日高峰或工作日夜间为 null
     */
    function getPriceStatus(nowMs) {
      const shift = PRICE_CONFIG.tzOffset * 3600000
      const bjMs = nowMs + shift                                  // 位移后的「北京时间」毫秒
      const dayStartBj = Math.floor(bjMs / DAY_MS) * DAY_MS       // 北京时间当天 00:00（位移坐标）
      const cur = Math.floor((bjMs - dayStartBj) / 60000)         // 北京时间当天已过分钟数
      const today = new Date(dayStartBj)
      const reason = offPeakReason(today.getUTCFullYear(), today.getUTCMonth() + 1, today.getUTCDate(), today.getUTCDay())

      // 高峰只出现在工作日（非周末、非法定节假日）的两个窗口内
      let isPeak = false
      let endMin = 0
      if (reason === null) {
        for (const w of PRICE_CONFIG.peakWindows) {
          if (cur >= w[0] && cur < w[1]) { isPeak = true; endMin = w[1]; break }
        }
      }

      let nextSwitchMs
      if (isPeak) {
        nextSwitchMs = dayStartBj + endMin * 60000 - shift
      } else {
        // 空闲期：下一个高峰窗口的开始时刻（自然跳过周末与法定节假日）
        nextSwitchMs = null
        for (let offset = 0; offset < 400 && nextSwitchMs === null; offset++) {
          const dayMs = dayStartBj + offset * DAY_MS
          const dt = new Date(dayMs)
          if (offPeakReason(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), dt.getUTCDay()) !== null) continue
          for (const w of PRICE_CONFIG.peakWindows) {
            const t = dayMs + w[0] * 60000 - shift
            if (t > nowMs) { nextSwitchMs = t; break }
          }
        }
        if (nextSwitchMs === null) nextSwitchMs = nowMs   // 兜底：理论上不可达
      }

      return {
        isPeak,
        nextSwitchMs,
        current: isPeak ? '梁文峰' : '梁文谷',
        target: isPeak ? '梁文峰' : '梁文谷',
        reason,
      }
    }

    function formatCountdown(ms) {
      const total = Math.max(0, Math.floor(ms / 1000))
      const hours = Math.floor(total / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      const seconds = total % 60
      const pad = (n) => String(n).padStart(2, '0')
      return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds)
    }

    // ------------------------------- 价格指示器 --------------------------------
    const PriceIndicator = (props) => {
      const ui = useUi()
      const [nowMs, setNowMs] = React.useState(Date.now())

      React.useEffect(() => {
        const dispose = ctx.interval(() => setNowMs(Date.now()), 1000)
        return dispose
      }, [])

      if (!ui.enabled) return null

      let status
      try { status = getPriceStatus(nowMs) } catch (error) { return null }
      const countdown = formatCountdown(status.nextSwitchMs - nowMs)
      const kind = status.isPeak ? 'peak' : 'idle'

      return React.createElement(
        'span',
        { className: 'ds-price-indicator ' + kind, 'data-price-indicator': '', title: 'DeepSeek 当前为' + status.current + '时间（' + (status.isPeak ? '高峰价' : '空闲价，高峰的一半') + '）' + (status.reason === 'weekend' ? ' · 周末全天按空闲计费' : status.reason === 'holiday' ? ' · 法定节假日全天按空闲计费' : '') },
        React.createElement('span', { className: 'ds-price-dot' }),
        React.createElement('span', { className: 'ds-price-tag' }, '现在是 ' + status.current + '时间'),
        React.createElement('span', { className: 'ds-price-suffix' }, '距离 ' + status.target + '时间结束还剩 ' + countdown),
        status.isPeak ? null : React.createElement('span', { className: 'ds-price-suffix' },
          (status.reason === 'weekend' ? '· 周末全天低谷 ' : status.reason === 'holiday' ? '· 节假日全天低谷 ' : '') + '亿万鲸子必须喷发')
      )
    }

    // ------------------------------- 插件开关（📈 价格） --------------------------
    const FootButton = (props) => {
      const wide = !!(props && props.wide)
      const ui = useUi()
      return React.createElement('button', {
        className: 'ds-price-foot-btn',
        title: '价格指示器',
        onClick: () => setUi({ launcherOpen: !ui.launcherOpen }),
      }, wide ? '📈 价格' : '📈')
    }

    const PriceMenu = () => {
      const ui = useUi()
      if (!ui.launcherOpen) return null
      return React.createElement('div', { className: 'ds-price-layer', 'data-price-layer': '' },
        React.createElement('div', { className: 'ds-price-layer-head' },
          React.createElement('b', null, '📈 价格指示器'),
          React.createElement('button', { className: 'ds-price-layer-close', onClick: () => setUi({ launcherOpen: false }) }, '×'),
        ),
        React.createElement('div', { className: 'ds-price-row' },
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', null, '价格显示'),
            React.createElement('div', { className: 'ds-price-desc' }, '在对话上边框显示梁文峰 / 梁文谷时间'),
          ),
          React.createElement('button', {
            className: 'ds-price-switch' + (ui.enabled ? ' on' : ''),
            'aria-label': '价格显示',
            role: 'switch',
            'aria-checked': ui.enabled,
            onClick: () => toggleEnabled(!ui.enabled),
          }),
        ),
        React.createElement('div', { className: 'ds-price-row ds-price-row-last' },
          React.createElement('div', { className: 'ds-price-desc' },
            '工作日高峰（梁文峰）：9:00-12:00、14:00-18:00；周六、周日与法定节假日全天为空闲（梁文谷，高峰一半价）'
          ),
        ),
      )
    }

    // ------------------------------- 插槽注册 --------------------------------
    slots.inject('conversation.session.header.actions', () => slots.register(
      { name: 'conversation.session.header.actions', id: 'price-indicator', order: 120 },
      PriceIndicator
    ))

    slots.inject('sidebar.footer.action', () => slots.register(
      { name: 'sidebar.footer.action', id: 'price-indicator', order: 60, label: '价格' },
      (props) => React.createElement(FootButton, { wide: props && props.wide })
    ))

    slots.inject('shell.overlay', () => slots.register(
      { name: 'shell.overlay', id: 'price-indicator-menu', order: 80, label: '价格指示器开关' },
      () => React.createElement(PriceMenu)
    ))
  },
}
