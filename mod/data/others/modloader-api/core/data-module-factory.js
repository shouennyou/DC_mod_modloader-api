/**
 * 通用数据模块工厂：统一 register + hook + show 模式。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi || (window.modloaderApi = {});
	if (modloader.DataModuleFactory) return;

	const helper = modloader.ModHelper;

	// Keep one dc descriptor per kag instance so multiple data modules can coexist.
	function watchDc(kag, listener, onError) {
		const key = '__modloaderApiDcWatcher';
		let watcher = kag[key];
		if (!watcher) {
			const descriptor = Object.getOwnPropertyDescriptor(kag, 'dc');
			let current = descriptor && Object.prototype.hasOwnProperty.call(descriptor, 'value')
				? descriptor.value
				: (descriptor && typeof descriptor.get === 'function' ? descriptor.get.call(kag) : kag.dc);
			watcher = {
				listeners: [],
				notify: function() {
					this.listeners.slice().forEach(function(item) {
						try { item.listener(current); } catch (error) {
							if (typeof item.onError === 'function') item.onError(error);
						}
					});
				}
			};
			try {
				Object.defineProperty(kag, 'dc', {
					configurable: true,
					enumerable: descriptor ? descriptor.enumerable : true,
					get: function() {
						return descriptor && typeof descriptor.get === 'function' ? descriptor.get.call(kag) : current;
					},
					set: function(nextDc) {
						if (descriptor && typeof descriptor.set === 'function') descriptor.set.call(kag, nextDc);
						else current = nextDc;
						current = descriptor && typeof descriptor.get === 'function' ? descriptor.get.call(kag) : nextDc;
						watcher.notify();
					}
				});
				Object.defineProperty(kag, key, { value: watcher, configurable: false, enumerable: false });
			} catch (error) {
				if (typeof onError === 'function') onError(error);
				return false;
			}
		}
		if (!watcher.listeners.some(function(item) { return item.listener === listener; })) {
			watcher.listeners.push({ listener: listener, onError: onError });
		}
		listener(kag.dc);
		return true;
	}

	function watchKag(listener, onError) {
		const key = '__modloaderApiKagWatcher';
		let watcher = modloader[key];
		if (!watcher) {
			watcher = { listeners: [], current: null, timer: null };
			modloader[key] = watcher;
			const refresh = function() {
				const nextKag = typeof TYRANO !== 'undefined' && TYRANO ? TYRANO.kag : null;
				if (!nextKag || nextKag === watcher.current) return;
				watcher.current = nextKag;
				watcher.listeners.slice().forEach(function(item) {
					if (!watchDc(nextKag, item.listener, item.onError)) item.listener(nextKag.dc);
				});
			};
			if (typeof window.setInterval === 'function') watcher.timer = window.setInterval(refresh, 500);
		}
		const item = { listener: listener, onError: onError };
		if (!watcher.listeners.some(function(existing) { return existing.listener === listener; })) {
			watcher.listeners.push(item);
		}
		const nextKag = typeof TYRANO !== 'undefined' && TYRANO ? TYRANO.kag : null;
		if (nextKag) {
			watcher.current = nextKag;
			return watchDc(nextKag, listener, onError);
		}
		return false;
	}

	function createArrayHookModule(options) {
		const settings = Object.assign({
			retryInterval: 3000,
			debug: true,
			color: '#607d8b',
			tag: 'DataModule',
			apiPath: '',
			stateKey: 'items',
			allowedModes: ['append', 'prepend', 'override'],
			defaultMode: 'append',
			resolveItemData: true,
			resolveOptions: {},
			getRawData: function(items) {
				return items;
			}
		}, options || {});

		const runtime = modloader.ModuleRuntime.createRuntime(settings);
		const moduleApi = helper.ensurePath(modloader, settings.apiPath);
		const state = {};
		state[settings.stateKey] = [];
		state.patchEntries = [];

		function getStore() {
			return state[settings.stateKey];
		}

		function resolveData(entry, thisArg) {
			if (!settings.resolveItemData) return entry.data;
			return helper.resolveObjectSafe(entry.data, thisArg, helper.getTyranoContext(), settings.resolveOptions);
		}

		function applyHook() {
			const originalFn = settings.getSource();
			if (typeof originalFn !== 'function' || originalFn.__modloaderApiDataHook) return;
			settings.setSource(function() {
				let data = originalFn.apply(this, arguments);
				data = Array.isArray(data) ? data.slice() : [];

				// register() 始终保留完整条目的 append / prepend / override 语义。
				getStore().forEach(entry => {
					try {
						const finalItem = resolveData(entry, this);
						const mode = helper.normalizeMode(entry.mode, settings.allowedModes, settings.defaultMode);
						helper.applyArrayItemMode(data, finalItem, mode, function(target) {
							return settings.matcher(target, finalItem, entry);
						});
					} catch (error) {
						if (settings.debug) runtime.logError('数据注入异常', error);
					}
				});

				// patch.register() 只合并提供的字段，不改变原项目顺序。
				state.patchEntries.forEach(entry => {
					try {
						const patch = resolveData(entry, this);
						const index = data.findIndex(function(target) {
							return settings.matcher(target, patch, entry);
						});
						if (index !== -1) {
							data[index] = typeof settings.mergePatch === 'function'
								? settings.mergePatch(data[index], patch, entry)
								: Object.assign({}, data[index], patch);
							return;
						}
						const existsInOriginalData = typeof settings.hasOriginalPatchTarget === 'function' &&
							settings.hasOriginalPatchTarget(originalFn, this, arguments, patch, entry);
						if (!existsInOriginalData && entry.appendIfMissing === true) data.push(patch);
					} catch (error) {
						if (settings.debug) runtime.logError('数据补丁注入异常', error);
					}
				});

				return data;
			});
			const hooked = settings.getSource();
			if (typeof hooked === 'function') hooked.__modloaderApiDataHook = true;
		}

		function applySmartHook() {
			if (typeof TYRANO === 'undefined' || !TYRANO.kag) {
				helper.waitUntilReady(function() {
					return typeof TYRANO !== 'undefined' && TYRANO.kag;
				}, settings.retryInterval, applySmartHook);
				return;
			}
			if (!watchKag(function() {
				if (settings.checkReady()) applyHook();
			}, function(error) {
				runtime.logError('DC 替换保护安装失败', error);
			})) applyHook();
		}

		function registerEntries(list) {
			if (!Array.isArray(list)) {
				runtime.logError('注册失败: 必须传入数组');
				return null;
			}

			const registered = [];
			list.forEach(entry => {
				try {
					if (!settings.validateEntry(entry)) return;
					getStore().push(entry);
					registered.push(entry);
					if (settings.debug) settings.logRegister(runtime, entry);
				} catch (error) {
					runtime.logError(`注册异常: ${settings.getEntryName(entry)}`, error);
				}
			});
			return registered.length > 0 ? registered : null;
		}

		function registerPatchEntries(list) {
			if (!Array.isArray(list)) {
				runtime.logError('补丁注册失败: 必须传入数组');
				return null;
			}
			const registered = [];
			list.forEach(entry => {
				try {
					const validate = settings.validatePatchEntry || settings.validateEntry;
					if (!validate(entry)) return;
					state.patchEntries.push(entry);
					registered.push(entry);
					if (settings.debug) {
						const log = settings.logPatchRegister || settings.logRegister;
						if (typeof log === 'function') log(runtime, Object.assign({}, entry, { mode: 'patch' }));
					}
				} catch (error) {
					runtime.logError(`补丁注册异常: ${settings.getEntryName(entry)}`, error);
				}
			});
			return registered.length > 0 ? registered : null;
		}

		function showData() {
			try {
				const allItems = settings.readAll();
				return settings.getRawData(allItems, getStore());
			} catch (error) {
				runtime.logError('统计显示异常', error);
				return null;
			}
		}

		runtime.initialize(settings.checkReady, function() {
			applySmartHook();
		});
		// 注册接口在引擎初始化前即可使用, 数据会暂存并在 hook 安装后生效.
		moduleApi.register = registerEntries;
		moduleApi.show = showData;
		if (settings.enablePatch) moduleApi.patch = { register: registerPatchEntries };

		return { runtime, state, api: moduleApi };
	}

	function createObjectHookModule(options) {
		const settings = Object.assign({
			retryInterval: 3000,
			debug: true,
			color: '#607d8b',
			tag: 'ObjectModule',
			apiPath: '',
			allowedModes: ['append', 'fixed'],
			defaultMode: 'append',
			entries: [],
			resolveOptions: {},
			getRawData: function(data) { return data; }
		}, options || {});

		const runtime = modloader.ModuleRuntime.createRuntime(settings);
		const moduleApi = helper.ensurePath(modloader, settings.apiPath);
		const state = { entries: [], patchEntries: [] };

		function applyHook() {
			const originalFn = settings.getSource();
			if (typeof originalFn !== 'function' || originalFn.__modloaderApiDataHook) return;
			settings.setSource(function() {
				const baseData = originalFn.apply(this, arguments);
				const data = settings.cloneSource(baseData);
				state.entries.forEach(entry => {
					try {
						settings.injectEntry(data, entry, this);
					} catch (error) {
						if (settings.debug) runtime.logError('数据注入异常', error);
					}
				});
				state.patchEntries.forEach(entry => {
					try {
						if (typeof settings.injectPatchEntry === 'function') settings.injectPatchEntry(data, entry, this);
					} catch (error) {
						if (settings.debug) runtime.logError('数据补丁注入异常', error);
					}
				});
				return data;
			});
			const hooked = settings.getSource();
			if (typeof hooked === 'function') hooked.__modloaderApiDataHook = true;
		}

		function applySmartHook() {
			if (typeof TYRANO === 'undefined' || !TYRANO.kag) {
				helper.waitUntilReady(function() {
					return typeof TYRANO !== 'undefined' && TYRANO.kag;
				}, settings.retryInterval, applySmartHook);
				return;
			}
			if (!watchKag(function() {
				if (settings.checkReady()) applyHook();
			}, function(error) {
				runtime.logError('DC 替换保护安装失败', error);
			})) applyHook();
		}

		function registerEntries(list) {
			if (!Array.isArray(list)) {
				runtime.logError('注册失败: 必须传入数组');
				return null;
			}
			const registered = [];
			list.forEach(entry => {
				try {
					if (!settings.validateEntry(entry)) return;
					state.entries.push(entry);
					registered.push(entry);
					if (settings.debug) settings.logRegister(runtime, entry);
				} catch (error) {
					runtime.logError(`注册异常: ${settings.getEntryName(entry)}`, error);
				}
			});
			return registered.length > 0 ? registered : null;
		}

		function registerPatchEntries(list) {
			if (!Array.isArray(list)) {
				runtime.logError('补丁注册失败: 必须传入数组');
				return null;
			}
			const registered = [];
			list.forEach(entry => {
				try {
					const validate = settings.validatePatchEntry || settings.validateEntry;
					if (!validate(entry)) return;
					state.patchEntries.push(entry);
					registered.push(entry);
					if (settings.debug) {
						const log = settings.logPatchRegister || settings.logRegister;
						if (typeof log === 'function') log(runtime, Object.assign({}, entry, { mode: 'patch' }));
					}
				} catch (error) {
					runtime.logError(`补丁注册异常: ${settings.getEntryName(entry)}`, error);
				}
			});
			return registered.length > 0 ? registered : null;
		}

		function showData() {
			try {
				const allData = settings.readAll();
				return settings.getRawData(allData, state.entries);
			} catch (error) {
				runtime.logError('统计显示异常', error);
				return null;
			}
		}

		runtime.initialize(settings.checkReady, function() {
			applySmartHook();
		});
		moduleApi.register = registerEntries;
		moduleApi.show = showData;
		if (settings.enablePatch) moduleApi.patch = { register: registerPatchEntries };

		return { runtime, state, api: moduleApi };
	}

	modloader.DataModuleFactory = {
		createArrayHookModule,
		createObjectHookModule
	};
})();
