# ModLoader API 参考手册

本文档基于当前代码实现整理，目标是提供一份可直接对照源码使用的 API 文档。

核心约定：

- `register(...)` 负责注入数据或规则
- `show()` 只返回原始数据

---

## 1. 使用前提

1. Tyrano 运行时已就绪。
2. 当前脚本能访问全局 `modloader`。
3. 注册类接口通常要求传入数组，即使只有一条数据也建议用数组包装。

很多字段支持动态函数，典型签名如下：

```javascript
(f, sf) => {
  return '动态结果';
}
```

---

## 2. 模块结构

```text
core/mod-helper.js
core/module-runtime.js
core/data-module-factory.js
core/collection-module-factory.js
core/special-module-factory.js

modules/ks-script-module.js
modules/character-setting-module.js
modules/character-data-module.js
modules/character-profile-module.js
modules/ending-module.js
modules/word-module.js
modules/gallery-module.js
modules/omake-module.js
modules/theater-module.js
modules/sticker-module.js
modules/effect-module.js
modules/system-variable-module.js
```

---

## 3. API 总览

```javascript
modloader.api.chara.profile.register(...)
modloader.api.chara.profile.show()

modloader.api.chara.data.character.register(...)
modloader.api.chara.data.devil.register(...)
modloader.api.chara.data.show()

modloader.api.chara.setting.register(...)
modloader.api.chara.setting.show()

modloader.api.ending.register(...)
modloader.api.ending.show()

modloader.api.word.register(...)
modloader.api.word.show()

modloader.api.gallery.register(...)
modloader.api.gallery.show()

modloader.api.omake.register(...)
modloader.api.omake.show()

modloader.api.gekizyou.register(...)
modloader.api.gekizyou.show()

modloader.api.sticker.register(...)
modloader.api.sticker.show()

modloader.api.effect.register(...)
modloader.api.effect.show()

modloader.api.sysvar.register(...)
modloader.api.sysvar.show()

modloader.api.ks.register.json(...)
modloader.api.ks.register.raw(...)
modloader.api.ks.list()
modloader.api.ks.show.json(...)
modloader.api.ks.show.raw(...)
modloader.api.ks.show.summary()
```

---

## 4. 通用约定

### 4.1 `register(...)` 返回值

大多数 `register(...)` 接口遵循：

- 成功：返回成功注册的数据数组
- 输入无效：返回 `null`
- 运行时未就绪：返回 `null`
- 没有任何有效数据通过校验：返回 `null`

### 4.2 `show()` 返回值

当前项目已统一为：

- `show()` 只返回原始数据
- 不再返回任何用于 UI / 调试面板展示的包装结构
- 不再提供 `type`、`title`、`items`、`columns`、`data` 等展示字段
- 调用方如需界面展示，请自行基于原始数据转换

### 4.3 `mode` 常见语义

- `append`：追加到末尾
- `prepend`：插入到开头
- `override`：按唯一标识覆盖已有项
- `replace`：替换整个集合
- `fixed`：固定槽位 / 固定 ID 注入

不是每个模块都支持全部 `mode`，以对应模块实现为准。

### 4.4 `register(...)` 字段速查

#### `modloader.api.chara.profile.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.no`、`entry.data.description`、`entry.data.sex`、`entry.data.breed`、`entry.data.category`、`entry.data.alts`
- 支持的 `mode`：`append`、`prepend`

#### `modloader.api.chara.data.character.register(dataArray)`
- 必填字段：`entry.data.name`、`entry.data.folder`
- 常见可选字段：`entry.mode`、`entry.target`、`entry.data.difficulty`、`entry.data.phrase`、`entry.data.cond`、`entry.data.scenario`、`entry.data.tutorial`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`entry.target` 常见值为 `notKilled` 或 `killed`；不传时按 `notKilled` 处理

#### `modloader.api.chara.data.devil.register(dataArray)`
- 必填字段：`entry.data.name`、`entry.data.folder`
- 常见可选字段：`entry.mode`、`entry.data.difficulty`、`entry.data.phrase`、`entry.data.cond`、`entry.data.scenario`、`entry.data.tutorial`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `modloader.api.chara.setting.register(dataArray)`
- 必填字段：`entry.name`
- 常见可选字段：`entry.audio`、`entry.font`
- 支持的 `mode`：无
- 说明：该模块不使用 `mode`

#### `modloader.api.ending.register(dataArray)`
- 必填字段：`entry.data.title`
- 常见可选字段：`entry.mode`、`entry.id`、`entry.data.category`、`entry.data.phrase`、`entry.data.timing`、`entry.data.cond`、`entry.data.hintCond`、`entry.data.bgType`
- 支持的 `mode`：`append`、`fixed`
- 说明：`fixed + id` 会写入指定 ID

#### `modloader.api.word.register(dataArray)`
- 必填字段：`entry.data`
- 常见可选字段：`entry.type`、`entry.mode`
- 支持的 `mode`：`append`、`prepend`、`replace`
- 说明：`entry.type` 不传时默认写入 `ngWords`

