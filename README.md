# ModLoader API 参考手册

本文档基于当前代码实现整理，目标是提供一份可直接对照源码使用的 API 文档。

核心约定：

- `register(...)` 负责注入数据或规则
- `show()` 只返回原始数据

---

## 1. 使用前提

1. Tyrano 运行时已就绪。
2. 当前脚本能访问全局 `window.modloaderApi`。
3. 注册类接口通常要求传入数组，即使只有一条数据也建议用数组包装。

`window.modloaderApi` 是此模组提供的扩展 API. 它与宿主提供的文件接口 `window.modloader` 相互独立。

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
modules/character-category.js
modules/ending-module.js
modules/word-module.js
modules/gallery-module.js
modules/omake-module.js
modules/theater-module.js
modules/sticker-module.js
modules/effect-module.js
modules/system-variable-module.js
modules/language.js
```

---

## 3. API 总览

```javascript
window.modloaderApi.chara.profile.register(...)
window.modloaderApi.chara.profile.patch.register(...)
window.modloaderApi.chara.profile.show()

window.modloaderApi.chara.category.register(...)
window.modloaderApi.chara.category.patch.register(...)
window.modloaderApi.chara.category.show()

window.modloaderApi.chara.data.character.register(...)
window.modloaderApi.chara.data.character.patch.register(...)
window.modloaderApi.chara.data.devil.register(...)
window.modloaderApi.chara.data.devil.patch.register(...)
window.modloaderApi.chara.data.show()

window.modloaderApi.chara.setting.register(...)
window.modloaderApi.chara.setting.show()

window.modloaderApi.ending.register(...)
window.modloaderApi.ending.patch.register(...)
window.modloaderApi.ending.show()
window.modloaderApi.ending.category.register(...)
window.modloaderApi.ending.category.patch.register(...)
window.modloaderApi.ending.category.show()

window.modloaderApi.word.register(...)
window.modloaderApi.word.show()

window.modloaderApi.lang.register(...)
window.modloaderApi.lang.show()

window.modloaderApi.gallery.register(...)
window.modloaderApi.gallery.patch.register(...)
window.modloaderApi.gallery.show()

window.modloaderApi.omake.register(...)
window.modloaderApi.omake.patch.register(...)
window.modloaderApi.omake.show()
window.modloaderApi.omake.ex.register(...)
window.modloaderApi.omake.ex.patch.register(...)
window.modloaderApi.omake.ex.show()

window.modloaderApi.gekizyou.register(...)
window.modloaderApi.gekizyou.show()

window.modloaderApi.sticker.register(...)
window.modloaderApi.sticker.patch.register(...)
window.modloaderApi.sticker.show()

window.modloaderApi.effect.register(...)
window.modloaderApi.effect.patch.register(...)
window.modloaderApi.effect.show()

window.modloaderApi.sysvar.register(...)
window.modloaderApi.sysvar.show()

