# koishi-plugin-lcp-locker

[![npm](https://img.shields.io/npm/v/koishi-plugin-lcp-locker?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-lcp-locker)

解密测试，个人自用

## 介绍

这是一个 Koishi 插件，用于生成不同类型主题的解锁码或键值。通过识别码，用户可以获取对应的解锁信息，包括活跃橙、极客蓝、铁杆粉、欧皇彩、秋仪金等主题。

## 功能特性

- 支持多种主题解锁信息的获取：
  - 活跃橙：生成解锁码
  - 极客蓝：生成解锁码
  - 铁杆粉：生成解锁键值
  - 欧皇彩：获取解锁日期
  - 秋仪金：生成解锁码
  - 全部主题：生成解锁键值
- 用户识别码的绑定与管理
- 提供内容加密/解密功能

## 配置说明

| 配置项 | 类型 | 默认值 | 说明 |
|-------|-----|-------|-----|
| apiEndpoint | string | - | API 服务地址（必填） |
| apiKey | string | - | API 密钥（必填） |
| hidePrefix | boolean | false | 是否禁用描述文本显示 |
| enableLucky | boolean | true | 是否启用欧皇彩解锁日期获取 |
| enableBlue | boolean | true | 是否启用极客蓝解锁码获取 |
| enablePink | boolean | true | 是否启用铁杆粉解锁键值获取 |
| enableOrange | boolean | true | 是否启用活跃橙解锁码获取 |
| enableGold | boolean | true | 是否启用秋仪金解锁码获取 |
| enableAll | boolean | true | 是否启用全部主题解锁键值获取 |
| enableCryptography | boolean | true | 是否启用内容加解密功能 |

## 使用方法

### 绑定识别码

首先需要绑定您的识别码：

```text
unlk.code ABCD-EFGH-IJKL-MNOP
```

识别码格式为：四组由连字符分隔的四个字符，每个字符为0-9或A-F。

### 获取解锁信息

绑定识别码后，可以使用以下命令获取对应主题的解锁信息：

```text
unlk.orange    # 获取活跃橙解锁码
unlk.blue      # 获取极客蓝解锁码
unlk.pink      # 获取铁杆粉解锁键值
unlk.lucky     # 获取欧皇彩解锁日期
unlk.gold      # 获取秋仪金解锁码
unlk.all       # 获取全部主题解锁键值
```

### 内容加解密

如果启用了加解密功能，可以使用以下命令：

```text
unlk.enpt 要加密的内容    # 加密文本
unlk.dept 要解密的内容    # 解密文本
```

## 注意事项

- 所有功能均需要有效的 API 服务和密钥
- 用户需要先绑定识别码才能使用其他功能
- 解锁信息的准确性取决于远程 API 的响应
