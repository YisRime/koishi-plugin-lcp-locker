import { Context, Schema } from 'koishi'
import * as path from 'path'
import * as fs from 'fs/promises'

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
 * 主题类型映射表
 */
const THEME_MAP = {
  'orange': '活跃橙',
  'blue': '极客蓝',
  'pink': '铁杆粉',
  'lucky': '欧皇彩',
  'gold': '秋仪金',
  'all': '全部主题'
};

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
  hidePrefix: boolean
}

export const Config: Schema<Config> = Schema.object({
  apiEndpoint: Schema.string().description('API Endpoint').required(),
  apiKey: Schema.string().description('API Key').required(),
  hidePrefix: Schema.boolean().description('禁用描述文本显示').default(false),
  enableLucky: Schema.boolean().description('启用欧皇彩解锁日期获取').default(true),
  enableBlue: Schema.boolean().description('启用极客蓝解锁码获取').default(true),
  enablePink: Schema.boolean().description('启用铁杆粉解锁键值获取').default(true),
  enableOrange: Schema.boolean().description('启用活跃橙解锁码获取').default(true),
  enableGold: Schema.boolean().description('启用秋仪金解锁码获取').default(true),
  enableAll: Schema.boolean().description('启用全部主题解锁键值获取').default(true),
  enableCryptography: Schema.boolean().description('启用内容加解密').default(true)
})

/**
 * 插件主函数，用于初始化和注册命令
 * @param ctx - Koishi上下文
 * @param config - 插件配置
 */