window.modloaderApi.ks.register.json(...)
window.modloaderApi.ks.register.raw(...)
window.modloaderApi.ks.list()
window.modloaderApi.ks.show()
window.modloaderApi.ks.show.json(...)
window.modloaderApi.ks.show.raw(...)
```

## 3.1 依赖模组注册握手

启用模组中声明依赖 `modloader-api` 的模组，应在自己的注入脚本完成初始化后回报结果：

```javascript
window.modloaderApi.registration.complete('my-mod-id', true)
// 失败时传入 false，可附带错误信息
window.modloaderApi.registration.complete('my-mod-id', false, error)
```

`registration.onRegistration(callback)` 会收到每个模组的成功/失败事件，以及最终的 `ready` 或 `failed` 事件。`registration.waitForCompletion()` 返回 Promise；游戏的 `first.ks` 会在所有已启用依赖模组回报后继续执行。

可用 `registration.status()` 查看 `expected`、`completed` 和 `pending`。预期数量来自 `cache/mod-info.json` 中已启用且 `depends.modloader-api` 存在的条目。

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

#### `window.modloaderApi.chara.profile.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.no`、`entry.data.description`、`entry.data.sex`、`entry.data.breed`、`entry.data.category`、`entry.data.alts`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`override` 按 `entry.data.name` 完整替换原有角色资料；不存在同名角色时追加到末尾。

#### `window.modloaderApi.chara.profile.patch.register(dataArray)`
- 必填字段：`entry.data.name`
- 说明：仅合并提供的角色资料字段，不改变原角色顺序；只有设定 `appendIfMissing: true` 时才会追加新角色。

#### `window.modloaderApi.chara.category.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.visibility`、`entry.data.text`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`visibility: 'always'` 为默认值, 分类会立即显示并纳入未全解锁统计; `visibility: 'allCharasOpen'` 仅在 `allCharasOpenInCollection()` 为真时显示和统计

#### `window.modloaderApi.chara.category.patch.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.appendIfMissing`、`entry.data.text`
- 说明：仅覆盖同名分类中提供的显示字段；默认不会新增分类。

#### `window.modloaderApi.chara.data.character.register(dataArray)`
- 必填字段：`entry.data.name`、`entry.data.folder`
- 常见可选字段：`entry.mode`、`entry.target`、`entry.data.difficulty`、`entry.data.phrase`、`entry.data.cond`、`entry.data.scenario`、`entry.data.tutorial`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`entry.target` 常见值为 `notKilled` 或 `killed`；不传时按 `notKilled` 处理

#### `window.modloaderApi.chara.data.character.patch.register(dataArray)`
- 必填字段：`entry.data.name`、`entry.data.folder`
- 常见可选字段：`entry.appendIfMissing`、`entry.target`、角色数据的任意字段
- 说明：以 `folder` 为标识合并已有普通角色；默认不新增项目。

#### `window.modloaderApi.chara.data.devil.register(dataArray)`
- 必填字段：`entry.data.name`、`entry.data.folder`
- 常见可选字段：`entry.mode`、`entry.data.difficulty`、`entry.data.phrase`、`entry.data.cond`、`entry.data.scenario`、`entry.data.tutorial`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `window.modloaderApi.chara.data.devil.patch.register(dataArray)`
- 必填字段：`entry.data.name`、`entry.data.folder`
- 常见可选字段：`entry.appendIfMissing`、恶魔数据的任意字段
- 说明：以 `folder` 为标识合并已有恶魔；默认不新增项目。

#### `window.modloaderApi.chara.setting.register(dataArray)`
- 必填字段：`entry.name`
- 常见可选字段：`entry.audio`、`entry.font`
- 支持的 `mode`：无
- 说明：该模块不使用 `mode`

#### `window.modloaderApi.ending.register(dataArray)`
- 必填字段：`entry.data.title`；也可传入返回结局对象的 `entry.data` 函数
- 常见可选字段：`entry.mode`、`entry.id`、`entry.data.category`、`entry.data.phrase`、`entry.data.timing`、`entry.data.cond`、`entry.data.hintCond`、`entry.data.bgType`
- 支持的 `mode`：`append`、`fixed`
- 说明：`fixed + id` 会完整替换指定 ID。函数形式的 `data` 会在每次读取结局时计算，适用于依赖 `f`、`sf` 或图鉴方法的动态文本。

#### `window.modloaderApi.ending.patch.register(dataArray)`
- 必填字段：`entry.id`、`entry.data`
- 说明：仅合并指定结局 ID 的提供字段；不存在该 ID 时默认忽略，设定 `appendIfMissing: true` 才创建该 ID。

#### `window.modloaderApi.ending.category.patch.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.appendIfMissing`、`entry.data.text`
- 说明：仅合并同名结局分类的提供字段，保持原分类顺序；默认不会新增分类。

#### `window.modloaderApi.word.register(dataArray)`
- 必填字段：`entry.data`
- 常见可选字段：`entry.type`、`entry.mode`
- 支持的 `mode`：`append`、`prepend`、`replace`
- 说明：`entry.type` 不传时默认写入 `ngWords`

#### `window.modloaderApi.lang.register(dataArray)`
- 必填字段：`entry.data`
- 常见可选字段：`entry.mode`
- 支持的 `mode`：`append`、`override`
- 说明：`entry.data` 按 `window.tyrano_lang` 的对象结构传入, `append` 仅新增不存在的键, `override` 递归覆盖已有键

#### `window.modloaderApi.gallery.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.title`、`entry.data.storages`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`override` 按 `entry.data.name` 完整替换同名项。

#### `window.modloaderApi.gallery.patch.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.appendIfMissing`、`entry.data.title`、`entry.data.storages`
- 说明：仅合并同名画廊的提供字段并保留原顺序；分页读取时会自动识别原项目，避免错误追加到当前页或末尾。

#### `window.modloaderApi.omake.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.title`、`entry.data.cond`、`entry.data.storage`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`override` 按 `entry.data.name` 完整替换同名项。

#### `window.modloaderApi.omake.patch.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.appendIfMissing`、`entry.data.title`、`entry.data.cond`、`entry.data.storage`
- 说明：仅合并同名番外的提供字段并保留原顺序；分页读取时会自动识别原项目，避免错误追加到当前页或末尾。

#### `window.modloaderApi.omake.ex.register(dataArray)`
- 对应新版游戏的 `TYRANO.kag.dc.additionalNgSceneData()`；旧版游戏没有该函数时不会安装钩子。
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.mode`、`entry.data.title`、`entry.data.cond`、`entry.data.storage`
- 支持的 `mode`：`append`、`prepend`、`override`
- 说明：`override` 按 `entry.data.name` 完整替换同名扩展番外。

