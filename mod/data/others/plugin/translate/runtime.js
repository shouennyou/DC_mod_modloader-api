/* 运行时翻译：仅加载和应用已存在的语言包。 */
(function () {
  "use strict";
  const kag = TYRANO.kag;
  let originalParseScenario = null;
  // [lang_set] 会重载当前剧本；避免 init.ks 在重载后重复包裹解析器。
  if (kag._translateRuntimeLoaded) return;
  kag._translateRuntimeLoaded = true;

  kag.normalizeScenarioPath = function (scenario) {
    let value = String(scenario || "").replace(/\\/g, "/").replace(/^\.\//, "");
    const marker = "/data/scenario/";
    const index = value.toLowerCase().lastIndexOf(marker);
    if (index >= 0) value = value.slice(index + marker.length);
    return value.replace(/^data\/scenario\//i, "").replace(/^\/+/, "");
  };
  function getTextTranslationKeys(tags, extractScript) {
    const candidates = [], totals = Object.create(null), ordinals = Object.create(null), keys = Object.create(null);
    let inScript = false;
    (tags || []).forEach(function (tag, index) {
      if (!tag || !tag.name) return;
      if (tag.name === "iscript") { inScript = true; return; }
      if (tag.name === "endscript") { inScript = false; return; }
      const source = tag.name === "text" && tag.pm && tag.pm.val;
      if (inScript === extractScript && typeof source === "string" && source.trim()) {
        candidates.push({ index: index, source: source });
        totals[source] = (totals[source] || 0) + 1;
      }
    });
    candidates.forEach(function (item) {
      const ordinal = (ordinals[item.source] || 0) + 1;
      ordinals[item.source] = ordinal;
      keys[item.index] = totals[item.source] === 1 ? item.source : item.source + ":T" + ordinal;
    });
    return keys;
  }
  kag.getScenarioTranslationKeys = function (tags) {
    return getTextTranslationKeys(tags, false);
  };
  kag.getScriptTranslationKeys = function (tags) {
    return getTextTranslationKeys(tags, true);
  };
  function hasInlineTag(value) {
    return /\[[a-zA-Z_][\w-]*(?:\s[^\]]*)?\]/.test(value);
  }
  function normalizeDialogueText(value) {
    return String(value == null ? "" : value).replace(/\r\n/g, "\n");
  }
  function extractDialogueBlocks(text) {
    const source = normalizeDialogueText(text), lines = source.split("\n"), blocks = [];
    let offset = 0, start = -1;
    lines.forEach(function (line) {
      if (start === -1 && /^[\t ]*\[tb_start_text(?:\s[^\]]*)?\][\t ]*$/i.test(line)) {
        start = offset;
      } else if (start !== -1 && /^[\t ]*\[_tb_end_text(?:\s[^\]]*)?\][\t ]*$/i.test(line)) {
        const end = offset + line.length;
        const value = source.slice(start, end);
        blocks.push({ start: start, end: end, value: value });
        start = -1;
      }
      offset += line.length + 1;
    });
    return blocks;
  }
  function parseDialogueOverlay(text) {
    const entries = [];
    const pattern = /^;\s*@dialogue\s*\n;\s*@source\s*\n([\s\S]*?)^;\s*@translation\s*\n([\s\S]*?)^;\s*@end-dialogue\s*$/gmi;
    let match;
    while ((match = pattern.exec(normalizeDialogueText(text)))) {
      const source = match[1].replace(/\n$/, "");
      const translation = match[2].replace(/\n$/, "");
      const marker = translation.trim();
      entries.push({ source: source, value: marker === "null" ? null : marker === "" ? "" : translation });
    }
    return entries;
  }
  kag.applyDialogueTranslationsToSource = function (text, overlay) {
    const source = normalizeDialogueText(text);
    if (typeof overlay !== "string" || overlay === "") return source;
    const blocks = extractDialogueBlocks(source), used = Object.create(null), replacements = [];
    parseDialogueOverlay(overlay).forEach(function (entry) {
      const index = blocks.findIndex(function (block, blockIndex) {
        return !used[blockIndex] && block.value === entry.source;
      });
      if (index === -1) {
        console.warn("[translate] 对话块源文本已变化，已跳过：" + entry.source);
        return;
      }
      used[index] = true;
      if (entry.value !== "") replacements.push({ start: blocks[index].start, end: blocks[index].end, value: entry.value === null ? "" : entry.value });
    });
    replacements.sort(function (left, right) { return right.start - left.start; });
    return replacements.reduce(function (result, replacement) {
      return result.slice(0, replacement.start) + replacement.value + result.slice(replacement.end);
    }, source);
  };
  function findRawText(text, value, from) {
    const lower = text.toLowerCase();
    let index = text.indexOf(value, from);
    while (index !== -1) {
      const lastOpen = text.lastIndexOf("[", index);
      const lastClose = text.lastIndexOf("]", index);
      const inTag = lastOpen > lastClose;
      const inScript = lower.lastIndexOf("[iscript", index) > lower.lastIndexOf("[endscript", index);
      if (!inTag && !inScript) return index;
      index = text.indexOf(value, index + value.length);
    }
    return -1;
  }
  kag.applyInlineTranslationsToSource = function (text, scenario) {
    if (!originalParseScenario || kag._translateExtracting || !kag.lang) return text;
    const relative = kag.normalizeScenarioPath(scenario);
    const pack = relative && kag._translateSceneCache && kag._translateSceneCache[kag.lang + "::" + relative];
    if (!pack) return text;
    const dialogue = kag._translateDialogueCache && kag._translateDialogueCache[kag.lang + "::" + relative];
    const source = kag.applyDialogueTranslationsToSource(text, dialogue);
    const translations = pack.scenario;
    if (!translations || typeof translations !== "object") return source;
    const hasInlineTranslations = Object.keys(translations).some(function (key) {
      const value = translations[key];
      return typeof value === "string" && value !== "" && hasInlineTag(value);
    });
    if (!hasInlineTranslations) return source;
    const preview = originalParseScenario.call(kag.parser, source);
    const tags = preview && preview.array_s;
    if (!Array.isArray(tags)) return source;
    const keys = kag.getScenarioTranslationKeys(tags);
    const replacements = [];
    tags.forEach(function (tag, index) {
      const source = tag && tag.name === "text" && tag.pm && tag.pm.val;
      const key = keys[index];
      const translated = key && Object.prototype.hasOwnProperty.call(translations, key) ? translations[key] : undefined;
      if (typeof source === "string" && typeof translated === "string" && translated !== "" && hasInlineTag(translated)) {
        replacements.push({ start: index, first: source, translated: translated });
      }
    });
    replacements.sort(function (left, right) { return left.start - right.start; });
    let result = source, cursor = 0;
    replacements.forEach(function (replacement) {
      const index = findRawText(result, replacement.first, cursor);
      if (index === -1) {
        console.warn("[translate] 无法在原始剧本中定位内联译文：" + replacement.first);
        return;
      }
      result = result.slice(0, index) + replacement.translated + result.slice(index + replacement.first.length);
      cursor = index + replacement.translated.length;
    });
    return result;
  };
  kag.joinTranslatePath = function () {
    const parts = Array.prototype.slice.call(arguments).filter(Boolean);
    if (!parts.length) return "";
    const separator = String(parts[0]).indexOf("\\") >= 0 ? "\\" : "/";
    return parts.map(function (part, index) {
      const text = String(part);
      return index ? text.replace(/^[\\/]+|[\\/]+$/g, "") : text.replace(/[\\/]+$/, "");
    }).join(separator);
  };
  kag.scenarioToLangJsonPath = function (scenario, language) {
    return kag.joinTranslatePath("data", "others", "lang", language, "json", kag.normalizeScenarioPath(scenario).replace(/\.ks$/i, ".json"));
  };
  function loadText(path) {
    return new Promise(function (resolve, reject) {
      $.ajax({
        url: "./" + path.replace(/^\.\//, "") + (path.indexOf("?") >= 0 ? "&" : "?") + "_=" + Date.now(),
        dataType: "text",
        cache: false,
        success: resolve,
        error: function (xhr, status, error) {
          const failure = new Error("无法读取语言包：" + path + "（" + (error || status) + "）");
          failure.translateFetchFailed = true;
          failure.translateFileMissing = xhr && xhr.status === 404;
          reject(failure);
        }
      });
    });
  }
  async function loadJson(path) {
    const text = await loadText(path);
    try { return JSON.parse(text); }
    catch (error) { throw new Error("语言包 JSON 无法解析：" + path + "（" + error.message + "）"); }
  }
  kag.loadTranslateManifest = async function (language) {
    const root = kag.joinTranslatePath("data", "others", "lang", language);
    const manifestPath = kag.joinTranslatePath("data", "others", "lang", language + ".json");
    let manifest;
    try {
      manifest = await loadJson(manifestPath);
    } catch (error) {
      // file:// 下不存在的文件通常返回 status=0，不能只依赖 HTTP 404。
      if (error.translateFetchFailed) error.translateManifestMissing = true;
      throw error;
    }
    if (!manifest || manifest.format !== "tyrano-translate-v1" || !Array.isArray(manifest.jsonFiles) || !Array.isArray(manifest.ksFiles)) {
      throw new Error("语言包总列表格式无效：" + manifestPath);
    }
    const jsonFiles = manifest.jsonFiles.filter(function (file) {
      return typeof file === "string" && (file === "charas.json" || file.indexOf("..") < 0 && /^json\/[-_a-zA-Z0-9./]+\.json$/i.test(file));
    });
    if (jsonFiles.length !== manifest.jsonFiles.length) throw new Error("语言包 JSON 列表包含无效路径");
    const ksFiles = manifest.ksFiles.filter(function (file) {
      return typeof file === "string" && file.indexOf("..") < 0 && /^ks\/[\-_a-zA-Z0-9./]+\.ks$/i.test(file);
    });
    if (ksFiles.length !== manifest.ksFiles.length) throw new Error("语言包 KS 列表包含无效路径");
    const loaded = await Promise.all(jsonFiles.map(async function (file) {
      return { file: file, data: await loadJson(kag.joinTranslatePath(root, file)) };
    }));
    const loadedDialogues = await Promise.all(ksFiles.map(async function (file) {
      return { file: file, text: await loadText(kag.joinTranslatePath(root, file)) };
    }));
    const sceneCache = {};
    const dialogueCache = {};
    let charas = {};
    loaded.forEach(function (item) {
      if (item.file === "charas.json") {
        if (item.data && typeof item.data === "object" && !Array.isArray(item.data)) charas = item.data;
        return;
      }
      if (!item.data || typeof item.data !== "object" || Array.isArray(item.data)) throw new Error("剧本语言包根节点不是对象：" + item.file);
      const scenario = item.file.replace(/^json\//i, "").replace(/\.json$/i, ".ks");
      sceneCache[language + "::" + scenario] = item.data;
    });
    loadedDialogues.forEach(function (item) {
      const scenario = item.file.replace(/^ks\//i, "");
      dialogueCache[language + "::" + scenario] = item.text;
    });
    return { scenes: sceneCache, dialogues: dialogueCache, charas: charas };
  };
  // 角色显示名兼容层：
  // 不修改音效插件，只识别其对 kag.tag.chara_ptext.start 的包装。
  (function installCharaPtextDisplayOverride() {
    const MAX_WAIT = 600;
    const INTERVAL = 50;
    let attempts = 0;
    let installedMode = "";
    function getTags() {
      return {
        runtimeTag:
          kag.ftag &&
          kag.ftag.master_tag &&
          kag.ftag.master_tag.chara_ptext,
        pluginTag:
          kag.tag &&
          kag.tag.chara_ptext
      };
    }
    // 根据音效插件包装函数中的特征判断是否已经加载。
    function isFontSoundPluginLoaded(fn) {
      if (typeof fn !== "function") return false;
      const source = Function.prototype.toString.call(fn);
      return (
        source.includes("popopo") &&
        source.includes("deffont") &&
        source.includes("resetfont")
      );
    }
    function installDisplayOverride(tag, baseStart, mode) {
      if (!tag || typeof baseStart !== "function") return false;
      // 已经使用相同入口安装，不重复包装。
      if (
        tag._translateDisplayOverrideInstalled &&
        tag._translateDisplayOverrideMode === mode
      ) {
        return true;
      }
      tag.start = function (pm) {
        const displayName = pm && pm._translateDisplayName;
        const result = baseStart.apply(this, arguments);
        if (
          typeof displayName === "string" &&
          displayName !== "" &&
          typeof $ === "function"
        ) {
          const ptext =
            this.kag &&
            this.kag.stat &&
            this.kag.stat.chara_ptext;
          if (ptext) {
            $("." + ptext).text(displayName);
          }
        }
        return result;
      };
      tag._translateDisplayOverrideInstalled = true;
      tag._translateDisplayOverrideMode = mode;
      return true;
    }
    function checkAndInstall() {
      const tags = getTags();
      const runtimeTag = tags.runtimeTag;
      const pluginTag = tags.pluginTag;
      if (
        !runtimeTag ||
        !pluginTag ||
        typeof runtimeTag.start !== "function" ||
        typeof pluginTag.start !== "function"
      ) {
        return false;
      }
      const audioLoaded = isFontSoundPluginLoaded(pluginTag.start);
      if (audioLoaded) {
        // 音效插件已加载：
        // 使用它的包装函数作为实际执行入口。
        if (
          installedMode !== "font-sound" ||
          !runtimeTag._translateDisplayOverrideInstalled
        ) {
          const success = installDisplayOverride(
            runtimeTag,
            pluginTag.start,
            "font-sound"
          );
          if (success) {
            installedMode = "font-sound";
            console.log("[translate] 已接入角色字体/音效插件");
          }
        }
        return true;
      }
      // 音效插件尚未加载时，先保留翻译插件自己的显示名功能。
      if (installedMode === "") {
        const success = installDisplayOverride(
          runtimeTag,
          runtimeTag.start,
          "translate-only"
        );
        if (success) {
          installedMode = "translate-only";
          console.log("[translate] 已安装角色显示名翻译");
        }
      }
      return false;
    }
    function waitForPlugin() {
      const loaded = checkAndInstall();
      if (loaded) return;
      attempts++;
      if (attempts < MAX_WAIT) {
        setTimeout(waitForPlugin, INTERVAL);
      } else {
        console.warn(
          "[translate] 等待角色字体/音效插件超时，保留翻译显示名功能"
        );
      }
    }
    waitForPlugin();
  })();
  kag.convertLang = function (scenario, tags) {
    if (!Array.isArray(tags) || kag._translateExtracting || !kag.lang) return tags;
    const relative = kag.normalizeScenarioPath(scenario);
    if (!relative) return tags;
    kag._translateSceneCache = kag._translateSceneCache || {};
    const key = kag.lang + "::" + relative;
    let pack = kag._translateSceneCache[key];
    if (!pack) return tags;
    const texts = pack.scenario || {}, scripts = pack.script || {}, tagMaps = pack.tag || {};
    const names = kag._translateCharaCache || {};
    const shouldApply = function (value) {
      return (typeof value === "string" && value !== "") || value === null;
    };
    const appliedValue = function (value) { return value === null ? "" : value; };
    let inScript = false;
    const scenarioKeys = kag.getScenarioTranslationKeys(tags);
    const scriptKeys = kag.getScriptTranslationKeys(tags);
    const charaOrdinals = Object.create(null);
    tags.forEach(function (tag, index) {
      if (!tag || !tag.name) return;
      if (tag.name === "iscript") { inScript = true; return; }
      if (tag.name === "endscript") { inScript = false; return; }
      if (tag.name === "text") {
        const source = tag.pm && tag.pm.val;
        if (inScript) {
          const scriptKey = scriptKeys[index];
          const translatedScript = scriptKey && Object.prototype.hasOwnProperty.call(scripts, scriptKey) ? scripts[scriptKey] : undefined;
          // 脚本行不可清空；null 会破坏 JavaScript 语法或改变控制流。
          if (translatedScript === null) {
            console.warn("[translate] 已忽略 iscript 文本的 null 翻译：" + scriptKey);
          } else if (typeof source === "string" && shouldApply(translatedScript)) {
            tag.pm.val = tag.val = translatedScript;
          }
          return;
        }
        const key = scenarioKeys[index];
        const translated = key && Object.prototype.hasOwnProperty.call(texts, key) ? texts[key] : undefined;
        if (typeof source === "string" && shouldApply(translated)) {
          const value = appliedValue(translated);
          // 含内联标签的译文已在解析前写入原始 KS；此处不得再改变标签数组长度。
          if (!(typeof value === "string" && hasInlineTag(value))) tag.pm.val = tag.val = value;
        }
        return;
      }
      if (tag.name === "chara_ptext") {
        const id = tag.pm && tag.pm.name;
        if (typeof id !== "string") return;
        const ordinal = (charaOrdinals[id] || 0) + 1;
        charaOrdinals[id] = ordinal;
        const entry = names[id];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) return;
        const scene = entry[relative];
        const sceneKey = id + ":C" + ordinal;
        const sceneName = scene && typeof scene === "object" && !Array.isArray(scene) ? scene[sceneKey] : undefined;
        // 场景内非空名称优先；空字符串表示未设置并回退到全局名称。
        const translatedName = typeof sceneName === "string" && sceneName !== "" ? sceneName : entry[id];
        if (typeof translatedName === "string" && translatedName !== "") tag.pm._translateDisplayName = translatedName;
        return;
      }
      const map = tagMaps[tag.name];
      if (!map || !tag.pm) return;
      // ruby.text 是注音匹配信息，不能置空；null 表示移除整条注音标签。
      if (tag.name === "ruby" && map.text && typeof tag.pm.text === "string" && Object.prototype.hasOwnProperty.call(map.text, tag.pm.text) && map.text[tag.pm.text] === null) {
        tag.name = "translate_skip_ruby";
        tag.pm = {};
        tag.val = "";
        return;
      }
      Object.keys(tag.pm).forEach(function (param) {
        const source = tag.pm[param], values = map[param];
        if (values && typeof source === "string" && Object.prototype.hasOwnProperty.call(values, source) && shouldApply(values[source])) tag.pm[param] = appliedValue(values[source]);
      });
    });
    return tags;
  };

  // 保留原插件的注入点：在正常剧本解析完成后替换文本。
  originalParseScenario = kag.parser.parseScenario;
  kag.parser.parseScenario = function (text) {
    const source = kag.applyInlineTranslationsToSource(text, kag.stat.current_scenario);
    const result = originalParseScenario.call(this, source);
    if (result && Array.isArray(result.array_s)) result.array_s = kag.convertLang(kag.stat.current_scenario, result.array_s);
    return result;
  };

  kag.loadLang = async function (name, callback) {
    const language = String(name || "default");
    if (language === "default") {
      kag.lang = "";
      kag._translateSceneCache = {};
      kag._translateDialogueCache = {};
      kag._translateCharaCache = {};
    } else {
      if (!/^[a-zA-Z0-9_-]+$/.test(language)) throw new Error("无效的语言名称：" + language);
      let pack;
      try {
        pack = await kag.loadTranslateManifest(language);
      } catch (error) {
        const canGenerate = typeof window !== "undefined" && window.modloader && typeof kag.generateLangFile === "function";
        if (!error.translateManifestMissing || !canGenerate) throw error;
        console.info("[translate] 语言包不存在，开始自动生成：" + language);
        await kag.generateLangFile(language);
        pack = await kag.loadTranslateManifest(language);
      }
      kag.lang = language;
      kag._translateSceneCache = pack.scenes;
      kag._translateDialogueCache = pack.dialogues;
      kag._translateCharaCache = pack.charas;
    }
    kag.cache_scenario = {};
    if (typeof kag.evalScript === "function") kag.evalScript("sf._system_config_lang=" + JSON.stringify(language) + ";");
    if (typeof callback === "function") callback();
  };
  kag.ftag.master_tag.translate_skip_ruby = {
    pm: {},
    start: function () { kag.ftag.nextOrder(); }
  };
  kag.ftag.master_tag.lang_set = { vital: ["name"], pm: { name: "default" }, start: function (pm) {
    const requested = String(pm.name || "default");
    const active = kag.lang || "default";
    // lang_set 会重载当前剧本；同一语言再次遇到该标签时无需重载。
    if (active === requested) {
      kag.ftag.nextOrder();
      return;
    }
    kag.loadLang(pm.name, function () {
      kag.loadScenario(kag.stat.current_scenario, function (tags) { kag.ftag.array_tag = tags; kag.ftag.nextOrder(); });
    }).catch(function (error) { console.error("[translate] 切换语言失败：", error); kag.ftag.nextOrder(); });
  }};
}());