#### `modloader.api.gallery.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.title`、`entry.data.storages`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `modloader.api.omake.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.title`、`entry.data.cond`、`entry.data.storage`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `modloader.api.gekizyou.register(dataArray)`
- 必填字段：`entry.data`
- 常见可选字段：`entry.mode`
- 支持的 `mode`：`append`、`prepend`、`replace`
- 说明：`entry.data` 通常是编号数组

#### `modloader.api.sticker.register(dataArray)`
- 必填字段：`entry.data.file`
- 常见可选字段：`entry.mode`、`entry.data.name`、`entry.data.desc`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `modloader.api.effect.register(dataArray)`
- 必填字段：`entry.data.file` 或 `entry.data.name` 至少一个
- 常见可选字段：`entry.mode`、`entry.data.mode`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `modloader.api.ks.register.json(rules)`
- 必填字段：`rule.target`、`rule.transform`
- 常见可选字段：`rule.description`
- 支持的 `mode`：无

#### `modloader.api.ks.register.raw(rules)`
- 必填字段：`rule.target`、`rule.transform`
- 常见可选字段：`rule.description`
- 支持的 `mode`：无

### 4.5 `register(...)` 最小合法示例

#### `modloader.api.chara.profile.register(...)`

```javascript
modloader.api.chara.profile.register([
  {
    data: {
      name: '示例角色'
    }
  }
]);
```

#### `modloader.api.chara.data.character.register(...)`

```javascript
modloader.api.chara.data.character.register([
  {
    data: {
      name: '示例角色',
      folder: '101'
    }
  }
]);
```

#### `modloader.api.chara.data.devil.register(...)`

```javascript
modloader.api.chara.data.devil.register([
  {
    data: {
      name: '示例恶魔',
      folder: '201'
    }
  }
]);
```

#### `modloader.api.chara.setting.register(...)`

```javascript
modloader.api.chara.setting.register([
  {
    name: '示例角色'
  }
]);
```

#### `modloader.api.ending.register(...)`

```javascript
modloader.api.ending.register([
  {
    data: {
      title: '示例结局'
    }
  }
]);
```

#### `modloader.api.word.register(...)`

```javascript
modloader.api.word.register([
  {
    data: ['示例词汇']
  }
]);
```

#### `modloader.api.gallery.register(...)`

```javascript
modloader.api.gallery.register([
  {
    data: {
      name: 'example_gallery'
    }
  }
]);
```

#### `modloader.api.omake.register(...)`

```javascript
modloader.api.omake.register([
  {
    data: {
      name: 'example_omake'
    }
  }
]);
```

#### `modloader.api.gekizyou.register(...)`

```javascript
modloader.api.gekizyou.register([
  {
    data: [45]
  }
]);
```

#### `modloader.api.sticker.register(...)`

```javascript
modloader.api.sticker.register([
  {
    data: {
      file: '999'
    }
  }
]);
```

#### `modloader.api.effect.register(...)`

```javascript
modloader.api.effect.register([
  {
    data: {
      file: 'example_effect'
    }
  }
]);
```

#### `modloader.api.ks.register.json(...)`

```javascript
modloader.api.ks.register.json([
  {
    target: 'scene/test.ks',
    transform: function(data) {
      return data;
    }
  }
]);
```

#### `modloader.api.ks.register.raw(...)`

```javascript
modloader.api.ks.register.raw([
  {
    target: 'scene/test.ks',
    transform: function(text) {
      return text;
    }
  }
]);
```

---

### 4.6 常见调用用例

以下示例偏向“实际模组开发”场景，不再只是最小合法输入。

#### 角色资料：追加一个新角色简介

```javascript
modloader.api.chara.profile.register([
  {
    mode: 'append',
    data: {
      name: '露西法',
      no: 'EX-01',
      sex: '女',
      breed: '恶魔',
      category: 'mod',
      description: function(f, sf) {
        return sf.kill > 0 ? '黑化路线下可见的隐藏角色。' : '通关后可在资料页查看。';
      }
    }
  }
]);
```

#### 角色数据：在普通路线追加新角色

```javascript
modloader.api.chara.data.character.register([
  {
    mode: 'append',
    target: 'notKilled',
    data: {
      name: '测试角色',
      folder: '901',
      difficulty: 2,
      phrase: '你是来见我的吗？',
      scenario: 'scenario/mod/test_character.ks',
      tutorial: 'tutorial_test_character.ks'
    }
  }
]);
```

#### 系统变量：永久写入一个 Mod 开关

```javascript
modloader.api.sysvar.register([
  {
    key: 'mod.example.enabled',
    value: true,
    type: 'direct'
  }
]);
```

#### 系统变量：临时切换到 kill 路线

```javascript
modloader.api.sysvar.register([
  {
    key: 'kill',
    value: 1,
    type: 'temp'
  }
]);
```

#### KS 原文规则：直接替换脚本文本

