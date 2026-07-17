/**
 * 特效模块。
 */
(function() {
	'use strict';

	const factory = modloader.DataModuleFactory;

	factory.createArrayHookModule({
		tag: '特效助手',
		color: '#8e24aa',
		apiPath: 'effect',
		stateKey: 'entries',
		checkReady: function() {
			try {
				return typeof TYRANO !== 'undefined' && TYRANO.kag && TYRANO.kag.dc && typeof TYRANO.kag.dc.photoEffects === 'function';
			} catch (error) {
				return false;
			}
		},
		getSource: function() {
			return TYRANO.kag.dc.photoEffects;
		},
		setSource: function(fn) {
			TYRANO.kag.dc.photoEffects = fn;
		},
		validateEntry: function(entry) {
			return !!(entry && entry.data && (entry.data.file || entry.data.name));
		},
		getEntryName: function(entry) {
			if (!entry || !entry.data) return '未知特效';
			return entry.data.name || entry.data.file || '未知特效';
		},
		matcher: function(target, finalItem) {
			if (!target || !finalItem) return false;
			if (finalItem.file && target.file) return String(target.file) === String(finalItem.file);
			if (finalItem.name && target.name) return String(target.name) === String(finalItem.name);
			return false;
		},
		resolveItemData: false,
		logRegister: function(runtime, entry) {
			const data = entry.data;
			runtime.logRegisterSuccess(data.name || data.file || '未命名特效', [
				`文件标识: [${data.file || '-'}]`,
				`混合模式: [${data.mode || '-'}]`
			]);
		},
		readAll: function() {
			return TYRANO.kag.dc.photoEffects();
		}
	});
})();
