import { Context, Schema } from 'koishi'
import * as path from 'path'
import * as fs from 'fs/promises'
import axios from 'axios'

export const name = 'lcp-locker'

interface ApiResponse {
  result: string;
  goldKey?: string;
}

interface UserData {
  [userId: string]: {
    current: string;
    codes: string[];
  }
}

/**
 * 主题信息映射表
 * @constant THEME_MAP
 */
const THEME_MAP: Record<string, string> = {
  'orange': '活跃橙',
  'blue': '极客蓝',
  'pink': '铁杆粉',
  'lucky': '欧皇彩',
  'gold': '秋仪金',
  'all': '全部主题'
};

/**
 * 数据管理类 - 处理用户数据的存储和检索
 * @class DataManager
 */
class DataManager {
  /**
   * 加载用户数据
   * @param {string} dataDir - 数据目录
   * @returns {Promise<UserData>} 用户数据对象
   */
  static async loadData(dataDir: string): Promise<UserData> {
    try {
      const filePath = path.join(dataDir, 'data', 'lcp-locker.json');
      const content = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * 保存用户数据
   * @param {string} dataDir - 数据目录
   * @param {UserData} data - 用户数据对象
   * @returns {Promise<void>}
   */
  static async saveData(dataDir: string, data: UserData): Promise<void> {
    const dataPath = path.join(dataDir, 'data');
    const filePath = path.join(dataPath, 'lcp-locker.json');
    try {
      await fs.mkdir(dataPath, { recursive: true });
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      return;
    }
  }

  /**
   * 添加识别码并设为当前使用
   * @param {string} dataDir - 数据目录
   * @param {string} userId - 用户ID
   * @param {string} code - 识别码
   * @returns {Promise<void>}
   */
  static async addCode(dataDir: string, userId: string, code: string): Promise<void> {
    const data = await this.loadData(dataDir);
    if (!data[userId]) {
      data[userId] = { current: null, codes: [] };
    }
    // 添加到历史识别码列表
    if (!data[userId].codes.includes(code)) {
      data[userId].codes.push(code);
    }
    // 设置为当前使用的识别码
    data[userId].current = code;
    await this.saveData(dataDir, data);
  }

  /**
   * 获取用户当前识别码
   * @param {string} dataDir - 数据目录
   * @param {string} userId - 用户ID
   * @returns {Promise<string|null>} 用户当前识别码或null
   */
  static async getCode(dataDir: string, userId: string): Promise<string | null> {
    const data = await this.loadData(dataDir);
    return data[userId]?.current || null;
  }
}

/**
 * 插件配置接口
 * @interface Config
 */
export interface Config {
  enableBlue: boolean
  enablePink: boolean
  enableLucky: boolean
  enableOrange: boolean
  enableGold: boolean
  enableAll: boolean
  enableCryptography: boolean
  apiEndpoint: string
  apiKey: string
}

export const Config: Schema<Config> = Schema.object({
  apiEndpoint: Schema.string().description('API Point').required(),
  apiKey: Schema.string().description('API Key').required(),
  enableLucky: Schema.boolean().description('启用欧皇彩解锁日期获取').default(true),
  enableBlue: Schema.boolean().description('启用极客蓝解锁码获取').default(true),
  enablePink: Schema.boolean().description('启用铁杆粉解锁键值获取').default(true),
  enableOrange: Schema.boolean().description('启用活跃橙解锁码获取').default(true),
  enableGold: Schema.boolean().description('启用秋仪金解锁码获取').default(true),
  enableAll: Schema.boolean().description('启用全部主题解锁键值获取').default(true),
  enableCryptography: Schema.boolean().description('启用内容加解密').default(true),
})

/**
 * 插件应用函数
 * @param {Context} ctx - Koishi上下文
 * @param {Config} config - 插件配置
 */
export function apply(ctx: Context, config: Config) {
  /**
   * 发送API请求
   * @param {string} action - 请求动作
   * @param {string} code - 识别码
   * @param {string} [content] - 请求内容
   * @returns {Promise<ApiResponse>} API响应
   */
  async function request(action: string, code: string, content?: string): Promise<ApiResponse> {
    try {
      const params: Record<string, string> = {
        identify: config.apiKey,
        code,
        action
      };
      if (content) params.content = content;
      const response = await axios.get<ApiResponse>(config.apiEndpoint, { params });
      return response.data;
    } catch (error) {
      throw new Error(`API请求失败: ${error.message}`);
    }
  }
  /**
   * 处理主题命令
   * @param {string} session - 用户会话
   * @param {string} themeKey - 主题键名
   * @returns {Promise<string>} 响应消息
   */
  async function handleThemeCommand(session, themeKey: string): Promise<string> {
    if (!session?.userId) return '无法获取用户ID';
    const code = await DataManager.getCode(ctx.baseDir, session.userId);
    if (!code) return '请先绑定识别码';
    try {
      const response = await request(themeKey, code);
      let result = `${THEME_MAP[themeKey]}${themeKey === 'lucky' ? '解锁日期' :
        themeKey === 'pink' ? '解锁键值(SystemCount)' :
        themeKey === 'all' ? '全部主题解锁键值(UiLauncherThemeHide2)' : '解锁码'}:\n${response.result}`;
      if (themeKey === 'all' && config.enableGold && response.goldKey) {
        result += `\n秋仪金解锁键值(UiLauncherThemeGold):\n${response.goldKey}`;
      }
      return result;
    } catch (error) {
      return `获取${THEME_MAP[themeKey]}${themeKey === 'lucky' ? '解锁日期' :
        themeKey === 'pink' || themeKey === 'all' ? '解锁键值' : '解锁码'}失败: ${error.message}`;
    }
  }
  // 注册主命令
  const unlk = ctx.command('unlk', '启动器主题解锁')
    .usage('根据识别码生成对应解锁码或键值，从而解锁对应主题');
  // 查看或绑定识别码
  unlk.subcommand('.code [code]', '查询或绑定识别码')
    .usage('查询当前绑定的识别码或绑定新识别码')
    .example('unlk.code XXXX-XXXX-XXXX-XXXX 绑定识别码')
    .action(async ({ session }, code?) => {
      if (!session?.userId) return '无法获取用户ID';
      if (code) {
        if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(code)) {
          return '识别码格式不正确！';
        }
        await DataManager.addCode(ctx.baseDir, session.userId, code.toUpperCase());
        return `已绑定识别码: ${code}`;
      }
      const currentCode = await DataManager.getCode(ctx.baseDir, session.userId);
      return currentCode ? `当前识别码: ${currentCode}` : '请先绑定识别码';
    });
  // 根据配置动态注册主题命令
  const themeCommands = [
    { key: 'lucky', enabled: config.enableLucky, desc: '获取欧皇彩解锁日期', usage: '在对应日期使用"今日人品"从而解锁欧皇彩' },
    { key: 'blue', enabled: config.enableBlue, desc: '获取极客蓝解锁码', usage: '输入解锁码从而解锁极客蓝' },
    { key: 'pink', enabled: config.enablePink, desc: '获取铁杆粉解锁键值', usage: '修改注册表对应键值从而解锁铁杆粉' },
    { key: 'orange', enabled: config.enableOrange, desc: '获取活跃橙解锁码', usage: '输入解锁码从而解锁活跃橙' },
    { key: 'gold', enabled: config.enableGold, desc: '获取秋仪金解锁码', usage: '输入解锁码从而解锁秋仪金' },
    { key: 'all', enabled: config.enableAll, desc: '获取全部主题解锁键值', usage: '修改注册表对应键值从而解锁全部主题' }
  ];
  themeCommands.forEach(theme => {
    if (theme.enabled) {
      unlk.subcommand(`.${theme.key}`, theme.desc)
        .usage(theme.usage)
        .action(async ({ session }) => handleThemeCommand(session, theme.key));
    }
  });
  // 注册加解密命令
  if (config.enableCryptography) {
    /**
     * 处理加解密命令
     * @param {string} session - 用户会话
     * @param {string} text - 待处理文本
     * @param {string} action - 动作类型
     * @returns {Promise<string>} 响应消息
     */
    async function handleCryptography(session, text: string, action: 'encrypt' | 'decrypt'): Promise<string> {
      if (!session?.userId) return '无法获取用户ID';
      if (!text) return `请输入需要${action === 'encrypt' ? '加密' : '解密'}的内容`;
      const code = await DataManager.getCode(ctx.baseDir, session.userId);
      if (!code) return '请先绑定识别码';
      try {
        const response = await request(action, code, text);
        return `${action === 'encrypt' ? '加密' : '解密'}结果:\n${response.result}`;
      } catch (error) {
        return `${action === 'encrypt' ? '加密' : '解密'}失败: ${error.message}`;
      }
    }
    unlk.subcommand('.enpt <text>', '加密自定义内容')
      .usage('使用与主题相同的逻辑加密自定义内容')
      .action(async ({ session }, text) => handleCryptography(session, text, 'encrypt'));
    unlk.subcommand('.dept <text>', '解密自定义内容')
      .usage('使用与主题相同的逻辑解密自定义内容')
      .action(async ({ session }, text) => handleCryptography(session, text, 'decrypt'));
  }
}