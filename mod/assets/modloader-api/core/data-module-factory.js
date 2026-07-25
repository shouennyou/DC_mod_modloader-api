/**
 * 通用数据模块工厂：统一 register + hook + show 模式。
 */
(function() {
	'use strict';

	const modloader = window.modloader || (window.modloader = {});
	if (modloader.DataModuleFactory) return;

	const helper = modloader.ModHelper;

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
		const moduleApi = helper.ensurePath(modloader.api, settings.apiPath);
		const state = {};
		state[settings.stateKey] = [];

		function getStore() {
			return state[settings.stateKey];
		}

		function resolveData(entry, thisArg) {
			if (!settings.resolveItemData) return entry.data;
			return helper.resolveObjectSafe(entry.data, thisArg, helper.getTyranoContext(), settings.resolveOptions);
		}

		function applyHook() {
			const originalFn = settings.getSource();
			settings.setSource(function() {
				let data = originalFn.apply(this, arguments);
				if (!Array.isArray(data)) data = [];

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

				return data;
			});
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
			applyHook();
			moduleApi.register = registerEntries;
			moduleApi.show = showData;
		});

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
		const moduleApi = helper.ensurePath(modloader.api, settings.apiPath);
		const state = { entries: [] };

		function applyHook() {
			const originalFn = settings.getSource();
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
				return data;
			});
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
			applyHook();
			moduleApi.register = registerEntries;
			moduleApi.show = showData;
		});

		return { runtime, state, api: moduleApi };
	}

	modloader.DataModuleFactory = {
		createArrayHookModule,
		createObjectHookModule
	};
})();