#### `window.modloaderApi.omake.ex.patch.register(dataArray)`
- 必填字段：`entry.data.name`
- 常见可选字段：`entry.appendIfMissing`、`entry.data.title`、`entry.data.cond`、`entry.data.storage`
- 说明：仅合并同名扩展番外的提供字段，保持原顺序；未命中时默认不追加。

#### `window.modloaderApi.gekizyou.register(dataArray)`
- 必填字段：`entry.data`
- 常见可选字段：`entry.mode`
- 支持的 `mode`：`append`、`prepend`、`replace`
- 说明：`entry.data` 通常是编号数组

#### `window.modloaderApi.sticker.register(dataArray)`
- 必填字段：`entry.data.file`
- 常见可选字段：`entry.mode`、`entry.data.name`、`entry.data.desc`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `window.modloaderApi.sticker.patch.register(dataArray)`
- 必填字段：`entry.data.file`
- 常见可选字段：`entry.appendIfMissing`、`entry.data.name`、`entry.data.desc`
- 说明：以 `file` 为标识合并已有贴纸，保持原顺序。

#### `window.modloaderApi.effect.register(dataArray)`
- 必填字段：`entry.data.file` 或 `entry.data.name` 至少一个
- 常见可选字段：`entry.mode`、`entry.data.mode`
- 支持的 `mode`：`append`、`prepend`、`override`

#### `window.modloaderApi.effect.patch.register(dataArray)`
- 必填字段：`entry.data.file` 或 `entry.data.name` 至少一个
- 常见可选字段：`entry.appendIfMissing`、特效数据的任意字段
- 说明：优先以 `file`、其次以 `name` 为标识合并已有特效，保持原顺序。

> `chara.setting` 是立即执行的角色音频/字体命令；`word`、`gekizyou` 是无字段可合并的标量集合；`lang.register({ mode: 'override' })` 已是递归局部覆盖；`sysvar.register(...)` 本身就是按路径写入补丁。因此这些接口不另设 `patch.register`，以避免重复且含义不清的 API。

#### `window.modloaderApi.ks.register.json(rules)`
- 必填字段：`rule.target`、`rule.transform`
- 常见可选字段：`rule.description`
- 支持的 `mode`：无

#### `window.modloaderApi.ks.register.raw(rules)`
- 必填字段：`rule.target`、`rule.transform`
- 常见可选字段：`rule.description`
- 支持的 `mode`：无

### 4.5 `register(...)` 最小合法示例

#### `window.modloaderApi.chara.profile.register(...)`

```javascript
window.modloaderApi.chara.profile.register([
  {
    data: {
      name: '示例角色'
    }
  }
]);
```

#### `window.modloaderApi.chara.category.register(...)`

```javascript
window.modloaderApi.chara.category.register([
  {
    data: {
      name: 'oc',
      visibility: 'always'
    }
  },
  {
    data: {
      name: 'secret',
      visibility: 'allCharasOpen'
    }
  }
]);
```

#### `window.modloaderApi.chara.data.character.register(...)`

```javascript
window.modloaderApi.chara.data.character.register([
  {
    data: {
      name: '示例角色',
      folder: '101'
    }
  }
]);
```

#### `window.modloaderApi.chara.data.devil.register(...)`

```javascript
window.modloaderApi.chara.data.devil.register([
  {
    data: {
      name: '示例恶魔',
      folder: '201'
    }
  }
]);
```

#### `window.modloaderApi.chara.setting.register(...)`

```javascript
window.modloaderApi.chara.setting.register([
  {
    name: '示例角色'
  }
]);
```

#### `window.modloaderApi.ending.register(...)`

```javascript
window.modloaderApi.ending.register([
  {
    data: {
      title: '示例结局'
    }
  }
]);
```

#### `window.modloaderApi.word.register(...)`

```javascript
window.modloaderApi.word.register([
  {
    data: ['示例词汇']
  }
]);
```

#### `window.modloaderApi.lang.register(...)`

