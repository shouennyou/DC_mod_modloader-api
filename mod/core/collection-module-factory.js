/**
 * 通用集合处理器：统一数组型数据注入与统计。
 */
(function() {
	'use strict';

	const modloader = window.modloader || (window.modloader = {});
	if (modloader.CollectionModuleFactory) return;

	const helper = modloader.ModHelper;

	function createCollectionModule(options) {
		const settings = Object.assign({
			retryInterval: 3000,
			debug: true,
			color: '#607d8b',
			tag: 'CollectionModule',
			apiPath: '',
			defaultKey: '',
			allowedModes: ['append', 'prepend', 'replace'],
			getAvailableKeys: function() { return []; },
			ensureCollection: function() {},
			writeCollection: function() {},
			getRawData: function() { return {}; }
		}, options || {});

		const runtime = modloader.ModuleRuntime.createRuntime(settings);
		const moduleApi = helper.ensurePath(modloader.api, settings.apiPath);
		const state = { collections: {} };

		function ensureStateKey(key) {
			state.collections[key] = state.collections[key] || [];
			return state.collections[key];
		}

		function applyMode(current, batch, mode) {
			const normalized = helper.normalizeMode(mode, settings.allowedModes, 'append');
			if (normalized === 'replace') return helper.uniqueArray(batch);
			if (normalized === 'prepend') return helper.uniqueArray(batch.concat(current));
			return helper.uniqueArray(current.concat(batch));
		}

		moduleApi.register = function(payload) {
			if (!Array.isArray(payload)) {
				runtime.logError('注册失败: 必须传入数组');
				return null;
			}
			if (!settings.checkReady()) {
				runtime.logError('注册失败: 引擎未就绪');
				return null;
			}

			const registered = [];
			payload.forEach(item => {
				try {
					const key = settings.getCollectionKey(item) || settings.defaultKey;
					settings.ensureCollection(key);
					const values = helper.ensureArray(settings.getPayloadData(item));
					if (values.length === 0) return;
					const mode = helper.normalizeMode(item.mode, settings.allowedModes, 'append');
					const stateList = ensureStateKey(key);
					state.collections[key] = applyMode(stateList, values, mode);
					settings.writeCollection(key, state.collections[key], mode, values);
					registered.push({ key, mode, data: values });
					if (settings.debug) settings.logRegister(runtime, key, mode, values);
				} catch (error) {
					runtime.logError('注册异常', error);
				}
			});
			return registered.length > 0 ? registered : null;
		};

		moduleApi.show = function() {
			if (!settings.checkReady()) {
				runtime.logError('统计显示失败: 引擎未就绪');
				return null;
			}
			const keys = settings.getAvailableKeys(state.collections);
			return settings.getRawData(keys, state.collections);
		};

		runtime.initialize(settings.checkReady, function() {});

		return { runtime, state, api: moduleApi };
	}

	modloader.CollectionModuleFactory = { createCollectionModule };
})();
