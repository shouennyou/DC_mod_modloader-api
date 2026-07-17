/**
 * 模块运行时工具，减少重复初始化逻辑。
 */
(function() {
	'use strict';

	const modloader = window.modloader || (window.modloader = {});
	if (modloader.ModuleRuntime) return;

	function createRuntime(config) {
		const settings = Object.assign({ retryInterval: 1000, debug: true, color: '#607d8b', tag: 'Module' }, config || {});
		const logger = modloader.ModHelper.createLogger(settings.tag, settings.color);
		const state = { isLoaded: false };

		function logSuccess(message) {
			console.log(`${logger.logTag} %c${message}`, logger.tagStyle, logger.resetStyle, logger.successStyle);
		}

		function logError(message, detail) {
			console.error(`${logger.logTag} %c${message}`, logger.tagStyle, logger.resetStyle, logger.errorStyle, logger.resetStyle);
			if (detail !== undefined) console.log('      └─ 详细信息:', detail);
		}

		function logRegisterSuccess(name, detailLines) {
			if (!settings.debug) return;
			console.log(`${logger.logTag} %c注册成功: %c${name}`, logger.tagStyle, logger.resetStyle, logger.successStyle, logger.resetStyle);
			(modloader.ModHelper.ensureArray(detailLines)).forEach(line => console.log(`      └─ ${line}`));
		}

		function initialize(checkReady, init) {
			if (state.isLoaded) return;
			if (!checkReady()) {
				modloader.ModHelper.waitUntilReady(checkReady, settings.retryInterval, function() {
					initialize(checkReady, init);
				});
				return;
			}

			try {
				init();
				state.isLoaded = true;
				console.log(`${logger.logTag} %c加载成功.`, logger.tagStyle, logger.resetStyle, logger.successStyle);
			} catch (error) {
				logError('加载失败: 初始化过程异常', error);
			}
		}

		return {
			settings,
			state,
			logger,
			initialize,
			logSuccess,
			logError,
			logRegisterSuccess
		};
	}

	modloader.ModuleRuntime = { createRuntime };
})();
