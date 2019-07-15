import * as path from 'path'
import * as os from 'os'
import Ping from './utils/Ping'
import i18n from '../i18n'
import Global from './global'

import Update from './ui/Update'
import LeftPanel from './ui/Panel'
import ResourcePacks from './pages/ResourcePacks'
import Extensions from './pages/Extensions'
import Tools from './pages/Tools'
import Setting from './pages/Setting'
import About from './pages/About'

import darkModeTheme from './extra/darkMode/main'
import springFestivalTheme from './extra/springFestivalTheme/main'
import { ipcRenderer, remote } from 'electron'
import { MajsoulPlus } from '../majsoul_plus'

class ResourceManager {
  private static userConfig: MajsoulPlus.UserConfig
  private static readonly extends: Function[] = []

  private static readonly resourcepackRootDir = path.join(
    Global.appDataDir,
    Global.ResourcePackDir
  )
  private static readonly extensionRootDir = path.join(
    Global.appDataDir,
    Global.ExtensionDir
  )
  private static readonly toolRootDir = path.join(
    Global.appDataDir,
    Global.ToolsDir
  )

  // 增加扩展样式
  static extend(theme: Function) {
    ResourceManager.extends.push(theme)
    return ResourceManager
  }

  static init() {
    ResourceManager.userConfig = Setting.userConfig

    new Update(ResourceManager.userConfig.update.prerelease).checkUpdate()
    // TODO: 支持日服/美服的 Ping
    new Ping('zh').init()
    LeftPanel.init()
    Setting.init()
    ResourceManager.initRPC()
    ResourceManager.loadCards()
    ResourceManager.addEventListener()
    ResourceManager.runExtends()
    About.render()
    i18n.parseAllElementsText(document.documentElement)
  }

  // 注册与主进程通讯的内容
  private static initRPC() {
    ipcRenderer.on('change-config', (event: Electron.Event, data) => {
      const obj = data
      // FIXME
      // ResourceManager.options.userConfig[obj.mainKey][obj.key] = obj.value
    })

    ipcRenderer.on('save-config', () => {
      // TODO: 修改配置保存逻辑，统一在主进程保存
      ResourceManager.saveSettings()
      ipcRenderer.send('close-manager')
    })
  }

  // 加载 Card 资源
  private static loadCards() {
    ResourcePacks.load()
    Extensions.load()
    Tools.load()
  }

  private static refreshCard(type: string) {
    return () =>
      [ResourcePacks, Extensions, Tools]
        .filter(t => t.name === type)[0]
        .refresh()
  }

  private static addEventListener() {
    [ResourcePacks, Extensions, Tools].forEach(ext => {
      // 导入
      const importMSP = document.querySelector(`#install${ext.name}`)
      importMSP.addEventListener(
        'click',
        ResourceManager.importMSP(ext.name.toLowerCase())
      )

      // 修改
      const changeEditable = document.querySelector(`#edit${ext.name}`)
      changeEditable.addEventListener(
        'click',
        ResourceManager.changeEditable(ext.name)
      )

      // 刷新
      const refresh = document.querySelector(`#refresh${ext.name}`)
      refresh.addEventListener('click', ResourceManager.refreshCard(ext.name))
    })

    window.addEventListener('blur', () => document.body.classList.add('blur'))
    window.addEventListener('focus', () =>
      document.body.classList.remove('blur')
    )

    // 启动游戏
    const launch = document.querySelector('#launch')
    launch.addEventListener('click', ResourceManager.gameStart)

    // 关闭 Manager
    const closeBtn = document.querySelector('#closeBtn')
    if (os.platform() === 'darwin') {
      closeBtn.className = 'close-btn darwin'
      // hack close bar
      const body = document.querySelector('body')
      body.classList.add('darwin')
      const closeButton = document.querySelector('body > .close-btn.darwin')
      body.removeChild(closeButton)
    }
    closeBtn.addEventListener('click', window.close)
  }

  // 加载扩展 Manager 主题
  private static runExtends() {
    ResourceManager.extends.forEach(theme => theme())
  }

  // 游戏启动
  private static gameStart() {
    ResourceManager.saveSettings()
    ipcRenderer.send('start-game')
  }

  // 保存设置
  private static saveSettings() {
    Setting.save()
    ResourcePacks.save()
    Extensions.save()
    Tools.save()
  }

  // 从 MSP* 导入资源包 / 扩展 / 工具
  private static importMSP(type: string) {
    return () => {
      remote.dialog.showOpenDialog(
        {
          title: i18n.text.manager.installFrom(),
          filters: [
            {
              name: i18n.text.manager.fileTypeMSPM(),
              extensions: ['mspm']
            },
            {
              name: i18n.text.manager.fileTypeMSPE(),
              extensions: ['mspe']
            },
            {
              name: i18n.text.manager.fileTypeMSPT(),
              extensions: ['mspt']
            }
          ].filter(
            ext =>
              ext.extensions[0] ===
              {
                resourcepack: 'mspm',
                extension: 'mspe',
                tool: 'mspt'
              }[type]
          ),
          properties: ['openFile', 'multiSelections']
        },
        files => {
          (files || []).forEach(file => {
            ipcRenderer.sendSync(`import-${type}`, file)
          })
        }
      )
    }
  }

  // 修改 Editable
  private static changeEditable(type: string) {
    return () => {
      switch (type) {
        case 'ResourcePack':
          ResourcePacks.changeEditable()
          break
        case 'Extension':
          Extensions.changeEditable()
          break
        case 'Tool':
          Tools.changeEditable()
          break
        default:
      }
    }
  }
}

ResourceManager.extend(darkModeTheme)
  .extend(springFestivalTheme)
  .init()
