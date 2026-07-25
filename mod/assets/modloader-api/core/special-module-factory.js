/**
 * 特殊拦截模块工厂：统一 DC 函数拦截与 KS 场景处理。
 */
(function() {
	'use strict';

	const modloader = window.modloader || (window.modloader = {});
	if (modloader.SpecialModuleFactory) return;

	const helper = modloader.ModHelper;

	function createDcInterceptorModule(options) {
		const settings = Object.assign({
			retryInterval: 100,
			debug: true,
			color: '#607d8b',
			tag: 'DcInterceptor',
			targets: [],
			show: function() { return null; }
		}, options || {});

		const runtime = modloader.ModuleRuntime.createRuntime(settings);
		const state = {};
		settings.targets.forEach(function(target) {
			state[target.stateKey] = [];
		});

		function createWrappedFunction(originalFn, target) {
			const wrapped = function() {
				let data = [];
				try {
					if (typeof originalFn === 'function') data = originalFn.apply(this, arguments);
				} catch (error) {
					if (settings.debug) runtime.logError('数据读取失败', error);
				}
				if (!Array.isArray(data)) data = [];
				return target.transform(data, state[target.stateKey], this, arguments);
			};
			wrapped.__isHooked = true;
			return wrapped;
		}

		function injectToDc(dcObj) {
			settings.targets.forEach(function(target) {
				let internalFn = dcObj[target.name];
				Object.defineProperty(dcObj, target.name, {
					get: function() { return internalFn; },
					set: function(newFn) {
						if (typeof newFn === 'function' && !newFn.__isHooked) internalFn = createWrappedFunction(newFn, target);
						else internalFn = newFn;
					},
					configurable: true,
					enumerable: true
				});
				if (typeof internalFn === 'function' && !internalFn.__isHooked) dcObj[target.name] = internalFn;
			});
		}

		function applySmartHook() {
			if (typeof TYRANO === 'undefined' || !TYRANO.kag) {
				helper.waitUntilReady(function() {
					return typeof TYRANO !== 'undefined' && TYRANO.kag;
				}, settings.retryInterval, applySmartHook);
				return;
			}

			let currentDc = TYRANO.kag.dc;
			Object.defineProperty(TYRANO.kag, 'dc', {
				get: function() { return currentDc; },
				set: function(nextDc) {
					currentDc = nextDc;
					if (currentDc) injectToDc(currentDc);
				},
				configurable: true,
				enumerable: true
			});
			if (currentDc) injectToDc(currentDc);
		}

		function registerTargetApi(target) {
			const targetApi = helper.ensurePath(modloader.api, target.apiPath);
			targetApi.register = function(list) {
				if (!Array.isArray(list)) return null;
				const registered = [];
				list.forEach(function(entry) {
					try {
						if (!target.validateEntry(entry)) return;
						state[target.stateKey].push(entry);
						registered.push(entry);
						if (settings.debug) target.logRegister(runtime, entry);
					} catch (error) {
						runtime.logError(`注册异常: ${target.getEntryName(entry)}`, error);
					}
				});
				return registered.length > 0 ? registered : null;
			};
		}

		runtime.initialize(function() { return true; }, function() {
			settings.targets.forEach(registerTargetApi);
			applySmartHook();
			helper.ensurePath(modloader.api, settings.apiPathRoot || '');
			if (settings.showApiPath) {
				const showApi = helper.ensurePath(modloader.api, settings.showApiPath);
				showApi.show = function() { return settings.show(state, runtime); };
			}
		});

		return { runtime: runtime, state: state };
	}

	function createScenarioModule(options) {
		const settings = Object.assign({
			retryInterval: 3000,
			debug: true,
			color: '#795548',
			tag: 'KsModule',
			apiPath: 'ks'
		}, options || {});

		const runtime = modloader.ModuleRuntime.createRuntime(settings);
		const api = helper.ensurePath(modloader.api, settings.apiPath);
		api.register = api.register || {};
		api.show = function() {
			return getSummary();
		};
		const state = {
			jsonRules: [],
			rawRules: [],
			cachedScripts: {},
			cachedRawScripts: {},
			lastRequestedFile: '未知文件'
		};
		const debugConfigPath = 'config/modloader-api.json';
		const captureRootPath = 'config/modloader-api';
		const configPollInterval = 1000;
		const defaultDebugSettings = {
			captureKsJson: false,
			captureKsRaw: false
		};
		const debugSettings = Object.assign({}, defaultDebugSettings);
		let lastDebugConfigContent;

		function normalizeTarget(target) {
			if (!target) return '';
			return String(target).replace(/\\/g, '/').toLowerCase();
		}

		function cloneScriptData(data) {
			return helper.cloneShallow(data);
		}

		function getConfigApi() {
			const fileApi = window.api && window.api.modloader;
			if (!fileApi || typeof fileApi.readFileSync !== 'function' || typeof fileApi.writeFileSync !== 'function') return null;
			return fileApi;
		}

		function parseDebugSettings(content) {
			const nextSettings = Object.assign({}, defaultDebugSettings);
			if (content === null || content === undefined || content === '') return nextSettings;
			const config = JSON.parse(content);
			if (!config || typeof config !== 'object' || Array.isArray(config)) {
				throw new Error('调试配置格式无效');
			}
			Object.keys(defaultDebugSettings).forEach(function(key) {
				if (typeof config[key] === 'boolean') nextSettings[key] = config[key];
			});
			return nextSettings;
		}

		function refreshDebugSettings() {
			const fileApi = getConfigApi();
			if (!fileApi) return;
			try {
				const content = fileApi.readFileSync(debugConfigPath);
				if (content === lastDebugConfigContent) return;
				lastDebugConfigContent = content;
				Object.assign(debugSettings, parseDebugSettings(content));
			} catch (error) {
				runtime.logError('读取调试配置失败', error);
			}
		}

		function startDebugSettingsPolling() {
			if (typeof window.setInterval !== 'function') return;
			window.setInterval(refreshDebugSettings, configPollInterval);
		}

		function getCaptureFileName(fileName) {
			const safeParts = String(fileName || 'unknown.ks')
				.replace(/\\/g, '/')
				.split('/')
				.filter(function(part) { return part && part !== '.' && part !== '..'; })
				.map(function(part) { return part.replace(/[<>:"|?*\u0000-\u001f]/g, '_'); });
			let normalizedName = safeParts.length > 0 ? safeParts.join('/') : 'unknown.ks';
			if (!/\.ks$/i.test(normalizedName)) normalizedName += '.ks';
			return normalizedName;
		}

		function writeCaptureFile(type, fileName, extension, content) {
			const fileApi = getConfigApi();
			if (!fileApi) return;
			const capturePath = `${captureRootPath}/${type}/${getCaptureFileName(fileName)}.${extension}`;
			const result = fileApi.writeFileSync(capturePath, content);
			if (!result || !result.success) {
				throw new Error(result && result.error ? result.error : '调试文件写入失败');
			}
		}

		function captureJsonScript(fileName, data) {
			if (!debugSettings.captureKsJson) return;
			try {
				writeCaptureFile('json', fileName, 'json', JSON.stringify({
					fileName: fileName,
					data: data
				}, null, 2));
			} catch (error) {
				runtime.logError(`导出 KS JSON 失败: ${fileName}`, error);
			}
		}

		function captureRawScript(fileName, text) {
			if (!debugSettings.captureKsRaw) return;
			try {
				writeCaptureFile('raw', fileName, 'raw', String(text == null ? '' : text));
			} catch (error) {
				runtime.logError(`导出 KS RAW 失败: ${fileName}`, error);
			}
		}

		function getPreview(data) {
			try {
				const text = typeof data === 'string' ? data : JSON.stringify(data);
				if (!text) return '[空数据]';
				return text.length > 200 ? `${text.substring(0, 200)}...` : text;
			} catch (error) {
				return `[无法预览: ${error.message}]`;
			}
		}

		function cacheScript(fileName, data) {
			const key = normalizeTarget(fileName);
			if (!key) return;
			state.cachedScripts[key] = {
				fileName: fileName,
				data: cloneScriptData(data),
				updatedAt: Date.now()
			};
		}

		function cacheRawScript(fileName, originalText, transformedText) {
			const key = normalizeTarget(fileName);
			if (!key) return;
			state.cachedRawScripts[key] = {
				fileName: fileName,
				originalText: String(originalText == null ? '' : originalText),
				transformedText: String(transformedText == null ? '' : transformedText),
				updatedAt: Date.now()
			};
		}

		function getMergedPathList() {
			return Array.from(new Set(
				Object.keys(state.cachedScripts)
					.map(function(key) { return state.cachedScripts[key].fileName; })
					.concat(Object.keys(state.cachedRawScripts).map(function(key) { return state.cachedRawScripts[key].fileName; }))
			));
		}

		function matchTarget(ruleTarget, fileName) {
			return normalizeTarget(ruleTarget) !== '' && normalizeTarget(ruleTarget) === normalizeTarget(fileName);
		}

		function getParsedDetails(fileName) {
			const cached = state.cachedScripts[normalizeTarget(fileName)];
			if (!cached) return null;
			return {
				fileName: cached.fileName,
				data: cached.data
			};
		}

		function getRawDetails(fileName) {
			const cached = state.cachedRawScripts[normalizeTarget(fileName)];
			if (!cached) return null;
			return {
				fileName: cached.fileName,
				originalText: cached.originalText,
				transformedText: cached.transformedText
			};
		}

		function getSummary() {
			return {
				paths: getMergedPathList(),
				rawScripts: Object.keys(state.cachedRawScripts).map(function(key) {
					const cached = state.cachedRawScripts[key];
					return {
						fileName: cached.fileName,
						originalLength: cached.originalText.length,
						transformedLength: cached.transformedText.length,
						preview: getPreview(cached.transformedText)
					};
				}),
				parsedScripts: Object.keys(state.cachedScripts).map(function(key) {
					const cached = state.cachedScripts[key];
					const data = cached.data;
					return {
						fileName: cached.fileName,
						type: Array.isArray(data) ? 'Array' : typeof data,
						length: Array.isArray(data) ? data.length : null,
						preview: getPreview(data)
					};
				}),
				rawRules: state.rawRules.map(function(rule) {
					return {
						target: rule.target,
						description: rule.description || '',
						transform: helper.previewValue(rule.transform, 80) || ''
					};
				}),
				jsonRules: state.jsonRules.map(function(rule) {
					return {
						target: rule.target,
						description: rule.description || '',
						transform: helper.previewValue(rule.transform, 80) || ''
					};
				})
			};
		}

		api.register.json = function(ruleList) {
			if (!Array.isArray(ruleList)) {
				runtime.logError('注册失败: 必须传入数组');
				return null;
			}
			const registered = [];
			ruleList.forEach(function(rule) {
				try {
					if (!rule || !rule.target || typeof rule.transform !== 'function') return;
					state.jsonRules.push(rule);
					registered.push(rule);
					if (settings.debug) runtime.logRegisterSuccess(rule.description || rule.target, [`目标文件(JSON): [${rule.target}]`]);
				} catch (error) {
					runtime.logError('注册异常', error);
				}
			});
			return registered.length > 0 ? registered : null;
		};

		api.register.raw = function(ruleList) {
			if (!Array.isArray(ruleList)) {
				runtime.logError('注册失败: 必须传入数组');
				return null;
			}
			const registered = [];
			ruleList.forEach(function(rule) {
				try {
					if (!rule || !rule.target || typeof rule.transform !== 'function') return;
					state.rawRules.push(rule);
					registered.push(rule);
					if (settings.debug) runtime.logRegisterSuccess(rule.description || rule.target, [`目标文件(KS): [${rule.target}]`]);
				} catch (error) {
					runtime.logError('注册异常', error);
				}
			});
			return registered.length > 0 ? registered : null;
		};

		api.list = function() {
			const paths = getMergedPathList();
			console.log(`${runtime.logger.logTag} %c可查看脚本路径(KS/JSON):`, runtime.logger.tagStyle, runtime.logger.resetStyle, runtime.logger.successStyle);
			return paths.length > 0 ? paths : null;
		};

		api.show.json = function(fileName) {
			if (fileName) return getParsedDetails(fileName);
			return getSummary();
		};

		api.show.raw = function(fileName) {
			if (fileName) return getRawDetails(fileName);
			return getSummary();
		};

		refreshDebugSettings();
		startDebugSettingsPolling();

		runtime.initialize(function() {
			try {
				return (
					typeof tyrano !== 'undefined' &&
					tyrano.plugin &&
					tyrano.plugin.kag &&
					typeof tyrano.plugin.kag.loadScenario === 'function' &&
					tyrano.plugin.kag.parser &&
					typeof tyrano.plugin.kag.parser.parseScenario === 'function'
				);
			} catch (error) {
				return false;
			}
		}, function() {
			const kag = tyrano.plugin.kag;
			const originalLoadScenario = kag.loadScenario;
			const originalParseScenario = kag.parser.parseScenario;

			kag.loadScenario = function(fileName, callback) {
				state.lastRequestedFile = fileName || state.lastRequestedFile;
				const wrappedCallback = function(data) {
					if (!data || typeof data !== 'object') {
						if (callback) callback(data);
						return;
					}

					let finalData = cloneScriptData(data);
					const matchedRules = state.jsonRules.filter(function(rule) {
						return matchTarget(rule.target, fileName);
					});

					matchedRules.forEach(function(rule) {
						try {
							const nextData = rule.transform(finalData, {
								fileName: fileName,
								rule: rule,
								kag: kag,
								stage: 'json'
							});
							if (nextData && typeof nextData === 'object') finalData = nextData;
						} catch (error) {
							runtime.logError(`JSON规则执行异常: ${rule.description || rule.target}`, error);
						}
					});

					cacheScript(fileName, finalData);
					captureJsonScript(fileName, finalData);
					if (callback) callback(finalData);
				};
				return originalLoadScenario.apply(this, [fileName, wrappedCallback]);
			};

			kag.parser.parseScenario = function(textStr) {
				const fileName = kag.stat.current_scenario || state.lastRequestedFile || '未知文件';
				let finalText = String(textStr == null ? '' : textStr);
				const originalText = finalText;
				const matchedRules = state.rawRules.filter(function(rule) {
					return matchTarget(rule.target, fileName);
				});

				matchedRules.forEach(function(rule) {
					try {
						const nextText = rule.transform(finalText, {
							fileName: fileName,
							rule: rule,
							kag: kag,
							parser: kag.parser,
							stage: 'raw'
						});
						if (typeof nextText === 'string') finalText = nextText;
					} catch (error) {
						runtime.logError(`KS规则执行异常: ${rule.description || rule.target}`, error);
					}
				});

				cacheRawScript(fileName, originalText, finalText);
				captureRawScript(fileName, finalText);
				return originalParseScenario.apply(this, [finalText]);
			};
		});

		return { runtime: runtime, state: state, api: api };
	}

	modloader.SpecialModuleFactory = {
		createDcInterceptorModule: createDcInterceptorModule,
		createScenarioModule: createScenarioModule
	};
})();
