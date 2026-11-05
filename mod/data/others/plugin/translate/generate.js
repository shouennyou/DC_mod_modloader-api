/* 空白翻译包生成器。需在 runtime.js 后按需加载。 */
(function () {
  "use strict";
  const kag = TYRANO.kag;
  if (typeof kag.joinTranslatePath !== "function") throw new Error("[translate] 请先加载 runtime.js");
  // init.ks 可能因剧本重载再次执行，配置生成任务只注册一次。
  if (kag._translateGeneratorLoaded) return;
  kag._translateGeneratorLoaded = true;
  const storage = typeof window === "undefined" ? null : window.modloader;
  // 原游戏资源只读；自动生成的语言包写入可写配置目录。
  const CACHE_ROOT = "config/modloader-api/translate";
  const ORIGINAL_DATA_ROOT = "original-game-resources/data";
  const CONFIG_PATH = "config/modloader-api.json";
  const GENERATE_SWITCH_KEY = "generateTranslationTemplate";
  const GENERATE_LANGUAGE_KEY = "translationTemplateLanguage";
  const DEFAULT_LANGUAGE = "sch";
  if (!storage || typeof storage.readFile !== "function" || typeof storage.writeFile !== "function" || typeof storage.readdir !== "function" || typeof storage.stat !== "function") {
    throw new Error("[translate] window.modloader 文件接口不可用");
  }
  function requireWrite(result, path) {
    if (!result || !result.success) throw new Error("写入失败：" + path + "（" + (result && result.error || "未知错误") + "）");
  }
  async function listScenarioFiles(directory) {
    const names = await storage.readdir(directory);
    if (!Array.isArray(names)) throw new Error("无法读取剧本目录：" + directory);
    const files = [];
    for (const name of names) {
      const path = directory + "/" + name;
      const stat = await storage.stat(path);
      if (!stat) throw new Error("无法读取路径状态：" + path);
      if (stat.isDirectory()) files.push.apply(files, await listScenarioFiles(path));
      else if (stat.isFile() && /\.ks$/i.test(name)) files.push(path);
    }
    return files;
  }
  function merge(target, source) {
    Object.keys(source || {}).forEach(function (key) {
      const value = source[key];
      if (value && typeof value === "object" && !Array.isArray(value)) {
        if (!target[key] || typeof target[key] !== "object" || Array.isArray(target[key])) target[key] = {};
        merge(target[key], value);
      } else if (!Object.prototype.hasOwnProperty.call(target, key)) target[key] = value;
    });
    return target;
  }
  function stringifyDebug(value) {
    const seen = [];
    return JSON.stringify(value, function (_, item) {
      if (typeof item === "function") return "[Function]";
      if (item && typeof item === "object") {
        if (seen.indexOf(item) >= 0) return "[Circular]";
        seen.push(item);
      }
      return item;
    }, 2);
  }
  function formatExtractionMapping(entries) {
    const lines = ["", "========== 提取映射 =========="];
    const quote = function (value) { return JSON.stringify(String(value)); };
    const scenarioKeys = Object.keys(entries.scenario || {});
    lines.push("[scenario] " + scenarioKeys.length + " 项");
    scenarioKeys.forEach(function (key) {
      lines.push("  " + quote(scenarioSourceFromKey(key)) + " -> scenario[" + quote(key) + "]");
    });
    const dialogueBlocks = entries.dialogueBlocks || [];
    lines.push("[dialogue] " + dialogueBlocks.length + " 项");
    dialogueBlocks.forEach(function (block) {
      lines.push("  " + quote(block.value) + " -> dialogue KS 文件");
    });
    const scriptKeys = Object.keys(entries.script || {});
    lines.push("[script] " + scriptKeys.length + " 项");
    scriptKeys.forEach(function (key) {
      lines.push("  " + quote(scenarioSourceFromKey(key)) + " -> script[" + quote(key) + "]");
    });
    const charaKeys = Object.keys(entries.charas || {});
    lines.push("[charas] " + charaKeys.length + " 个角色");
    charaKeys.forEach(function (id) {
      const entry = entries.charas[id] || {};
      lines.push("  " + quote(id) + " -> charas[" + quote(id) + "][" + quote(id) + "]");
      Object.keys(entry).filter(function (key) { return key !== id; }).forEach(function (scenario) {
        Object.keys(entry[scenario] || {}).forEach(function (key) {
          lines.push("  " + quote(key) + " -> charas[" + quote(id) + "][" + quote(scenario) + "][" + quote(key) + "]");
        });
      });
    });
    const tags = entries.tag || {};
    const tagNames = Object.keys(tags);
    lines.push("[tag] " + tagNames.length + " 类");
    tagNames.forEach(function (tagName) {
      Object.keys(tags[tagName] || {}).forEach(function (param) {
        Object.keys(tags[tagName][param] || {}).forEach(function (value) {
          lines.push("  " + tagName + "." + param + " " + quote(value) + " -> tag[" + quote(tagName) + "][" + quote(param) + "][" + quote(value) + "]");
        });
      });
    });
    return lines.join("\n");
  }
  function scenarioSourceFromKey(key) {
    const value = String(key);
    const suffixMatch = value.match(/^([\s\S]*):T\d+$/);
    return suffixMatch ? suffixMatch[1] : value;
  }
  const CHARAS_COMMENT_KEY = "_comment";
  const CHARAS_COMMENT = "场景别名示例：\"角色名\": { \"scene1.ks\": { \"角色名:C1\": \"别名\" } }。场景项的空字符串会回退到全局名称；null 不支持。";
  function normalizeDialogueText(value) {
    return String(value == null ? "" : value).replace(/\r\n/g, "\n");
  }
  function extractDialogueBlocks(source) {
    const lines = normalizeDialogueText(source).split("\n"), blocks = [];
    let start = -1;
    lines.forEach(function (line, index) {
      if (start === -1) {
        if (/^[\t ]*\[tb_start_text(?:\s[^\]]*)?\][\t ]*$/i.test(line)) start = index;
        return;
      }
      if (!/^[\t ]*\[_tb_end_text(?:\s[^\]]*)?\][\t ]*$/i.test(line)) return;
      blocks.push({ value: lines.slice(start, index + 1).join("\n") });
      start = -1;
    });
    return blocks;
  }
  function parseDialogueOverlay(content) {
    const entries = [];
    const pattern = /^;\s*@dialogue\s*\n;\s*@source\s*\n([\s\S]*?)^;\s*@translation\s*\n([\s\S]*?)^;\s*@end-dialogue\s*$/gmi;
    let match;
    while ((match = pattern.exec(normalizeDialogueText(content)))) {
      const source = match[1].replace(/\n$/, "");
      const translation = match[2].replace(/\n$/, "");
      const marker = translation.trim();
      entries.push({ source: source, value: marker === "null" ? null : marker === "" ? "" : translation });
    }
    return entries;
  }
  function buildDialogueOverlay(blocks, existing) {
    const entries = parseDialogueOverlay(existing), bySource = {}, used = [];
    entries.forEach(function (entry, index) {
      if (!bySource[entry.source]) bySource[entry.source] = [];
      bySource[entry.source].push({ entry: entry, index: index });
    });
    return blocks.map(function (block) {
      const saved = (bySource[block.value] || []).find(function (item) { return !used[item.index]; });
      const value = saved ? saved.entry.value : "";
      if (saved) used[saved.index] = true;
      return "; @dialogue\n; @source\n" + block.value + "\n; @translation\n" + (value === null ? "null" : value) + "\n; @end-dialogue";
    }).join("\n\n\n\n") + (blocks.length ? "\n\n\n\n" : "");
  }
  kag.extractScenarioEntries = function (source, scenario) {
    const parser = kag.parser, old = { lang: kag.lang, extracting: kag._translateExtracting, current: kag.stat.current_scenario };
    const result = { scenario: {}, dialogueBlocks: extractDialogueBlocks(source), script: {}, tag: {}, charas: {}, diagnostics: [] };
    try {
      kag._translateExtracting = true;
      kag.lang = "";
      kag.stat.current_scenario = "./data/scenario/" + scenario;
      const parsed = parser.parseScenario(String(source || ""));
      let inScript = false;
      const parsedItems = parsed && parsed.array_s || [];
      const scenarioKeys = kag.getScenarioTranslationKeys(parsedItems);
      const scriptKeys = kag.getScriptTranslationKeys(parsedItems);
      parsedItems.forEach(function (item, index) {
        if (!item || !item.name) return;
        if (item.name === "iscript") { inScript = true; return; }
        if (item.name === "endscript") { inScript = false; return; }
        if (item.name === "text") {
          const value = item.pm && item.pm.val;
          const key = scenarioKeys[index];
          const scriptKey = scriptKeys[index];
          if (!inScript && key && value.trim()) result.scenario[key] = "";
          if (inScript && scriptKey && value.trim()) result.script[scriptKey] = "";
          return;
        }
        if (item.name === "chara_ptext") {
          const id = item.pm && item.pm.name;
          if (typeof id === "string" && id.trim()) {
            if (!result.charas[id]) result.charas[id] = {};
            if (!Object.prototype.hasOwnProperty.call(result.charas[id], id)) result.charas[id][id] = "";
          }
          return;
        }
        const params = ["text", "title", "hint", "label", "message", "caption", "tooltip", "confirm", "cancel", "yes", "no", "val"]
          .concat(Object.keys(item.pm || {}).filter(function (key) { return /^text\d+$/i.test(key); }));
        params.forEach(function (key) {
          const value = item.pm && item.pm[key];
          if (typeof value !== "string" || !value.trim()) return;
          if (!result.tag[item.name]) result.tag[item.name] = {};
          if (!result.tag[item.name][key]) result.tag[item.name][key] = {};
          result.tag[item.name][key][value] = "";
        });
      });
      result.parsed = parsed;
      return result;
    } finally {
      kag.lang = old.lang;
      kag._translateExtracting = old.extracting;
      kag.stat.current_scenario = old.current;
    }
  };
  kag.generateLangFile = async function (name) {
    if (!/^[a-zA-Z0-9_-]+$/.test(String(name))) throw new Error("语言名称只能包含英文字母、数字、下划线和连字符。");
    const sourceRoot = ORIGINAL_DATA_ROOT + "/scenario";
    const langRoot = kag.joinTranslatePath(CACHE_ROOT, "data", "others", "lang", name);
    const logRoot = kag.joinTranslatePath(langRoot, "log");
    const parseRoot = kag.joinTranslatePath(langRoot, "parse");
    const manifestPath = kag.joinTranslatePath(CACHE_ROOT, "data", "others", "lang", String(name) + ".json");
    let files;
    try {
      files = await listScenarioFiles(sourceRoot);
    } catch (error) {
      throw new Error("无法从 " + ORIGINAL_DATA_ROOT + " 读取原游戏资源。请在 ModLoader 中选择有效的游戏核心。" + "（" + (error.message || error) + "）");
    }
    const summary = { total: files.length, success: 0, failed: 0, failures: [] }, charas = {}, jsonFiles = [], ksFiles = [];
    for (const file of files) {
      const relative = String(file).slice(sourceRoot.length).replace(/^\//, "");
      if (!relative || relative.indexOf("..") >= 0) continue;
      const output = kag.joinTranslatePath(langRoot, "json", relative.replace(/\.ks$/i, ".json"));
      const dialogueOutput = kag.joinTranslatePath(langRoot, "ks", relative);
      const log = kag.joinTranslatePath(logRoot, relative.replace(/\.ks$/i, ".log"));
      const parse = kag.joinTranslatePath(parseRoot, relative.replace(/\.ks$/i, ".parse.json"));
      try {
        const source = await storage.readFile(file);
        if (source == null) throw new Error("无法读取剧本：" + file);
        const entries = kag.extractScenarioEntries(source, relative);
        const existing = await storage.readFile(output);
        let old = existing == null ? { scenario: {}, script: {}, tag: {} } : JSON.parse(existing);
        if (!old || typeof old !== "object") old = {};
        if (!old.scenario || typeof old.scenario !== "object") old.scenario = {};
        if (!old.script || typeof old.script !== "object") old.script = {};
        if (!old.tag || typeof old.tag !== "object") old.tag = {};
        merge(old.scenario, entries.scenario);
        merge(old.script, entries.script);
        delete old.inline;
        delete old.dialogue;
        merge(old.tag, entries.tag); merge(charas, entries.charas);
        requireWrite(await storage.writeFile(output, JSON.stringify(old, null, 4)), output);
        if (entries.dialogueBlocks.length > 0) {
          const existingDialogue = await storage.readFile(dialogueOutput);
          requireWrite(await storage.writeFile(dialogueOutput, buildDialogueOverlay(entries.dialogueBlocks, existingDialogue)), dialogueOutput);
          ksFiles.push("ks/" + relative);
        }
        requireWrite(await storage.writeFile(parse, stringifyDebug({
          scenario: relative,
          parserOutput: entries.parsed,
          extracted: { scenario: entries.scenario, dialogueBlocks: entries.dialogueBlocks, script: entries.script, tag: entries.tag, charas: entries.charas },
          diagnostics: entries.diagnostics
        })), parse);
        requireWrite(await storage.writeFile(log, [
          "[translate] 生成成功",
          "剧本：" + relative,
          "源文件：" + file,
          "翻译文件：" + output,
          "对话块文件：" + (entries.dialogueBlocks.length > 0 ? dialogueOutput : "无"),
          "解析快照：" + parse,
          "文本条目：" + Object.keys(entries.scenario).length,
          "对话块条目：" + entries.dialogueBlocks.length,
          "脚本文本条目：" + Object.keys(entries.script).length,
          "标签类型：" + Object.keys(entries.tag).length,
          "角色条目：" + Object.keys(entries.charas).length,
          formatExtractionMapping(entries)
        ].join("\n") + "\n"), log);
        jsonFiles.push("json/" + relative.replace(/\.ks$/i, ".json"));
        summary.success++;
      } catch (error) {
        summary.failed++; summary.failures.push({ scenario: relative, log: log, error: error.message || String(error) });
        try {
          await storage.writeFile(log, ["[translate] 生成失败", "剧本：" + relative, "源文件：" + file, "解析快照：" + parse, "错误：", error.stack || error].join("\n") + "\n");
        } catch (_) {}
      }
    }
    const charaPath = kag.joinTranslatePath(langRoot, "charas.json");
    const existingCharas = await storage.readFile(charaPath);
    const parsedCharas = existingCharas == null ? {} : JSON.parse(existingCharas);
    const charasSource = parsedCharas && typeof parsedCharas === "object" && !Array.isArray(parsedCharas) ? parsedCharas : {};
    // charas.json 仅接受新版的角色对象结构；旧平铺条目不再保留。
    const oldCharas = {
      [CHARAS_COMMENT_KEY]: typeof charasSource[CHARAS_COMMENT_KEY] === "string" ? charasSource[CHARAS_COMMENT_KEY] : CHARAS_COMMENT
    };
    Object.keys(charasSource).forEach(function (id) {
      if (id === CHARAS_COMMENT_KEY) return;
      const entry = charasSource[id];
      if (entry && typeof entry === "object" && !Array.isArray(entry)) oldCharas[id] = entry;
    });
    merge(oldCharas, charas);
    requireWrite(await storage.writeFile(charaPath, JSON.stringify(oldCharas, null, 4)), charaPath);
    const jsonFilesInManifest = jsonFiles.concat("charas.json").sort();
    requireWrite(await storage.writeFile(manifestPath, JSON.stringify({
      format: "tyrano-translate-v1",
      language: String(name),
      jsonFiles: jsonFilesInManifest,
      ksFiles: ksFiles.sort()
    }, null, 4)), manifestPath);
    console.log("[translate] 语言模板生成结束：", summary);
    return summary;
  };
  async function generateFromConfig() {
    const content = await storage.readFile(CONFIG_PATH);
    if (content == null || content === "") return;
    let config;
    try {
      config = JSON.parse(content);
    } catch (error) {
      console.error("[translate] 无法读取生成开关：配置 JSON 无法解析", error);
      return;
    }
    if (!config || typeof config !== "object" || Array.isArray(config) || config[GENERATE_SWITCH_KEY] !== true) return;
    const language = String(config[GENERATE_LANGUAGE_KEY] || DEFAULT_LANGUAGE).trim();
    if (!/^[a-zA-Z0-9_-]+$/.test(language)) {
      console.error("[translate] 生成开关的语言名称无效：" + language);
      return;
    }
    try {
      const summary = await kag.generateLangFile(language);
      config[GENERATE_SWITCH_KEY] = false;
      requireWrite(await storage.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2)), CONFIG_PATH);
      console.info("[translate] 已完成配置触发的语言模板生成，并关闭生成开关：" + language, summary);
    } catch (error) {
      // 失败时保留开关，方便修正游戏核心或配置后再次启动重试。
      console.error("[translate] 配置触发的语言模板生成失败：", error);
    }
  }
  // 配置由 Mod Manager 写入 config/modloader-api.json；开关在下次进入游戏时执行一次。
  Promise.resolve().then(generateFromConfig).catch(function (error) {
    console.error("[translate] 读取生成开关失败：", error);
  });
}());