export function apply(ctx: Context, config: Config) {
  /**
   * 向API发送请求
   * @param action - 操作类型
   * @param code - 识别码
   * @param content - 可选内容，用于加解密操作
   * @returns API响应结果
   */
  async function request(action: string, code: string, content?: string): Promise<ApiResponse> {
    try {
      const params = new URLSearchParams();
      params.append('identify', config.apiKey);
      params.append('code', code);
      params.append('action', action);
      if (content) params.append('content', content);
      const url = `${config.apiEndpoint}?${params.toString()}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.json();
    } catch {
      return { result: '' };
    }
  }

  /**
   * 处理各种主题相关命令
   * @param session - 用户会话
   * @param themeKey - 主题类型键名
   * @returns 包含解锁信息的响应字符串
   */
  async function handleThemeCommand(session, themeKey: string): Promise<string> {
    if (!session?.userId) return '';
    const code = await DataManager.getCode(ctx.baseDir, session.userId);
    if (!code) return '';
    try {
      const response = await request(themeKey, code);
      if (!response?.result) return '';
      // 只返回结果内容
      if (config.hidePrefix) {
        let result = response.result;
        if (themeKey === 'all' && config.enableGold && response.goldKey) {
          result += `\n${response.goldKey}`;
        }
        return result;
      }
      // 否则返回完整内容
      let result = `${THEME_MAP[themeKey]}${
        themeKey === 'lucky' ? '解锁日期' :
        themeKey === 'pink' ? '解锁键值(SystemCount)' :
        themeKey === 'all' ? '解锁键值(UiLauncherThemeHide2)' : '解锁码'
      }:\n${response.result}`;
      if (themeKey === 'all' && config.enableGold && response.goldKey) {
        result += `\n秋仪金解锁键值(UiLauncherThemeGold):\n${response.goldKey}`;
      }
      return result;
    } catch {
      return '';
    }
  }

  const unlk = ctx.command('unlk', '主题解锁')
    .usage('根据识别码生成对应解锁码或键值，解锁相应主题');

  unlk.subcommand('.code <code>', '绑定识别码')
    .usage(`输入识别码绑定`)
    .example(`unlk.code ABCD-EFGH-IJKL-MNOP 绑定新的识别码`)
    .action(async ({ session }, code?) => {
      if (!session?.userId) return '';
      // 直接检查识别码格式，不再需要前缀判断
      if (!/^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i.test(code)) {
        return ``;
      }
      const formattedCode = code.toUpperCase();
      await DataManager.addCode(ctx.baseDir, session.userId, formattedCode);
      return ``;
    });

  [
    { key: 'lucky', enabled: config.enableLucky, desc: '获取欧皇彩解锁日期', usage: '在指定日期使用"今日人品"功能解锁欧皇彩主题' },
    { key: 'blue', enabled: config.enableBlue, desc: '获取极客蓝解锁码', usage: '使用解锁码解锁极客蓝主题' },
    { key: 'pink', enabled: config.enablePink, desc: '获取铁杆粉解锁键值', usage: '修改注册表对应键值解锁铁杆粉主题' },
    { key: 'orange', enabled: config.enableOrange, desc: '获取活跃橙解锁码', usage: '使用解锁码解锁活跃橙主题' },
    { key: 'gold', enabled: config.enableGold, desc: '获取秋仪金解锁码', usage: '使用解锁码解锁秋仪金主题' },
    { key: 'all', enabled: config.enableAll, desc: '获取全部主题解锁键值', usage: '修改注册表对应键值解锁全部主题' }
  ].filter(theme => theme.enabled).forEach(theme => {
    unlk.subcommand(`.${theme.key}`, theme.desc)
      .usage(theme.usage)
      .action(async ({ session }) => handleThemeCommand(session, theme.key));
  });

  if (config.enableCryptography) {
    /**
     * 处理内容加密/解密功能
     * @param session - 用户会话
     * @param text - 要处理的文本内容
     * @param action - 操作类型：加密或解密
     * @returns 加密或解密后的结果字符串
     */
    async function handleCryptography(session, text: string, action: 'encrypt' | 'decrypt'): Promise<string> {
      if (!session?.userId || !text) return '';
      const code = await DataManager.getCode(ctx.baseDir, session.userId);
      if (!code) return '';
      try {
        const response = await request(action, code, text);
        return response?.result ? `${action === 'encrypt' ? '加密' : '解密'}结果:\n${response.result}` : '';
      } catch {
        return '';
      }
    }

    unlk.subcommand('.enpt <text>', '加密自定义内容')
      .usage('使用与主题相同的加密逻辑加密自定义内容')
      .action(async ({ session }, text) => handleCryptography(session, text, 'encrypt'));
    unlk.subcommand('.dept <text>', '解密自定义内容')
      .usage('使用与主题相同的解密逻辑解密自定义内容')
      .action(async ({ session }, text) => handleCryptography(session, text, 'decrypt'));
  }
}

/**
 * 用户数据管理类
 * 负责用户识别码的存储、读取和管理
 */
class DataManager {
  /**
   * 从文件中加载用户数据
   * @param dataDir - 数据目录路径
   * @returns 用户数据对象
   */
  static async loadData(dataDir: string): Promise<UserData> {
    try {
      const content = await fs.readFile(path.join(dataDir, 'data', 'lcp-locker.json'), 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  /**
   * 保存用户数据到文件
   * @param dataDir - 数据目录路径
   * @param data - 用户数据对象
   */
  static async saveData(dataDir: string, data: UserData): Promise<void> {
    try {
      const dataPath = path.join(dataDir, 'data');
      await fs.writeFile(path.join(dataPath, 'lcp-locker.json'), JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      return;
    }
  }

  /**
   * 添加或更新用户的识别码
   * @param dataDir - 数据目录路径
   * @param userId - 用户ID
   * @param code - 识别码
   */
  static async addCode(dataDir: string, userId: string, code: string): Promise<void> {
    const data = await this.loadData(dataDir);
    if (!data[userId]) data[userId] = { current: null, codes: [] };
    if (!data[userId].codes.includes(code)) data[userId].codes.push(code);
    data[userId].current = code;
    await this.saveData(dataDir, data);
  }

  /**
   * 获取用户当前绑定的识别码
   * @param dataDir - 数据目录路径
   * @param userId - 用户ID
   * @returns 用户当前的识别码，不存在则返回null
   */
  static async getCode(dataDir: string, userId: string): Promise<string | null> {
    const data = await this.loadData(dataDir);
    return data[userId]?.current || null;
  }
}