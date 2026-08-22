/**
 * KS 场景脚本模块。
 */
(function() {
	'use strict';

	const modloader = window.modloaderApi;

	modloader.SpecialModuleFactory.createScenarioModule({
		tag: 'KS助手',
		color: '#795548',
		apiPath: 'ks'
	});
})();