```javascript
window.modloaderApi.lang.register([
  {
    mode: 'override',
    data: {
      word: {
        custom_label: '自定义文本'
      },
      novel: {
        custom_button: 'custom_button.png'
      }
    }
  }
]);
```

#### `window.modloaderApi.gallery.register(...)`

```javascript
window.modloaderApi.gallery.register([
  {
    data: {
      name: 'example_gallery'
    }
  }
]);
```

#### `window.modloaderApi.omake.register(...)`

```javascript
window.modloaderApi.omake.register([
  {
    data: {
      name: 'example_omake'
    }
  }
]);
```

#### `window.modloaderApi.gekizyou.register(...)`

```javascript
window.modloaderApi.gekizyou.register([
  {
    data: [45]
  }
]);
```

#### `window.modloaderApi.sticker.register(...)`

```javascript
window.modloaderApi.sticker.register([
  {
    data: {
      file: '999'
    }
  }
]);
```

#### `window.modloaderApi.effect.register(...)`

```javascript
window.modloaderApi.effect.register([
  {
    data: {
      file: 'example_effect'
    }
  }
]);
```

#### `window.modloaderApi.ks.register.json(...)`

```javascript
window.modloaderApi.ks.register.json([
  {
    target: 'scene/test.ks',
    transform: function(data) {
      return data;
    }
  }
]);
```

#### `window.modloaderApi.ks.register.raw(...)`

```javascript
window.modloaderApi.ks.register.raw([
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
window.modloaderApi.chara.profile.register([
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
window.modloaderApi.chara.data.character.register([
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
window.modloaderApi.sysvar.register([
  {
    key: 'mod.example.enabled',
    value: true,
    type: 'direct'
  }
]);
```

#### 系统变量：临时切换到 kill 路线

```javascript
window.modloaderApi.sysvar.register([
  {
    key: 'kill',
    value: 1,
    type: 'temp'
  }
]);
```

#### KS 原文规则：直接替换脚本文本

```javascript
window.modloaderApi.ks.register.raw([
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

### 5.1 `window.modloaderApi.chara.profile`

```javascript
window.modloaderApi.chara.profile.register(dataArray)
window.modloaderApi.chara.profile.patch.register(dataArray)
window.modloaderApi.chara.profile.show()
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

### 5.1.1 `window.modloaderApi.chara.category`

```javascript
window.modloaderApi.chara.category.register(dataArray)
window.modloaderApi.chara.category.patch.register(dataArray)
window.modloaderApi.chara.category.show()
```

`show()` 返回当前可显示的角色分类数组。默认从 `window.tyrano_lang.word.collection.chara[分类名]` 读取分类文本, 也可通过 `entry.data.text` 指定。

分类的 `visibility` 影响图鉴显示与统计：`always` 会在未完全解锁时显示并纳入统计; `allCharasOpen` 则在 `allCharasOpenInCollection()` 为真后才显示和统计。

### 5.2 `window.modloaderApi.chara.data`

```javascript
window.modloaderApi.chara.data.character.register(dataArray)
window.modloaderApi.chara.data.character.patch.register(dataArray)
window.modloaderApi.chara.data.devil.register(dataArray)
window.modloaderApi.chara.data.devil.patch.register(dataArray)
window.modloaderApi.chara.data.show()
```

`show()` 精确返回值：

```javascript
{
  route: 'notKilled',
  characters: [{ name: '角色名', folder: '55' }],
  devils: [{ name: '恶魔名', folder: '66' }]
}
```

### 5.3 `window.modloaderApi.chara.setting`

```javascript
window.modloaderApi.chara.setting.register(dataArray)
window.modloaderApi.chara.setting.show()
```

`show()` 精确返回值：

```javascript
{
  audioStore: {},
  fontStore: {},
  registeredNames: ['角色A', '角色B']
}
```

### 5.4 `window.modloaderApi.ending`

```javascript
window.modloaderApi.ending.register(dataArray)
window.modloaderApi.ending.patch.register(dataArray)
window.modloaderApi.ending.show()
```

`show()` 返回结局原始对象：

```javascript
{
  0: { title: '结局A', category: 'normal' },
  1: { title: '结局B', category: 'special' }
}
```

`ending.category.register(...)` 用于向游戏的 `endCategoryData()` 注入结局类别.
每个条目必须提供 `data.name`. `data.text` 支持直接文本或 `$.lang(...)` 返回值,
也可以使用函数动态返回文本. `visibility` 默认为 `always`, 与 `normal` 的显示方式一致.
设为 `secret` 或 `locked` 后, 会复用游戏的 `secretEndOpenInCollection()` 解锁条件.
支持的模式为 `append`, `prepend` 和 `override`.
`ending.category.patch.register(...)` 则只合并同名类别的已提供字段，且默认不追加新类别。