```javascript
modloader.api.ks.register.raw([
  {
    target: 'scene/main.ks',
    description: '把某句原版文本替换为 Mod 文本',
    transform: function(text) {
      return text.replace('原版文本', '替换后的 Mod 文本');
    }
  }
]);
```

## 5. 分模块文档

### 5.1 `modloader.api.chara.profile`

```javascript
modloader.api.chara.profile.register(dataArray)
modloader.api.chara.profile.show()
```

`show()` 返回角色资料原始数组：

```javascript
[
  {
    name: '角色名',
    no: '编号',
    breed: '种族',
    category: '分类',
    description: '描述或函数求值结果'
  }
]
```

### 5.2 `modloader.api.chara.data`

```javascript
modloader.api.chara.data.character.register(dataArray)
modloader.api.chara.data.devil.register(dataArray)
modloader.api.chara.data.show()
```

`show()` 精确返回值：

```javascript
{
  route: 'notKilled',
  characters: [{ name: '角色名', folder: '55' }],
  devils: [{ name: '恶魔名', folder: '66' }]
}
```

### 5.3 `modloader.api.chara.setting`

```javascript
modloader.api.chara.setting.register(dataArray)
modloader.api.chara.setting.show()
```

`show()` 精确返回值：

```javascript
{
  audioStore: {},
  fontStore: {},
  registeredNames: ['角色A', '角色B']
}
```

### 5.4 `modloader.api.ending`

```javascript
modloader.api.ending.register(dataArray)
modloader.api.ending.show()
```

`show()` 返回结局原始对象：

```javascript
{
  0: { title: '结局A', category: 'normal' },
  1: { title: '结局B', category: 'special' }
}
```

### 5.5 `modloader.api.word`

```javascript
modloader.api.word.register(dataArray)
modloader.api.word.show()
```

`show()` 精确返回值：

```javascript
{
  ngWords: ['词1', '词2'],
  someWords: ['词3']
}
```

### 5.6 `modloader.api.gallery`

```javascript
modloader.api.gallery.register(dataArray)
modloader.api.gallery.show()
```

`show()` 返回画廊原始数组：

```javascript
[
  {
    name: 'custom_gallery',
    title: '自定义画廊',
    storages: ['bgimage/custom1.webp']
  }
]
```

### 5.7 `modloader.api.omake`

```javascript
modloader.api.omake.register(dataArray)
modloader.api.omake.show()
```

`show()` 返回番外原始数组：

```javascript
[
  {
    name: 'custom_scene',
    title: '[Mod番外]新的冒险',
    cond: '达成特定条件后解锁',
    storage: 'omake_custom_file'
  }
]
```

### 5.8 `modloader.api.gekizyou`

```javascript
modloader.api.gekizyou.register(dataArray)
modloader.api.gekizyou.show()
```

`show()` 精确返回值：

```javascript
[45, 46, 47]
```

### 5.9 `modloader.api.sticker`

```javascript
modloader.api.sticker.register(dataArray)
modloader.api.sticker.show()
```

`show()` 返回贴纸原始数组：

```javascript
[
  {
    file: '999',
    name: '自定义贴纸',
    desc: '描述或函数求值结果'
  }
]
```

### 5.10 `modloader.api.effect`

```javascript
modloader.api.effect.register(dataArray)
modloader.api.effect.show()
```

`show()` 返回特效原始数组：

```javascript
[
  {
    name: '自定义特效',
    file: 'custom_effect',
    mode: 'screen'
  }
]
```

### 5.11 `modloader.api.ks`

```javascript
modloader.api.ks.register.json(rules)
modloader.api.ks.register.raw(rules)
modloader.api.ks.list()
modloader.api.ks.show.json(fileName)
modloader.api.ks.show.raw(fileName)
modloader.api.ks.show.summary()
```

- `ks.list()` 返回路径数组
- `ks.show.json(fileName)` 返回 `{ fileName, data }`
- `ks.show.raw(fileName)` 返回 `{ fileName, originalText, transformedText }`
- `ks.show.summary()` 返回 `{ paths, rawScripts, parsedScripts, rawRules, jsonRules }`

---

## 6. 调试面板 API

```javascript
modloader.api.panel.registerPage(config)
modloader.api.panel.open(id)
```

推荐由 `loader()` 把原始数据转成展示协议：

- 列表：`{ type: 'list', title, columns, items, raw }`
- 对象：`{ type: 'object', title, data, raw }`

---

## 7. 推荐实践

- 注册时始终用数组
- 动态字段尽量保持纯函数
- 展示逻辑优先放进 panel
- KS 规则最好补 `description`

---

## 8. 常见问题

### 为什么 `register(...)` 返回 `null`？

常见原因：

- 传入结构不符合要求
- 引擎未就绪
- 所有条目都未通过校验
- 必填字段缺失

### 为什么现在 `show()` 更简单？

因为当前设计目标是：

- `show()` 只返回原始数据
- `panel` 单独处理展示
- 避免展示协议污染业务 API