```javascript
window.modloaderApi.ending.category.register([
  { data: { name: 'bonus', text: 'Bonus endings' } },
  {
    data: {
      name: 'bonus_secret',
      text: $.lang('collection')['ending']['secret_bonus'],
      visibility: 'secret'
    }
  }
])
```

### 5.5 `window.modloaderApi.word`

```javascript
window.modloaderApi.word.register(dataArray)
window.modloaderApi.word.show()
```

`show()` 精确返回值：

```javascript
{
  ngWords: ['词1', '词2'],
  someWords: ['词3']
}
```

### 5.6 `window.modloaderApi.lang`

```javascript
window.modloaderApi.lang.register(dataArray)
window.modloaderApi.lang.show()
```

`show()` 返回当前完整的 `window.tyrano_lang` 对象。注册数据使用与 `tyrano/lang.js` 相同的嵌套结构, 例如 `word` 和 `novel` 分组。

### 5.7 `window.modloaderApi.gallery`

```javascript
window.modloaderApi.gallery.register(dataArray)
window.modloaderApi.gallery.patch.register(dataArray)
window.modloaderApi.gallery.show()
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

### 5.8 `window.modloaderApi.omake`

```javascript
window.modloaderApi.omake.register(dataArray)
window.modloaderApi.omake.patch.register(dataArray)
window.modloaderApi.omake.show()
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

#### `window.modloaderApi.omake.ex`

新版游戏将额外番外定义在 `additionalNgSceneData()`，主 `ngSceneData()` 会将其结果合并到番外列表。该接口只操作这部分附加数据：

```javascript
window.modloaderApi.omake.ex.register([
  {
    data: {
      name: 'extra_scene',
      title: '扩展番外',
      cond: '通关后解锁',
      storage: 'omake_extra_scene'
    }
  }
])

window.modloaderApi.omake.ex.patch.register([
  {
    data: { name: 'extra_scene', title: '修改后的标题' }
  }
])
```

`show()` 返回 `additionalNgSceneData()` 的原始数组。

### 5.9 `window.modloaderApi.gekizyou`

```javascript
window.modloaderApi.gekizyou.register(dataArray)
window.modloaderApi.gekizyou.show()
```

`show()` 精确返回值：

```javascript
[45, 46, 47]
```

### 5.10 `window.modloaderApi.sticker`

```javascript
window.modloaderApi.sticker.register(dataArray)
window.modloaderApi.sticker.patch.register(dataArray)
window.modloaderApi.sticker.show()
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

### 5.11 `window.modloaderApi.effect`

```javascript
window.modloaderApi.effect.register(dataArray)
window.modloaderApi.effect.patch.register(dataArray)
window.modloaderApi.effect.show()
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

### 5.12 `window.modloaderApi.ks`

```javascript
window.modloaderApi.ks.register.json(rules)
window.modloaderApi.ks.register.raw(rules)
window.modloaderApi.ks.list()
window.modloaderApi.ks.show()
window.modloaderApi.ks.show.json(fileName)
window.modloaderApi.ks.show.raw(fileName)
```

- `ks.list()` 返回路径数组
- `ks.show()` 返回 `{ paths, rawScripts, parsedScripts, rawRules, jsonRules }`
- `ks.show.json(fileName)` 返回 `{ fileName, data }`
- `ks.show.raw(fileName)` 返回 `{ fileName, originalText, transformedText }`

### 5.13 KS 调试导出

在 `modloader-api` 的配置中开启导出选项后, 已加载且完成规则处理的剧本会自动写入:

- JSON: `config/modloader-api/json/xxx.ks.json`, 内容为 `{ fileName, data }`
- RAW: `config/modloader-api/raw/xxx.ks.raw`, 内容为传入解析器前的最终 KS 文本

配置每秒刷新一次, 开关保存后会作用于后续加载的剧本.

---

## 6. 推荐实践

- 注册时始终用数组
- 动态字段尽量保持纯函数
- KS 规则最好补 `description`

---

## 7. 常见问题

### 为什么 `register(...)` 返回 `null`？

常见原因：

- 传入结构不符合要求
- 引擎未就绪
- 所有条目都未通过校验
- 必填字段缺失

### 为什么现在 `show()` 更简单？

因为当前设计目标是：

- `show()` 只返回原始数据
- 避免展示协议污染业务 API

